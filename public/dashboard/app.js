/* eslint-env browser */
/**
 * Caída — Telegram Web App SPA.
 *
 * Auth: window.Telegram.WebApp.initData (firmado por Telegram con el
 * bot token). Cada fetch lo manda en `X-Telegram-Init-Data`. El
 * backend verifica el HMAC y decide rol (admin | user).
 *
 * Tabs:
 *   👤 Mi cuenta       — todos
 *   🏆 Top             — todos
 *   🌐 Públicos        — todos
 *   📦 Grupos (admin)  — solo admin
 *   👥 Usuarios (admin)— solo admin
 */
(function () {
  "use strict";

  // ─── Diagnostics — live status visible from the get-go ──────────────
  // The index.html ships with a "loading" panel and three <li>s ready
  // to be filled in. We update them as the bootstrap progresses, then
  // hide the whole panel when the SPA renders successfully. If anything
  // throws midway, the panel stays — telling us exactly which step
  // failed without needing a remote console.
  function diag(id, text, kind) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = el.textContent.replace(/…|: .*$/, "") + ": " + text;
    if (kind === "ok") el.style.color = "#3fb950";
    else if (kind === "err") el.style.color = "#f85149";
  }
  function fatalError(msg) {
    const diagEl = document.getElementById("diag");
    if (diagEl) {
      diagEl.style.background = "#3a1517";
      diagEl.innerHTML =
        `<strong style="color:#f85149">Algo falló</strong>` +
        `<div style="margin-top:8px;color:#e6edf3;font-size:13px;word-break:break-word;">${msg}</div>` +
        `<div style="margin-top:10px;color:#8b949e;font-size:12px;">Tomá screenshot y mandalo en @CaidaVZLANews.</div>`;
    }
  }
  window.addEventListener("error", (e) => fatalError(e.message || "Error desconocido"));
  window.addEventListener("unhandledrejection", (e) =>
    fatalError((e.reason && e.reason.message) || String(e.reason)),
  );

  const tg = window.Telegram && window.Telegram.WebApp;
  diag("diag-sdk", tg ? "OK" : "no cargó", tg ? "ok" : "err");

  // If the SDK never loaded (no `Telegram.WebApp`) we're definitely
  // outside Telegram — show the banner and stop.
  if (!tg) {
    document.getElementById("not-in-telegram").hidden = false;
    return;
  }
  const hasInit = !!(tg.initData && tg.initData.length > 0);
  diag(
    "diag-init",
    hasInit ? "OK (" + tg.initData.length + " bytes)" : "vacía",
    hasInit ? "ok" : "err",
  );

  // We're inside Telegram. initData may still be empty in some edge
  // cases — we proceed and let the API surface a 401 with a clear msg.
  try { tg.ready(); } catch {/* tolerate */}
  try { tg.expand(); } catch {/* tolerate */}

  // Apply Telegram theme to our CSS vars when available.
  try { applyTheme(); } catch {/* fall back to defaults */}
  if (tg.onEvent) {
    try { tg.onEvent("themeChanged", applyTheme); } catch {/* tolerate */}
  }

  const API = "api";
  const PAGE_SIZE = 25;
  const SEARCH_DEBOUNCE_MS = 250;

  // Tabs metadata. Admin tabs are filtered out when role !== "admin".
  const TABS = [
    { id: "me", label: "👤 Mi cuenta", admin: false, title: "Mi cuenta" },
    { id: "top", label: "🏆 Top", admin: false, title: "Top global" },
    { id: "public", label: "🌐 Públicos", admin: false, title: "Grupos públicos" },
    { id: "groups", label: "📦 Grupos", admin: true, title: "Grupos (admin)" },
    { id: "users", label: "👥 Usuarios", admin: true, title: "Usuarios (admin)" },
  ];

  let myRole = "user";

  // ─── HTTP ────────────────────────────────────────────────────────────
  async function api(method, path, body) {
    const opts = {
      method,
      headers: { "X-Telegram-Init-Data": tg.initData },
    };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${API}/${path}`, opts);
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || `http_${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────
  function applyTheme() {
    const p = tg.themeParams || {};
    const setVar = (k, v) => v && document.documentElement.style.setProperty(k, v);
    setVar("--bg", p.bg_color);
    setVar("--bg-card", p.secondary_bg_color);
    setVar("--text", p.text_color);
    setVar("--text-muted", p.hint_color);
    setVar("--accent", p.button_color);
    setVar("--accent-text", p.button_text_color);
    setVar("--link", p.link_color);
  }

  let toastTimer = null;
  function toast(msg, kind = "ok") {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className = `toast ${kind}`;
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2500);
    if (kind === "err" && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
    if (kind === "ok" && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
  }

  function debounce(fn, ms) {
    let t = null;
    return function (...a) { if (t) clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtDate(d) {
    if (!d) return "—";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toISOString().slice(0, 10);
  }

  function badge(text, kind) { return `<span class="badge ${kind}">${text}</span>`; }
  function yesno(v) { return v ? badge("✓", "ok") : badge("—", "no"); }
  function bannedBadge(v) { return v ? badge("🚫", "banned") : badge("OK", "ok"); }
  // CPU users live in public.user with synthetic ids "cpu_easy" |
  // "cpu_medium" | "cpu_pro" (seeded in migrations). They behave like
  // regular users in stats queries but we don't let admins ban them
  // and we tag them visually so they don't look like normal humans.
  function isCpu(u) { return !!(u && u.id_user && String(u.id_user).startsWith("cpu_")); }
  function cpuBadge() { return `<span class="badge cpu">🤖 CPU</span>`; }

  function displayName(u) {
    const parts = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
    return parts || (u.username ? "@" + u.username : String(u.id_user || u.id || ""));
  }

  function pager(containerId, page, totalPages, onChange) {
    const el = document.getElementById(containerId);
    if (totalPages <= 1) { el.innerHTML = ""; return; }
    el.innerHTML = `
      <button ${page <= 1 ? "disabled" : ""} data-p="${page - 1}">◀</button>
      <span>${page} / ${totalPages}</span>
      <button ${page >= totalPages ? "disabled" : ""} data-p="${page + 1}">▶</button>
    `;
    el.querySelectorAll("button[data-p]").forEach((btn) => {
      btn.addEventListener("click", () => onChange(parseInt(btn.dataset.p, 10)));
    });
  }

  function modal(html, onConfirm) {
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.innerHTML = `<div class="modal">${html}</div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector("[data-cancel]")?.addEventListener("click", close);
    wrap.querySelector("[data-confirm]")?.addEventListener("click", async () => {
      try { await onConfirm(wrap); close(); } catch (err) { toast(err.message || "error", "err"); }
    });
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    return wrap;
  }

  // ─── Mi cuenta ───────────────────────────────────────────────────────
  async function loadMe() {
    let me;
    try { me = await api("GET", "me"); }
    catch (err) { toast("Error: " + err.message, "err"); return; }
    myRole = me.role;
    const handle = me.telegram.username ? "@" + me.telegram.username : displayName(me.telegram);
    document.getElementById("who").textContent =
      me.role === "admin" ? `${handle} · admin` : handle;

    const u = me.user || {};
    const finished = Number(u.finished) || 0;
    const win = Number(u.win) || 0;
    const winCustom = Number(u.win_custom) || 0;
    const winRate = finished > 0 ? Math.round((100 * (win + winCustom)) / finished) : 0;
    const caida = Number(u.caida) || 0;
    const caido = Number(u.caido) || 0;
    document.getElementById("me-kpis").innerHTML = `
      ${kpi("Partidas", finished)}
      ${kpi("Wins", win)}
      ${kpi("Win custom", winCustom)}
      ${kpi("Win rate", winRate + "%")}
      ${kpi("Caídas dadas", caida)}
      ${kpi("Caídas recibidas", caido)}
    `;

    const SINGS = [
      ["ronda", "Ronda"], ["chiguire", "Chigüire"], ["patrulla", "Patrulla"],
      ["vigia", "Vigía"], ["registro", "Registro"], ["maguaro", "Maguaro"],
      ["registrico", "Registrico"], ["casa_chica", "Casa chica"],
      ["casa_grande", "Casa grande"], ["trivilin", "Trivilín"],
    ];
    const singHtml = SINGS.map(([k, label]) => {
      const total = Number(u[k]) || 0;
      const alive = Number(u["alive_" + k]) || 0;
      return `<div class="sing-row"><span>${label}</span><span class="cell-mono">${alive} / ${total}</span></div>`;
    }).join("");
    document.getElementById("me-sings").innerHTML = singHtml || `<p class="muted">Aún no has cantado nada — jugá una partida primero.</p>`;

    const notify = document.getElementById("me-notify");
    notify.checked = !!u.notify_on_turn;
    notify.onchange = async () => {
      try {
        const r = await api("POST", "me/notify", { value: notify.checked });
        toast(r.notify_on_turn ? "Notificaciones activadas" : "Notificaciones desactivadas");
      } catch (err) {
        toast("Error: " + err.message, "err");
        notify.checked = !notify.checked;
      }
    };

    // Reveal admin tabs if applicable. This runs after auth confirms role.
    renderTabs();
  }

  function kpi(label, value) {
    return `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>`;
  }

  // ─── Top ─────────────────────────────────────────────────────────────
  async function loadTop() {
    const limit = parseInt(document.getElementById("top-limit").value, 10) || 25;
    let r;
    try { r = await api("GET", `leaderboard?limit=${limit}`); }
    catch (err) { toast("Error: " + err.message, "err"); return; }
    document.getElementById("top-body").innerHTML = r.rows.length
      ? r.rows.map((u, i) => `
          <tr>
            <td class="cell-mono">${i + 1}</td>
            <td>
              ${escapeHtml(displayName(u))}
              ${isCpu(u) ? cpuBadge() : ""}
              ${u.username ? `<small class="muted"> @${escapeHtml(u.username)}</small>` : ""}
            </td>
            <td>${Number(u.finished) || 0}</td>
            <td>${Number(u.win) || 0}</td>
            <td>${Number(u.win_custom) || 0}</td>
            <td>${Number(u.caida) || 0}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">Aún no hay datos</td></tr>`;
  }

  // ─── Grupos públicos ─────────────────────────────────────────────────
  async function loadPublic() {
    let r;
    try { r = await api("GET", "groups/public"); }
    catch (err) { toast("Error: " + err.message, "err"); return; }
    const el = document.getElementById("public-list");
    if (!r.rows.length) {
      el.innerHTML = `<p class="muted" style="text-align:center;padding:32px">No hay grupos públicos.</p>`;
      return;
    }
    el.innerHTML = r.rows.map((g) => `
      <div class="card public-card">
        <div class="public-card-head">
          <strong>${escapeHtml(g.name)}</strong>
          <small class="muted">${Number(g.games_played) || 0} partidas</small>
        </div>
        ${g.invite
          ? `<button class="btn" data-link="${escapeHtml(g.invite)}">Unirme al grupo</button>`
          : `<span class="muted">Link no disponible</span>`}
      </div>
    `).join("");
    el.querySelectorAll("button[data-link]").forEach((b) => {
      b.addEventListener("click", () => tg.openTelegramLink(b.dataset.link));
    });
  }

  // ─── Grupos (admin) ──────────────────────────────────────────────────
  const groupsState = { page: 1, sort: "name", q: "" };

  async function loadGroups() {
    if (myRole !== "admin") return;
    const params = new URLSearchParams({
      page: String(groupsState.page),
      pageSize: String(PAGE_SIZE),
      sort: groupsState.sort,
      q: groupsState.q,
    });
    let r;
    try { r = await api("GET", `groups?${params}`); }
    catch (err) { toast("Error: " + err.message, "err"); return; }
    document.getElementById("groups-summary").textContent =
      `${r.total} grupo${r.total === 1 ? "" : "s"}`;
    const body = document.getElementById("groups-body");
    body.innerHTML = r.rows.length
      ? r.rows.map(groupRow).join("")
      : `<tr><td colspan="7" class="muted" style="text-align:center;padding:32px">Sin resultados</td></tr>`;
    bindGroupActions(body);
    pager("groups-pager", r.page, r.totalPages, (p) => { groupsState.page = p; loadGroups(); });
  }

  function groupRow(g) {
    const id = escapeHtml(g.id_group);
    return `
      <tr data-id="${id}">
        <td>${escapeHtml(g.name || "(sin nombre)")}</td>
        <td class="cell-mono">${id}</td>
        <td>${yesno(g.public)}</td>
        <td>${bannedBadge(g.is_banned)}</td>
        <td class="cell-mono">${fmtDate(g.paid_up_to)}</td>
        <td>${Number(g.games_played) || 0}</td>
        <td class="col-actions">
          <button class="btn" data-action="public">${g.public ? "Quitar público" : "Hacer público"}</button>
          <button class="btn" data-action="banned">${g.is_banned ? "Desbanear" : "Banear"}</button>
          <button class="btn" data-action="paid">+ mes</button>
          <button class="btn" data-action="rename">Renombrar</button>
          <button class="btn btn-danger" data-action="delete">Eliminar</button>
        </td>
      </tr>
    `;
  }

  function bindGroupActions(body) {
    body.querySelectorAll("tr[data-id]").forEach((tr) => {
      const id = tr.dataset.id;
      tr.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => groupAction(id, btn.dataset.action, tr));
      });
    });
  }

  async function groupAction(id, action, tr) {
    try {
      if (action === "public") {
        const current = tr.querySelector("td:nth-child(3) .badge").classList.contains("ok");
        await api("POST", `groups/${encodeURIComponent(id)}/public`, { value: !current });
        toast(current ? "Ya no es público" : "Ahora es público");
        loadGroups();
      } else if (action === "banned") {
        const current = tr.querySelector("td:nth-child(4) .badge").classList.contains("banned");
        await api("POST", `groups/${encodeURIComponent(id)}/banned`, { value: !current });
        toast(current ? "Desbaneado" : "Baneado");
        loadGroups();
      } else if (action === "paid") {
        modal(
          `<h3>Extender pago — ${escapeHtml(id)}</h3>
           <input type="number" id="m-months" class="input" value="1" min="1" max="120" style="width:100%" />
           <div class="modal-actions">
             <button class="btn" data-cancel>Cancelar</button>
             <button class="btn btn-primary" data-confirm>Aplicar</button>
           </div>`,
          async (wrap) => {
            const months = parseInt(wrap.querySelector("#m-months").value, 10);
            if (!Number.isInteger(months) || months <= 0) throw new Error("meses inválidos");
            await api("POST", `groups/${encodeURIComponent(id)}/paid`, { months });
            toast(`+${months} mes(es)`);
            loadGroups();
          },
        );
      } else if (action === "rename") {
        const cur = tr.querySelector("td:nth-child(1)").textContent;
        modal(
          `<h3>Renombrar — ${escapeHtml(id)}</h3>
           <input type="text" id="m-name" class="input" value="${escapeHtml(cur)}" style="width:100%" />
           <div class="modal-actions">
             <button class="btn" data-cancel>Cancelar</button>
             <button class="btn btn-primary" data-confirm>Guardar</button>
           </div>`,
          async (wrap) => {
            const name = wrap.querySelector("#m-name").value.trim();
            if (!name) throw new Error("nombre vacío");
            await api("POST", `groups/${encodeURIComponent(id)}/rename`, { name });
            toast("Renombrado");
            loadGroups();
          },
        );
      } else if (action === "delete") {
        modal(
          `<h3>¿Eliminar grupo?</h3>
           <p>Se borra la fila <code>${escapeHtml(id)}</code>. Las stats de usuarios no se tocan.</p>
           <div class="modal-actions">
             <button class="btn" data-cancel>Cancelar</button>
             <button class="btn btn-danger" data-confirm>Eliminar</button>
           </div>`,
          async () => {
            await api("DELETE", `groups/${encodeURIComponent(id)}`);
            toast("Grupo eliminado");
            loadGroups();
          },
        );
      }
    } catch (err) { toast(err.message || "error", "err"); }
  }

  // ─── Usuarios (admin) ────────────────────────────────────────────────
  const usersState = { page: 1, sort: "name", q: "" };

  async function loadUsers() {
    if (myRole !== "admin") return;
    const params = new URLSearchParams({
      page: String(usersState.page),
      pageSize: String(PAGE_SIZE),
      sort: usersState.sort,
      q: usersState.q,
    });
    let r;
    try { r = await api("GET", `users?${params}`); }
    catch (err) { toast("Error: " + err.message, "err"); return; }
    document.getElementById("users-summary").textContent =
      `${r.total} usuario${r.total === 1 ? "" : "s"}`;
    const body = document.getElementById("users-body");
    body.innerHTML = r.rows.length
      ? r.rows.map(userRow).join("")
      : `<tr><td colspan="8" class="muted" style="text-align:center;padding:32px">Sin resultados</td></tr>`;
    bindUserActions(body);
    pager("users-pager", r.page, r.totalPages, (p) => { usersState.page = p; loadUsers(); });
  }

  function userRow(u) {
    const cpu = isCpu(u);
    const name = displayName(u);
    const handle = u.username ? "@" + u.username : "—";
    return `
      <tr data-id="${escapeHtml(u.id_user)}">
        <td>${escapeHtml(name)} ${cpu ? cpuBadge() : ""}</td>
        <td>${escapeHtml(handle)}</td>
        <td class="cell-mono">${escapeHtml(u.id_user)}</td>
        <td>${Number(u.finished) || 0}</td>
        <td>${Number(u.win) || 0}</td>
        <td class="cell-mono">${Number(u.caida) || 0}↑/${Number(u.caido) || 0}↓</td>
        <td>${cpu ? badge("—", "no") : bannedBadge(u.is_banned)}</td>
        <td class="col-actions">
          ${cpu
            ? `<span class="muted" style="font-size:11px">no aplica</span>`
            : `<button class="btn" data-action="banned">${u.is_banned ? "Desbanear" : "Banear"}</button>`
          }
        </td>
      </tr>
    `;
  }

  function bindUserActions(body) {
    body.querySelectorAll("tr[data-id]").forEach((tr) => {
      const id = tr.dataset.id;
      tr.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => userAction(id, btn.dataset.action, tr));
      });
    });
  }

  async function userAction(id, action, tr) {
    try {
      if (action === "banned") {
        const current = tr.querySelector("td:nth-child(7) .badge").classList.contains("banned");
        await api("POST", `users/${encodeURIComponent(id)}/banned`, { value: !current });
        toast(current ? "Desbaneado" : "Baneado");
        loadUsers();
      }
    } catch (err) { toast(err.message || "error", "err"); }
  }

  // ─── Tabs ────────────────────────────────────────────────────────────
  const tabLoaded = {};

  function renderTabs() {
    const visible = TABS.filter((t) => !t.admin || myRole === "admin");
    const nav = document.getElementById("tabs");
    nav.innerHTML = visible.map((t) =>
      `<button class="tab" data-tab="${t.id}">${t.label}</button>`
    ).join("");
    nav.querySelectorAll(".tab").forEach((b) => {
      b.addEventListener("click", () => activateTab(b.dataset.tab));
    });
    // Initial tab from URL hash, falling back to first.
    const hashTab = (location.hash || "").slice(1);
    activateTab(visible.some((t) => t.id === hashTab) ? hashTab : visible[0].id);
  }

  function activateTab(id) {
    const meta = TABS.find((t) => t.id === id);
    if (!meta) return;
    document.querySelectorAll(".tab").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === id)
    );
    TABS.forEach((t) => {
      const panel = document.getElementById("tab-" + t.id);
      if (panel) panel.hidden = t.id !== id;
    });
    document.getElementById("page-title").textContent = meta.title;
    history.replaceState(null, "", "#" + id);

    if (!tabLoaded[id]) {
      tabLoaded[id] = true;
      if (id === "me") loadMe();
      else if (id === "top") loadTop();
      else if (id === "public") loadPublic();
      else if (id === "groups") loadGroups();
      else if (id === "users") loadUsers();
    }
  }

  // ─── Boot ────────────────────────────────────────────────────────────
  // If DOMContentLoaded already fired (script is at end of body), run
  // immediately. Otherwise wait.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  async function boot() {
    // Toolbar handlers.
    document.getElementById("top-limit").addEventListener("change", loadTop);

    const debouncedGroups = debounce(() => { groupsState.page = 1; loadGroups(); }, SEARCH_DEBOUNCE_MS);
    const debouncedUsers = debounce(() => { usersState.page = 1; loadUsers(); }, SEARCH_DEBOUNCE_MS);
    document.getElementById("groups-q").addEventListener("input", (e) => { groupsState.q = e.target.value; debouncedGroups(); });
    document.getElementById("groups-sort").addEventListener("change", (e) => { groupsState.sort = e.target.value; groupsState.page = 1; loadGroups(); });
    document.getElementById("users-q").addEventListener("input", (e) => { usersState.q = e.target.value; debouncedUsers(); });
    document.getElementById("users-sort").addEventListener("change", (e) => { usersState.sort = e.target.value; usersState.page = 1; loadUsers(); });

    // Always start by loading /me — sets role and lets us decide tabs.
    try {
      diag("diag-fetch", "fetching…");
      await loadMe();
      diag("diag-fetch", "OK", "ok");
      // Success — hide the diag panel and reveal the app.
      const diagEl = document.getElementById("diag");
      if (diagEl) diagEl.hidden = true;
      document.getElementById("app").hidden = false;
    } catch (err) {
      diag("diag-fetch", "FAIL — " + (err.message || "?"), "err");
      fatalError(
        (err.message || "no se pudo cargar tu cuenta") +
          (err.status ? ` (HTTP ${err.status})` : ""),
      );
    }
  }
})();
