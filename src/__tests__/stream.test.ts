import { describe, it, expect, vi } from "vitest";
import {
  Readable,
  Writable,
  Transform,
  PassThrough,
  finished,
} from "../polyfills/stream";

describe("Readable", () => {
  it("push() queues data, data event fires in flowing mode", () => {
    const r = new Readable({ read() {} });
    const chunks: string[] = [];
    r.on("data", (chunk: any) => chunks.push(String(chunk)));
    r.push("hello");
    r.push(null);
    expect(chunks).toContain("hello");
  });

  it("emits 'end' event after null push", async () => {
    const r = new Readable({ read() {} });
    const endPromise = new Promise<void>((resolve) => r.on("end", resolve));
    r.on("data", () => {});
    r.push("data");
    r.push(null);
    await endPromise;
  });

  it("pause() and resume() control flow", () => {
    const r = new Readable({ read() {} });
    r.on("data", () => {});
    r.pause();
    expect(r.isPaused()).toBe(true);
    r.resume();
    expect(r.isPaused()).toBe(false);
  });
});

describe("Writable", () => {
  it("write() calls _write internally", () => {
    const chunks: string[] = [];
    const w = new Writable({
      write(chunk: any, _enc: string, cb: () => void) {
        chunks.push(String(chunk));
        cb();
      },
    });
    w.write("hello");
    w.end();
    expect(chunks).toContain("hello");
  });

  it("emits 'finish' event after end()", async () => {
    const w = new Writable({
      write(_chunk: any, _enc: string, cb: () => void) {
        cb();
      },
    });
    const finishPromise = new Promise<void>((resolve) =>
      w.on("finish", resolve),
    );
    w.end("done");
    await finishPromise;
  });

  it("end() with data writes then finishes", () => {
    const chunks: string[] = [];
    const w = new Writable({
      write(chunk: any, _enc: string, cb: () => void) {
        chunks.push(String(chunk));
        cb();
      },
    });
    w.end("final");
    expect(chunks).toContain("final");
  });
});

describe("Transform", () => {
  it("transforms data through _transform", () => {
    const t = new Transform({
      transform(chunk: any, _enc: string, cb: (err: null, data: string) => void) {
        cb(null, String(chunk).toUpperCase());
      },
    });
    const chunks: string[] = [];
    t.on("data", (chunk: any) => chunks.push(String(chunk)));
    t.write("hello");
    t.end();
    expect(chunks).toContain("HELLO");
  });
});

describe("PassThrough", () => {
  it("passes data through unchanged", () => {
    const pt = new PassThrough();
    const chunks: string[] = [];
    pt.on("data", (chunk: any) => chunks.push(String(chunk)));
    pt.write("data");
    pt.end();
    expect(chunks).toContain("data");
  });
});

describe("pipe integration", () => {
  it("Readable.pipe(Writable) transfers all data", async () => {
    const r = new Readable({ read() {} });
    const collected: string[] = [];
    const w = new Writable({
      write(chunk: any, _enc: string, cb: () => void) {
        collected.push(String(chunk));
        cb();
      },
    });

    r.pipe(w);
    r.push("chunk1");
    r.push("chunk2");
    r.push(null);

    await new Promise<void>((resolve) => w.on("finish", resolve));
    expect(collected.join("")).toBe("chunk1chunk2");
  });
});

describe("async iteration", () => {
  it("Readable supports for-await-of", async () => {
    const r = new Readable({ read() {} });

    queueMicrotask(() => {
      r.push("a");
      r.push("b");
      r.push(null);
    });

    const chunks: string[] = [];
    for await (const chunk of r) {
      chunks.push(String(chunk));
    }
    expect(chunks).toEqual(["a", "b"]);
  });
});
