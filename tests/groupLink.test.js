const { resolveGroupLink } = require("../services/groupLink");

describe("resolveGroupLink", () => {
  it("prefers the public @username link (no admin rights needed)", async () => {
    const bot = {
      getChat: async () => ({ username: "matazon", invite_link: "https://t.me/+priv" }),
    };
    expect(await resolveGroupLink(bot, -100)).toBe("https://t.me/matazon");
  });

  it("uses the primary invite_link for a private group the bot administers", async () => {
    const bot = { getChat: async () => ({ invite_link: "https://t.me/+ygHvVJug" }) };
    expect(await resolveGroupLink(bot, -100)).toBe("https://t.me/+ygHvVJug");
  });

  it("exports an invite link when getChat exposes neither", async () => {
    let exported = false;
    const bot = {
      getChat: async () => ({}),
      exportChatInviteLink: async () => {
        exported = true;
        return "https://t.me/+exported";
      },
    };
    expect(await resolveGroupLink(bot, -100)).toBe("https://t.me/+exported");
    expect(exported).toBe(true);
  });

  it("returns null when the bot lacks rights to make a link", async () => {
    const bot = {
      getChat: async () => ({}),
      exportChatInviteLink: async () => {
        throw new Error("ETELEGRAM: 400 Bad Request: not enough rights to manage chat invite link");
      },
    };
    expect(await resolveGroupLink(bot, -100)).toBe(null);
  });

  it("falls back to export when getChat throws", async () => {
    const bot = {
      getChat: async () => {
        throw new Error("chat not found");
      },
      exportChatInviteLink: async () => "https://t.me/+recovered",
    };
    expect(await resolveGroupLink(bot, -100)).toBe("https://t.me/+recovered");
  });
});
