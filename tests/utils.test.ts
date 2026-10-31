import { describe, expect, it } from "vitest";
import { escapeHtml, idToString, isObjectId, newObjectId, omitKeys, safeUrl, stripDangerousKeys, stripNewlines } from "../src/utils/index.js";
import { ConsoleSink, Logger, type LogSink } from "../src/utils/Logger.js";

describe("stripDangerousKeys", () => {
  it("removes $operators at any depth", () => {
    const body: any = { email: { $ne: null }, nested: { a: { $gt: "" }, ok: 1 }, list: [{ $where: "x", fine: true }] };
    stripDangerousKeys(body);
    expect(body).toEqual({ email: {}, nested: { a: {}, ok: 1 }, list: [{ fine: true }] });
  });

  it("removes dotted keys and prototype-pollution keys", () => {
    const body = JSON.parse('{"a.b":1,"__proto__":{"admin":true},"constructor":{"x":1},"prototype":1,"keep":2}');
    stripDangerousKeys(body);
    expect(Object.keys(body)).toEqual(["keep"]);
    expect(({} as any).admin).toBeUndefined();
  });

  it("tolerates primitives, null and absurd depth", () => {
    expect(() => stripDangerousKeys(null)).not.toThrow();
    expect(() => stripDangerousKeys("str")).not.toThrow();
    let deep: any = {};
    const root = deep;
    for (let i = 0; i < 100; i++) deep = deep.n = {};
    expect(() => stripDangerousKeys(root)).not.toThrow();
  });

  it("omitKeys copies without mutating", () => {
    const source = { a: 1, role: "admin" };
    expect(omitKeys(source, ["role"])).toEqual({ a: 1 });
    expect(source).toEqual({ a: 1, role: "admin" });
  });
});

describe("html helpers", () => {
  it("escapes markup and attribute breakers", () => {
    expect(escapeHtml(`<img src=x onerror="a('b')">&\``)).toBe("&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;&#96;");
  });

  it.each([
    ["https://example.com/a?b=1", "https://example.com/a?b=1"],
    ["http://example.com", "http://example.com"],
    ["mailto:a@b.co", "mailto:a@b.co"],
    ["javascript:alert(1)", "#"],
    ["  JaVaScRiPt:alert(1)", "#"],
    ["data:text/html;base64,AAAA", "#"],
    ["not a url", "#"],
    ["//evil.com", "#"],
  ])("safeUrl(%s)", (input, expected) => expect(safeUrl(input)).toBe(expected));

  it("stripNewlines blocks header injection", () => {
    expect(stripNewlines("Hi\r\nBcc: evil@x.com")).toBe("Hi Bcc: evil@x.com");
  });
});

describe("ids", () => {
  it("generates valid, unique ObjectIds", () => {
    const a = newObjectId();
    expect(isObjectId(a)).toBe(true);
    expect(newObjectId()).not.toBe(a);
  });

  it.each(["", "123", "z".repeat(24), "a".repeat(25), 5, null, undefined, { $ne: 1 }, ["a".repeat(24)]])("isObjectId(%j) is false", (v) => {
    expect(isObjectId(v)).toBe(false);
  });

  it("idToString copes with strings, populated docs and ObjectId-like values", () => {
    const id = newObjectId();
    expect(idToString(id)).toBe(id);
    expect(idToString({ _id: id, email: "x" })).toBe(id);
    expect(idToString({ toHexString: () => id })).toBe(id);
    expect(idToString(null)).toBeUndefined();
    expect(idToString(undefined)).toBeUndefined();
  });
});

describe("Logger", () => {
  const capture = () => {
    const lines: Array<[string, string]> = [];
    const sink: LogSink = { write: (level, message) => void lines.push([level, message]) };
    return { lines, sink };
  };

  it("filters by level", () => {
    const { lines, sink } = capture();
    const logger = new Logger("warn", sink);
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(lines).toEqual([["warn", "w"], ["error", "e"]]);
  });

  it("silent logs nothing", () => {
    const { lines, sink } = capture();
    const logger = new Logger("silent", sink);
    logger.error("e");
    expect(lines).toEqual([]);
    expect(Logger.silent().child()).toBeInstanceOf(Logger);
  });

  it("ConsoleSink writes without throwing", () => {
    expect(() => new ConsoleSink().write("debug", "hello", { a: 1 })).not.toThrow();
  });
});
