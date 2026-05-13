// Stats: unit-test the renderer because it's pure. The fetcher hits DB
// (covered by integration smoke). statsView.escapeHtml is the security
// surface we want to pin.
const { render, escapeHtml } = require("../services/statsView");

describe("statsView.escapeHtml", () => {
  it("escapes &, <, >, \", '", () => {
    expect(escapeHtml(`<script>alert("hi")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("handles null/undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("statsView.render", () => {
  const sampleData = {
    now: "2026-05-13T20:00:00.000Z",
    top: [
      { first_name: "A", username: "a", win: 5, win_custom: 2, finished: 10, caida: 3 },
    ],
    groups: { total: 3, public_count: 1, paid_active: 2 },
    gamesInFlight: 0,
    eventsByType: [{ event_type: "card_played", c: 42 }],
    eventsTotal24h: 42,
    users: { total: 7, banned: 0 },
    cardsBootstrapped: 40,
    cardsTotal: 40,
  };

  it("returns an HTML string", () => {
    const html = render(sampleData);
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain("CaidaVZLABot");
    expect(html).toContain("Top 10 jugadores");
  });

  it("renders KPI numbers", () => {
    const html = render(sampleData);
    expect(html).toContain(">3<"); // total groups
    expect(html).toContain(">7<"); // total users
    expect(html).toContain(">42<"); // events
  });

  it("renders the leaderboard row with computed win rate", () => {
    const html = render(sampleData);
    expect(html).toContain(">A<");
    expect(html).toContain("@a");
    expect(html).toMatch(/70%/); // (5+2)/10 = 70%
  });

  it("escapes HTML injection in player names", () => {
    const data = {
      ...sampleData,
      top: [
        { first_name: "<img src=x onerror=alert(1)>", username: "x", win: 1, win_custom: 0, finished: 1, caida: 0 },
      ],
    };
    const html = render(data);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });

  it("renders cards bootstrap bar percentage", () => {
    const html = render({ ...sampleData, cardsBootstrapped: 20, cardsTotal: 40 });
    expect(html).toContain("width:50%");
    expect(html).toContain("20 / 40");
  });

  it("shows empty-state for top players when none", () => {
    const html = render({ ...sampleData, top: [] });
    expect(html).toContain("Aún no hay jugadores");
  });
});
