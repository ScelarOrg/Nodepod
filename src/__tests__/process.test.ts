import { describe, it, expect, vi } from "vitest";
import { buildProcessEnv } from "../polyfills/process";

describe("process polyfill", () => {
  describe("basic properties", () => {
    it('has platform "linux"', () => {
      const proc = buildProcessEnv();
      expect(proc.platform).toBe("linux");
    });

    it('has arch "x64"', () => {
      const proc = buildProcessEnv();
      expect(proc.arch).toBe("x64");
    });

    it('has version string starting with "v"', () => {
      const proc = buildProcessEnv();
      expect(proc.version).toMatch(/^v\d+/);
    });

    it("has pid as a number", () => {
      const proc = buildProcessEnv();
      expect(typeof proc.pid).toBe("number");
    });

    it("has argv as an array", () => {
      const proc = buildProcessEnv();
      expect(Array.isArray(proc.argv)).toBe(true);
    });
  });

  describe("cwd / chdir", () => {
    it("cwd() returns initial cwd", () => {
      const proc = buildProcessEnv({ cwd: "/mydir" });
      expect(proc.cwd()).toBe("/mydir");
    });

    it("chdir changes cwd", () => {
      const proc = buildProcessEnv({ cwd: "/" });
      proc.chdir("/other");
      expect(proc.cwd()).toBe("/other");
    });
  });

  describe("env", () => {
    it("includes default env vars", () => {
      const proc = buildProcessEnv();
      expect(proc.env.PATH).toBeDefined();
      expect(proc.env.HOME).toBeDefined();
    });

    it("includes custom env vars passed in config", () => {
      const proc = buildProcessEnv({ env: { MY_VAR: "hello" } });
      expect(proc.env.MY_VAR).toBe("hello");
    });

    it("includes NAPI_RS_FORCE_WASM=1", () => {
      const proc = buildProcessEnv();
      expect(proc.env.NAPI_RS_FORCE_WASM).toBe("1");
    });

    it("is mutable", () => {
      const proc = buildProcessEnv();
      proc.env.CUSTOM = "value";
      expect(proc.env.CUSTOM).toBe("value");
    });
  });

  describe("hrtime", () => {
    it("returns [seconds, nanoseconds] tuple", () => {
      const proc = buildProcessEnv();
      const hr = proc.hrtime();
      expect(Array.isArray(hr)).toBe(true);
      expect(hr.length).toBe(2);
      expect(typeof hr[0]).toBe("number");
      expect(typeof hr[1]).toBe("number");
    });

    it("hrtime.bigint() returns bigint", () => {
      const proc = buildProcessEnv();
      const result = proc.hrtime.bigint();
      expect(typeof result).toBe("bigint");
    });
  });

  describe("nextTick", () => {
    it("schedules callback asynchronously", async () => {
      const proc = buildProcessEnv();
      let called = false;
      proc.nextTick(() => {
        called = true;
      });
      expect(called).toBe(false);
      await new Promise((r) => setTimeout(r, 10));
      expect(called).toBe(true);
    });
  });

  describe("memoryUsage", () => {
    it("returns object with expected shape", () => {
      const proc = buildProcessEnv();
      const mem = proc.memoryUsage();
      expect(typeof mem.rss).toBe("number");
      expect(typeof mem.heapTotal).toBe("number");
      expect(typeof mem.heapUsed).toBe("number");
      expect(typeof mem.external).toBe("number");
      expect(typeof mem.arrayBuffers).toBe("number");
    });
  });

  describe("stdout.write", () => {
    it("calls onStdout callback when provided", () => {
      const output: string[] = [];
      const proc = buildProcessEnv({ onStdout: (text) => output.push(text) });
      proc.stdout.write("test");
      expect(output).toContain("test");
    });
  });

  describe("kill / signals", () => {
    it("kill emits signal on process", () => {
      const proc = buildProcessEnv();
      const fn = vi.fn();
      proc.on("SIGTERM", fn);
      proc.kill(proc.pid, "SIGTERM");
      expect(fn).toHaveBeenCalled();
    });
  });
});
