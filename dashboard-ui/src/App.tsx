import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "./api";
import { getWebApp } from "./lib/telegram";
import { displayName } from "./lib/format";
import { MeTab } from "./tabs/MeTab";
import { TopTab } from "./tabs/TopTab";
import { PublicTab } from "./tabs/PublicTab";
import { GroupsTab } from "./tabs/GroupsTab";
import { UsersTab } from "./tabs/UsersTab";
import { GameTab } from "./game/GameTab";

type TabId = "play" | "me" | "top" | "public" | "groups" | "users";

interface TabMeta {
  id: TabId;
  label: string;
  title: string;
  admin: boolean;
}

const TABS: TabMeta[] = [
  { id: "play", label: "🎮 Jugar", title: "Jugar Caída", admin: false },
  { id: "me", label: "👤 Mi cuenta", title: "Mi cuenta", admin: false },
  { id: "top", label: "🏆 Top", title: "Top global", admin: false },
  { id: "public", label: "🌐 Públicos", title: "Grupos públicos", admin: false },
  { id: "groups", label: "📦 Grupos", title: "Grupos (admin)", admin: true },
  { id: "users", label: "👥 Usuarios", title: "Usuarios (admin)", admin: true },
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
    if (["play", "me", "top", "public", "groups", "users"].includes(hash)) return hash;
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
    return <Loading message="Cargando tu cuenta…" />;
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
  const who = me.data.role === "admin" ? `${handle} · admin` : handle;

  return (
    <main>
      <header className="topbar">
        <div className="topbar-inner">
          <h1>{tabMeta.title}</h1>
          <span className="muted">{who}</span>
        </div>
        <nav className="tabs">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              className={`tab ${t.id === tab ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
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
    </main>
  );
}

function Loading({ message, kind = "ok" }: { message: string; kind?: "ok" | "err" }) {
  return (
    <div className="banner" style={{ margin: "24px auto" }}>
      <h2 style={{ color: kind === "err" ? "var(--danger)" : undefined }}>
        {kind === "err" ? "Algo falló" : "Caída"}
      </h2>
      <p>{message}</p>
      {kind === "err" && (
        <p className="muted">
          Tomá screenshot y mandalo en @CaidaVZLANews.
        </p>
      )}
    </div>
  );
}

function OutsideTelegram() {
  return (
    <div className="banner" style={{ margin: "24px auto" }}>
      <h2>Abrime desde Telegram</h2>
      <p>
        Esta es una Telegram Web App. Buscá <strong>@CaidaVZLABot</strong> en
        Telegram y abrí la app desde el menú del bot.
      </p>
    </div>
  );
}
