/* eslint-env browser */
/**
 * CaidaVZLA admin dashboard — single-file SPA.
 *
 * Two views (groups / users), debounced search, server-side pagination,
 * inline action buttons. No build step; no framework.
 */
(function () {
  "use strict";

  const API = "api"; // relative to current page (/dashboard/)
  const PAGE_SIZE = 25;
  const SEARCH_DEBOUNCE_MS = 250;

  // ─── HTTP ─────────────────────────────────────────────────────────────
  async function api(method, path, body) {
    const opts = {
      method,
      credentials: "same-origin",
      headers: {},
    };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${API}/${path}`, opts);
    if (res.status === 401) {
      window.location.href = "login.html";
      throw new Error("unauthorized");
    }
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

  // ─── toast ────────────────────────────────────────────────────────────
  let toastTimer = null;
  function toast(msg, kind = "ok") {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className = `toast ${kind}`;
    el.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 2500);
  }

  // ─── helpers ──────────────────────────────────────────────────────────
  function debounce(fn, ms) {
    let t = null;
    return function (...args) {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtDate(d) {
    if (!d) return "—";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toISOString().slice(0, 10);
  }

  function badge(text, kind) {
    return `<span class="badge ${kind}">${text}</span>`;
  }

  function yesno(v) {
    return v ? badge("✓ Sí", "ok") : badge("No", "no");
  }

  function bannedBadge(v) {
    return v ? badge("🚫 Banned", "banned") : badge("OK", "ok");
  }

  function pager(containerId, page, totalPages, onChange) {
    const el = document.getElementById(containerId);
    if (totalPages <= 1) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = `
      <button ${page <= 1 ? "disabled" : ""} data-p="${page - 1}">◀</button>
      <span>página ${page} / ${totalPages}</span>
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
      try {
        await onConfirm(wrap);
        close();
      } catch (err) {
        toast(err.message || "error", "err");
      }
    });
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) close();
    });
    return wrap;
  }

  // ─── Groups view ──────────────────────────────────────────────────────
  const groupsState = { page: 1, sort: "name", q: "" };

  async function loadGroups() {
    const params = new URLSearchParams({
      page: String(groupsState.page),
      pageSize: String(PAGE_SIZE),
      sort: groupsState.sort,
      q: groupsState.q,
    });
    let r;
    try {
      r = await api("GET", `groups?${params}`);
    } catch (err) {
      if (err.message !== "unauthorized") toast("Error cargando grupos: " + err.message, "err");
      return;
    }
    document.getElementById("groups-summary").textContent =
      `${r.total} grupo${r.total === 1 ? "" : "s"}`;
    const body = document.getElementById("groups-body");
    if (!r.rows.length) {
      body.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center;padding:32px">Sin resultados.</td></tr>`;
    } else {
      body.innerHTML = r.rows.map(renderGroupRow).join("");
      bindGroupRowActions(body);
    }
    pager("groups-pager", r.page, r.totalPages, (p) => {
      groupsState.page = p;
      loadGroups();
    });
  }

  function renderGroupRow(g) {
    const id = escapeHtml(g.id_group);
    return `
      <tr data-id="${id}">
        <td>${escapeHtml(g.name || "(sin nombre)")}</td>
        <td class="cell-mono">${id}</td>
        <td>${yesno(g.public)}</td>
        <td>${bannedBadge(g.is_banned)}</td>
        <td class="cell-mono">${fmtDate(g.paid_up_to)}</td>
        <td>${Number(g.games_played) || 0}</td>
        <td class="cell-mono">${fmtDate(g.created_at)}</td>
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

  function bindGroupRowActions(body) {
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
        const current = tr.querySelector('td:nth-child(3) .badge').classList.contains("ok");
        await api("POST", `groups/${encodeURIComponent(id)}/public`, { value: !current });
        toast(current ? "Grupo ya no es público" : "Grupo ahora es público");
        loadGroups();
      } else if (action === "banned") {
        const current = tr.querySelector('td:nth-child(4) .badge').classList.contains("banned");
        await api("POST", `groups/${encodeURIComponent(id)}/banned`, { value: !current });
        toast(current ? "Grupo desbaneado" : "Grupo baneado");
        loadGroups();
      } else if (action === "paid") {
        modal(
          `<h3>Extender pago — ${escapeHtml(id)}</h3>
           <p class="muted">Cantidad de meses a sumar:</p>
           <input type="number" id="m-months" class="input" value="1" min="1" max="120" style="width:100%" />
           <div class="modal-actions">
             <button class="btn btn-ghost" data-cancel>Cancelar</button>
             <button class="btn" data-confirm>Aplicar</button>
           </div>`,
          async (wrap) => {
            const months = parseInt(wrap.querySelector("#m-months").value, 10);
            if (!Number.isInteger(months) || months <= 0) throw new Error("meses inválidos");
            await api("POST", `groups/${encodeURIComponent(id)}/paid`, { months });
            toast(`Pago extendido +${months} mes(es)`);
            loadGroups();
          },
        );
      } else if (action === "rename") {
        const cur = tr.querySelector("td:nth-child(1)").textContent;
        modal(
          `<h3>Renombrar — ${escapeHtml(id)}</h3>
           <input type="text" id="m-name" class="input" value="${escapeHtml(cur)}" style="width:100%" />
           <div class="modal-actions">
             <button class="btn btn-ghost" data-cancel>Cancelar</button>
             <button class="btn" data-confirm>Guardar</button>
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
           <p>Se borra la fila <code>${escapeHtml(id)}</code> de la tabla group. Las stats de usuarios no se tocan.</p>
           <div class="modal-actions">
             <button class="btn btn-ghost" data-cancel>Cancelar</button>
             <button class="btn btn-danger" data-confirm>Eliminar</button>
           </div>`,
          async () => {
            await api("DELETE", `groups/${encodeURIComponent(id)}`);
            toast("Grupo eliminado");
            loadGroups();
          },
        );
      }
    } catch (err) {
      toast(err.message || "error", "err");
    }
  }

  // ─── Users view ───────────────────────────────────────────────────────
  const usersState = { page: 1, sort: "name", q: "" };

  async function loadUsers() {
    const params = new URLSearchParams({
      page: String(usersState.page),
      pageSize: String(PAGE_SIZE),
      sort: usersState.sort,
      q: usersState.q,
    });
    let r;
    try {
      r = await api("GET", `users?${params}`);
    } catch (err) {
      if (err.message !== "unauthorized") toast("Error cargando usuarios: " + err.message, "err");
      return;
    }
    document.getElementById("users-summary").textContent =
      `${r.total} usuario${r.total === 1 ? "" : "s"}`;
    const body = document.getElementById("users-body");
    if (!r.rows.length) {
      body.innerHTML = `<tr><td colspan="9" class="muted" style="text-align:center;padding:32px">Sin resultados.</td></tr>`;
    } else {
      body.innerHTML = r.rows.map(renderUserRow).join("");
      bindUserRowActions(body);
    }
    pager("users-pager", r.page, r.totalPages, (p) => {
      usersState.page = p;
      loadUsers();
    });
  }

  function renderUserRow(u) {
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || "(sin nombre)";
    const handle = u.username ? "@" + u.username : "—";
    const caida = `${Number(u.caida) || 0}↑ / ${Number(u.caido) || 0}↓`;
    return `
      <tr data-id="${escapeHtml(u.id_user)}">
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(handle)}</td>
        <td class="cell-mono">${escapeHtml(u.id_user)}</td>
        <td>${Number(u.finished) || 0}</td>
        <td>${Number(u.win) || 0}</td>
        <td>${Number(u.win_custom) || 0}</td>
        <td class="cell-mono">${caida}</td>
        <td>${bannedBadge(u.is_banned)}</td>
        <td class="col-actions">
          <button class="btn" data-action="banned">${u.is_banned ? "Desbanear" : "Banear"}</button>
        </td>
      </tr>
    `;
  }

  function bindUserRowActions(body) {
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
        const current = tr.querySelector('td:nth-child(8) .badge').classList.contains("banned");
        await api("POST", `users/${encodeURIComponent(id)}/banned`, { value: !current });
        toast(current ? "Usuario desbaneado" : "Usuario baneado");
        loadUsers();
      }
    } catch (err) {
      toast(err.message || "error", "err");
    }
  }

  // ─── tabs ─────────────────────────────────────────────────────────────
  function activateTab(name) {
    document.querySelectorAll(".tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === name);
    });
    document.getElementById("tab-groups").hidden = name !== "groups";
    document.getElementById("tab-users").hidden = name !== "users";
    if (name === "groups" && !groupsState._loaded) {
      groupsState._loaded = true;
      loadGroups();
    }
    if (name === "users" && !usersState._loaded) {
      usersState._loaded = true;
      loadUsers();
    }
    history.replaceState(null, "", `#${name}`);
  }

  // ─── boot ─────────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", async () => {
    // who am I
    try {
      const me = await api("GET", "me");
      document.getElementById("who").textContent = `admin ${me.admin_id}`;
    } catch {
      /* already redirected if 401 */
    }

    document.getElementById("logout").addEventListener("click", async () => {
      await api("POST", "logout").catch(() => {});
      window.location.href = "login.html";
    });

    document.querySelectorAll(".tab").forEach((b) => {
      b.addEventListener("click", () => activateTab(b.dataset.tab));
    });

    const debouncedGroups = debounce(() => {
      groupsState.page = 1;
      loadGroups();
    }, SEARCH_DEBOUNCE_MS);
    const debouncedUsers = debounce(() => {
      usersState.page = 1;
      loadUsers();
    }, SEARCH_DEBOUNCE_MS);

    document.getElementById("groups-q").addEventListener("input", (e) => {
      groupsState.q = e.target.value;
      debouncedGroups();
    });
    document.getElementById("groups-sort").addEventListener("change", (e) => {
      groupsState.sort = e.target.value;
      groupsState.page = 1;
      loadGroups();
    });
    document.getElementById("users-q").addEventListener("input", (e) => {
      usersState.q = e.target.value;
      debouncedUsers();
    });
    document.getElementById("users-sort").addEventListener("change", (e) => {
      usersState.sort = e.target.value;
      usersState.page = 1;
      loadUsers();
    });

    // initial tab from URL hash
    const tab = (location.hash || "#groups").slice(1);
    activateTab(["groups", "users"].includes(tab) ? tab : "groups");
  });
})();
