import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "./api";
import { getWebApp } from "./lib/telegram";
import { t } from "./lib/i18n";
import type { Dict } from "./lib/i18n.dict";
import { displayName } from "./lib/format";
import { MeTab } from "./tabs/MeTab";
import { TopTab } from "./tabs/TopTab";
import { PublicTab } from "./tabs/PublicTab";
import { GroupsTab } from "./tabs/GroupsTab";
import { UsersTab } from "./tabs/UsersTab";
import { GameTab } from "./game/GameTab";

// Lazy: keeps Chart.js out of the main bundle — only admins who open Stats
// download it.
const StatsTab = lazy(() =>
  import("./tabs/StatsTab").then((m) => ({ default: m.StatsTab })),
);

type TabId = "play" | "me" | "top" | "public" | "groups" | "users" | "stats";

interface TabMeta {
  id: TabId;
  labelKey: keyof Dict;
  titleKey: keyof Dict;
  admin: boolean;
}

const TABS: TabMeta[] = [
  { id: "play", labelKey: "app.tab.play", titleKey: "app.title.play", admin: false },
  { id: "me", labelKey: "app.tab.me", titleKey: "app.title.me", admin: false },
  { id: "top", labelKey: "app.tab.top", titleKey: "app.title.top", admin: false },
  { id: "public", labelKey: "app.tab.public", titleKey: "app.title.public", admin: false },
  { id: "groups", labelKey: "app.tab.groups", titleKey: "app.title.groups", admin: true },
  { id: "users", labelKey: "app.tab.users", titleKey: "app.title.users", admin: true },
  { id: "stats", labelKey: "app.tab.stats", titleKey: "app.title.stats", admin: true },
];

export default function App() {
  // If we're truly outside Telegram (no SDK at all), there's nothing
  // to authenticate against. Show the banner and stop.
  if (!getWebApp()) return <OutsideTelegram />;

  const me = useQuery({ queryKey: ["me"], queryFn: api.me });

  const visibleTabs = useMemo(
    () => TABS.filter((t) => !t.admin || me.data?.role === "admin"),
    [me.data?.role],
  );

  const [tab, setTab] = useState<TabId>(() => {
    const hash = (location.hash || "").slice(1) as TabId;
    if (["play", "me", "top", "public", "groups", "users", "stats"].includes(hash)) return hash;
    // Deep-linked into a game (startapp=<code>) → land on the play tab.
    return getWebApp()?.initDataUnsafe?.start_param ? "play" : "me";
  });

  // Keep URL hash in sync so refreshing inside the WebApp keeps the tab.
  useEffect(() => {
    history.replaceState(null, "", "#" + tab);
  }, [tab]);

  // If role changes and the active tab becomes invisible, fall back.
  useEffect(() => {
    if (!visibleTabs.find((t) => t.id === tab) && visibleTabs.length > 0) {
      setTab(visibleTabs[0].id);
    }
  }, [visibleTabs, tab]);

  if (me.isLoading) {
    return <Loading message={t("app.loadingAccount")} />;
  }
  if (me.isError) {
    const err = me.error as Error;
    return <Loading message={"Error: " + err.message} kind="err" />;
  }
  if (!me.data) return null;

  const tabMeta = TABS.find((t) => t.id === tab)!;
  const handle = me.data.telegram.username
    ? "@" + me.data.telegram.username
    : displayName(me.data.telegram);
  const who = me.data.role === "admin" ? `${handle}${t("app.adminSuffix")}` : handle;

  return (
    <main>
      <header className="topbar">
        <div className="topbar-inner">
          <h1>{t(tabMeta.titleKey)}</h1>
          <span className="muted">{who}</span>
        </div>
        <nav className="tabs">
          {visibleTabs.map((tm) => (
            <button
              key={tm.id}
              className={`tab ${tm.id === tab ? "active" : ""}`}
              onClick={() => setTab(tm.id)}
            >
              {t(tm.labelKey)}
            </button>
          ))}
        </nav>
      </header>

      {tab === "play" && <GameTab youId={me.data.telegram.id} />}
      {tab === "me" && <MeTab me={me.data} />}
      {tab === "top" && <TopTab />}
      {tab === "public" && <PublicTab />}
      {tab === "groups" && me.data.role === "admin" && <GroupsTab />}
      {tab === "users" && me.data.role === "admin" && <UsersTab />}
      {tab === "stats" && me.data.role === "admin" && (
        <Suspense
          fallback={<p className="muted" style={{ padding: 16 }}>{t("app.loading")}</p>}
        >
          <StatsTab />
        </Suspense>
      )}
    </main>
  );
}

function Loading({ message, kind = "ok" }: { message: string; kind?: "ok" | "err" }) {
  return (
    <div className="banner" style={{ margin: "24px auto" }}>
      <h2 style={{ color: kind === "err" ? "var(--danger)" : undefined }}>
        {kind === "err" ? t("app.loadFailed") : t("app.brand")}
      </h2>
      <p>{message}</p>
      {kind === "err" && (
        <p className="muted">
          {t("app.screenshotHint")}
        </p>
      )}
    </div>
  );
}

function OutsideTelegram() {
  return (
    <div className="banner" style={{ margin: "24px auto" }}>
      <h2>{t("app.outside.title")}</h2>
      <p>{t("app.outside.body")}</p>
    </div>
  );
}
