import { initData } from "./lib/telegram";
import type {
  MeResponse,
  UserRow,
  GroupRow,
  PublicGroup,
  Paged,
} from "./types";

// Relative — works under /dashboard/ in dev and /caidavzlabot/ in
// prod, whichever path the SPA is served from.
const BASE = "api";

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function call<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    "X-Telegram-Init-Data": initData(),
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `http_${res.status}`);
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

// ─── User-tier ─────────────────────────────────────────────────────────
export const me = () => call<MeResponse>("GET", "me");

export const setMyNotify = (value: boolean) =>
  call<{ notify_on_turn: boolean }>("POST", "me/notify", { value });

export const leaderboard = (limit: number) =>
  call<{ rows: UserRow[]; limit: number }>("GET", `leaderboard?limit=${limit}`);

export const publicGroups = () =>
  call<{ rows: PublicGroup[] }>("GET", "groups/public");

// ─── Admin-tier ────────────────────────────────────────────────────────
export interface ListParams {
  page: number;
  pageSize: number;
  sort: string;
  q: string;
}

const qs = (p: ListParams) =>
  new URLSearchParams({
    page: String(p.page),
    pageSize: String(p.pageSize),
    sort: p.sort,
    q: p.q,
  }).toString();

export const listGroups = (p: ListParams) =>
  call<Paged<GroupRow>>("GET", `groups?${qs(p)}`);

export const listUsers = (p: ListParams) =>
  call<Paged<UserRow>>("GET", `users?${qs(p)}`);

export const setGroupPublic = (id: string, value: boolean) =>
  call<GroupRow>("POST", `groups/${encodeURIComponent(id)}/public`, { value });

export const setGroupBanned = (id: string, value: boolean) =>
  call<GroupRow>("POST", `groups/${encodeURIComponent(id)}/banned`, { value });

export const extendGroupPaid = (id: string, months: number) =>
  call<GroupRow>("POST", `groups/${encodeURIComponent(id)}/paid`, { months });

export const renameGroup = (id: string, name: string) =>
  call<GroupRow>("POST", `groups/${encodeURIComponent(id)}/rename`, { name });

export const deleteGroup = (id: string) =>
  call<{ ok: boolean }>("DELETE", `groups/${encodeURIComponent(id)}`);

export const setUserBanned = (id: string, value: boolean) =>
  call<UserRow>("POST", `users/${encodeURIComponent(id)}/banned`, { value });
