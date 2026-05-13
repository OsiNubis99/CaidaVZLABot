const Card = require("../class/Card");

describe("Card", () => {
  it("maps number 0 to 1 de Oro", () => {
    const c = new Card(0);
    expect(c.value).toBe(1);
    expect(c.type).toBe("Oro");
    expect(c.position).toBe(0);
  });

  it("maps number 3 to 1 de Basto", () => {
    const c = new Card(3);
    expect(c.value).toBe(1);
    expect(c.type).toBe("Basto");
  });

  it("maps number 39 to 12 de Basto (Rey)", () => {
    const c = new Card(39);
    expect(c.value).toBe(12);
    expect(c.type).toBe("Basto");
    expect(c.position).toBe(9);
  });

  it("scores Sota/Caballo/Rey correctly", () => {
    expect(new Card(28).points).toBe(2); // value 10 -> 2
    expect(new Card(32).points).toBe(3); // value 11 -> 3
    expect(new Card(36).points).toBe(4); // value 12 -> 4
  });

  it("scores 1..7 as 1 point", () => {
    for (let n = 0; n < 28; n++) {
      expect(new Card(n).points).toBe(1);
    }
  });
});
