import { describe, it, expect } from "vitest";
import { ScriptEngine } from "../script-engine";
import { MemoryVolume } from "../memory-volume";

function createEngine(files?: Record<string, string>) {
  const vol = new MemoryVolume();
  vol.mkdirSync("/project", { recursive: true });
  if (files) {
    for (const [path, content] of Object.entries(files)) {
      const dir = path.substring(0, path.lastIndexOf("/")) || "/";
      if (dir !== "/") vol.mkdirSync(dir, { recursive: true });
      vol.writeFileSync(path, content);
    }
  }
  return { vol, engine: new ScriptEngine(vol, { cwd: "/project" }) };
}

describe("ScriptEngine", () => {
  describe("execute()", () => {
    it("runs basic JS and returns exports", () => {
      const { engine } = createEngine();
      const result = engine.execute("module.exports = 42;", "/index.js");
      expect(result.exports).toBe(42);
    });

    it("module.exports = object", () => {
      const { engine } = createEngine();
      const result = engine.execute(
        "module.exports = { x: 1 };",
        "/index.js",
      );
      expect(result.exports).toEqual({ x: 1 });
    });

    it("exports.x = value shorthand", () => {
      const { engine } = createEngine();
      const result = engine.execute("exports.x = 1;", "/index.js");
      expect((result.exports as any).x).toBe(1);
    });

    it("has access to __dirname and __filename", () => {
      const { engine } = createEngine();
      const result = engine.execute(
        "module.exports = { dir: __dirname, file: __filename };",
        "/project/test.js",
      );
      expect((result.exports as any).dir).toBe("/project");
      expect((result.exports as any).file).toBe("/project/test.js");
    });

    it("has access to process object", () => {
      const { engine } = createEngine();
      const result = engine.execute(
        "module.exports = process.platform;",
        "/index.js",
      );
      expect(result.exports).toBe("linux");
    });

    it("handles syntax errors by throwing", () => {
      const { engine } = createEngine();
      expect(() => engine.execute("const {", "/bad.js")).toThrow();
    });
  });

  describe("runFile()", () => {
    it("reads file from volume and executes", () => {
      const { engine } = createEngine({
        "/project/app.js": 'module.exports = "hello";',
      });
      const result = engine.runFile("/project/app.js");
      expect(result.exports).toBe("hello");
    });

    it("throws for nonexistent file", () => {
      const { engine } = createEngine();
      expect(() => engine.runFile("/nonexistent.js")).toThrow();
    });
  });

  describe("require()", () => {
    it("requires a local file with relative path", () => {
      const { engine } = createEngine({
        "/project/lib.js": "module.exports = 10;",
      });
      const result = engine.execute(
        'const lib = require("./lib"); module.exports = lib;',
        "/project/index.js",
      );
      expect(result.exports).toBe(10);
    });

    it("requires chained files (A requires B requires C)", () => {
      const { engine } = createEngine({
        "/project/c.js": "module.exports = 3;",
        "/project/b.js":
          'module.exports = require("./c") * 2;',
        "/project/a.js":
          'module.exports = require("./b") + 1;',
      });
      const result = engine.runFile("/project/a.js");
      expect(result.exports).toBe(7);
    });

    it("caches modules (same object returned on second require)", () => {
      const { engine } = createEngine({
        "/project/mod.js": "module.exports = { count: 0 };",
      });
      const result = engine.execute(
        'const a = require("./mod"); const b = require("./mod"); a.count++; module.exports = b.count;',
        "/project/test.js",
      );
      expect(result.exports).toBe(1);
    });

    it("requires built-in modules: path", () => {
      const { engine } = createEngine();
      const result = engine.execute(
        'const p = require("path"); module.exports = p.join("/a", "b");',
        "/index.js",
      );
      expect(result.exports).toBe("/a/b");
    });

    it("requires built-in modules: events", () => {
      const { engine } = createEngine();
      const result = engine.execute(
        'const EE = require("events"); module.exports = typeof EE;',
        "/index.js",
      );
      expect(result.exports).toBe("function");
    });

    it("requires JSON files", () => {
      const { engine } = createEngine({
        "/project/data.json": '{"key": "value"}',
      });
      const result = engine.execute(
        'module.exports = require("./data.json");',
        "/project/index.js",
      );
      expect(result.exports).toEqual({ key: "value" });
    });

    it("throws for missing module", () => {
      const { engine } = createEngine();
      expect(() =>
        engine.execute('require("./nonexistent");', "/index.js"),
      ).toThrow();
    });
  });

  describe("ESM auto-conversion", () => {
    it("auto-converts import/export to CJS when required", () => {
      const { engine } = createEngine({
        "/project/mod.js": "export const x = 42;",
      });
      const result = engine.execute(
        'const m = require("./mod"); module.exports = m.x;',
        "/project/index.js",
      );
      expect(result.exports).toBe(42);
    });
  });

  describe("clearCache()", () => {
    it("clears module cache so modules are re-evaluated", () => {
      const { engine } = createEngine({
        "/project/counter.js":
          "let c = 0; module.exports = { inc() { return ++c; } };",
      });
      engine.execute(
        'module.exports = require("./counter").inc();',
        "/project/a.js",
      );
      engine.clearCache();
      const result = engine.execute(
        'module.exports = require("./counter").inc();',
        "/project/b.js",
      );
      // c resets to 0 after cache clear
      expect(result.exports).toBe(1);
    });
  });

  describe("createREPL()", () => {
    it("evaluates expressions", () => {
      const { engine } = createEngine();
      const repl = engine.createREPL();
      expect(repl.eval("1 + 1")).toBe(2);
    });

    it("evaluates variable declarations across calls", () => {
      const { engine } = createEngine();
      const repl = engine.createREPL();
      repl.eval("var x = 10");
      expect(repl.eval("x")).toBe(10);
    });
  });

  describe("shebang handling", () => {
    it("strips shebang line", () => {
      const { engine } = createEngine({
        "/project/script.js":
          "#!/usr/bin/env node\nmodule.exports = 42;",
      });
      const result = engine.runFile("/project/script.js");
      expect(result.exports).toBe(42);
    });
  });
});
