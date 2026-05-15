const cantos = require("../services/cantos");

describe("cantos icons", () => {
  it("returns the configured emoji for each known canto", () => {
    expect(cantos.icon("Trivilin")).toBe("🎺");
    expect(cantos.icon("Chiguire")).toBe("🦫");
    expect(cantos.icon("Patrulla")).toBe("🚓");
  });

  it("falls back to a default for unknown names", () => {
    expect(cantos.icon("Mystery")).toBe("🎵");
  });

  it("withIcon prepends the icon", () => {
    expect(cantos.withIcon("Trivilin")).toBe("🎺 Trivilin");
  });
});
