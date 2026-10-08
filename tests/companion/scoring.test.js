const scoring = require("../../services/companion/scoring");

const { DEFAULT_CONFIG, opPoints, summarize, effectiveMode, slotOf, winningSlot } = scoring;

const cfg = (over = {}) => ({ ...DEFAULT_CONFIG, ...over });
const seat = (name) => ({ userId: name, name, guest: false });

describe("companion scoring", () => {
  it("defaults: Clásico values in parejas", () => {
    expect(DEFAULT_CONFIG).toMatchObject({
      points: 24,
      mesa: 4,
      caida: 1,
      ronda: 1,
      type: "parejas",
    });
    expect(DEFAULT_CONFIG.chiguire).toBe(0);
  });

  describe("effectiveMode / slotOf", () => {
    it("parejas only with type parejas AND 4 seated", () => {
      expect(effectiveMode(cfg(), 4)).toBe("parejas");
      expect(effectiveMode(cfg(), 3)).toBe("individual");
      expect(effectiveMode(cfg({ type: "individual" }), 4)).toBe("individual");
    });

    it("parejas folds opposite seats (0+2, 1+3); individual is 1:1", () => {
      expect([0, 1, 2, 3].map((p) => slotOf(p, "parejas"))).toEqual([0, 1, 0, 1]);
      expect([0, 1, 2, 3].map((p) => slotOf(p, "individual"))).toEqual([0, 1, 2, 3]);
    });
  });

  describe("opPoints", () => {
    it("caída = card value × caída multiplier", () => {
      expect(opPoints({ kind: "caida", value: 3 }, cfg())).toBe(3);
      expect(opPoints({ kind: "caida", value: 4 }, cfg({ caida: 2 }))).toBe(8);
    });

    it("ronda = card value × ronda multiplier", () => {
      expect(opPoints({ kind: "canto", canto: "ronda", value: 2 }, cfg())).toBe(2);
      expect(opPoints({ kind: "canto", canto: "ronda", value: 4 }, cfg({ ronda: 3 }))).toBe(12);
    });

    it("cantos take their configured value", () => {
      expect(opPoints({ kind: "canto", canto: "registro" }, cfg())).toBe(8);
      expect(opPoints({ kind: "canto", canto: "trivilin" }, cfg())).toBe(24);
      expect(opPoints({ kind: "canto", canto: "chiguire" }, cfg({ chiguire: 5 }))).toBe(5);
    });

    it("mesa limpia uses the mesa value; manual points count as typed", () => {
      expect(opPoints({ kind: "mesa" }, cfg())).toBe(4);
      // mala echada, pegado en mesa, cartas al final... one generic entry
      expect(opPoints({ kind: "puntos", value: 3 }, cfg())).toBe(3);
      expect(opPoints({ kind: "puntos", value: 99 }, cfg())).toBe(99);
    });

    it("rejects garbage and zero-value plays", () => {
      const bad = (op, c = cfg()) =>
        expect(() => opPoints(op, c)).toThrow(expect.objectContaining({ code: "bad_op" }));
      bad({ kind: "caida", value: 5 });
      bad({ kind: "caida", value: 0 });
      bad({ kind: "canto", canto: "ronda", value: 7 });
      bad({ kind: "canto", canto: "chiguire" }); // worth 0 in Clásico
      bad({ kind: "canto", canto: "nope" });
      bad({ kind: "puntos", value: 0 });
      bad({ kind: "puntos", value: 100 });
      bad({ kind: "puntos", value: 2.5 });
      bad({ kind: "tomadas", value: 3 }); // replaced by the generic "puntos"
      bad({ kind: "mesa" }, cfg({ mesa: 0 }));
      bad({ kind: "caida", value: 2 }, cfg({ caida: 0 }));
      bad({ kind: "hack" });
    });
  });

  describe("summarize", () => {
    const seats4 = [seat("A"), seat("B"), seat("C"), seat("D")];

    it("parejas: team totals, per-seat contributions", () => {
      const ops = [
        { kind: "caida", seat: 0, value: 3, points: 3 },
        { kind: "canto", seat: 2, canto: "registro", points: 8 },
        { kind: "mesa", seat: 1, points: 4 },
        { kind: "puntos", seat: 3, value: 2, points: 2 },
      ];
      const s = summarize({ seats: seats4, ops, config: cfg() });
      expect(s.mode).toBe("parejas");
      expect(s.slots).toEqual([
        { slot: 0, positions: [0, 2], total: 11 },
        { slot: 1, positions: [1, 3], total: 6 },
      ]);
      expect(s.perSeat[3]).toMatchObject({ manual: 2, points: 2 });
      expect(s.perSeat[0]).toMatchObject({ points: 3, caidas: 1, caidaPoints: 3 });
      expect(s.perSeat[2].cantos).toEqual({ registro: 1 });
      expect(s.perSeat[1].mesas).toBe(1);
    });

    it("3 seated with type parejas plays individual (one slot per seat)", () => {
      const s = summarize({
        seats: [seat("A"), null, seat("C"), seat("D")],
        ops: [{ kind: "mesa", seat: 3, points: 4 }],
        config: cfg(),
      });
      expect(s.mode).toBe("individual");
      expect(s.slots.map((x) => x.slot)).toEqual([0, 2, 3]);
      expect(s.slots.find((x) => x.slot === 3).total).toBe(4);
    });
  });

  it("winningSlot: the slot that reached the target", () => {
    const slots = [
      { slot: 0, positions: [0], total: 20 },
      { slot: 1, positions: [1], total: 24 },
    ];
    expect(winningSlot(slots, 24)).toBe(1);
    expect(winningSlot(slots, 25)).toBeNull();
  });

  it("sanitizeCompanionConfig keeps only scoring fields and clamps", () => {
    const out = scoring.sanitizeCompanionConfig({
      points: 999,
      mata_canto: "on",
      type: "parejas",
      hack: 1,
    });
    expect(out).toEqual({ points: 100, type: "parejas" });
  });
});
