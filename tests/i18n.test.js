const { getLang, TABLES } = require("../lang");

describe("getLang", () => {
  it("returns es by default", () => {
    expect(getLang()).toBe(TABLES.es);
    expect(getLang(null)).toBe(TABLES.es);
    expect(getLang("")).toBe(TABLES.es);
  });

  it("returns the table for a string locale", () => {
    expect(getLang("es")).toBe(TABLES.es);
    expect(getLang("en")).toBe(TABLES.en);
    expect(getLang("pt")).toBe(TABLES.pt);
  });

  it("falls back to es for unknown locales", () => {
    expect(getLang("zz")).toBe(TABLES.es);
  });

  it("reads locale from a group object", () => {
    expect(getLang({ locale: "en" })).toBe(TABLES.en);
  });

  it("reads locale from a config-wrapped object", () => {
    expect(getLang({ config: { locale: "pt" } })).toBe(TABLES.pt);
  });

  it("all three tables share the same key shape", () => {
    const keys = Object.keys(TABLES.es).sort();
    expect(Object.keys(TABLES.en).sort()).toEqual(keys);
    expect(Object.keys(TABLES.pt).sort()).toEqual(keys);
  });
});
