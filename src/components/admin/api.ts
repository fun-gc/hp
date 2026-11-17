// 編集画面(/admin)から呼ぶ API(functions/api/admin → bot/admin/handler.mjs)と、受け取るデータの形。
import type { Member, ScheduleEvent } from "@/lib/schema";

export type AdminUser = { id: string; username: string; name: string; avatar: string };
export type Pull = { number: number; url: string } | null;

export type NewsData = { title: string; date: string; tags: string[] };
export type WorkData = {
  title: string;
  authors: string[];
  year?: number;
  month?: number;
  event?: string;
  order?: number;
  playUrl?: string;
  playLabel?: string;
  youtubeId?: string;
  thumbnail?: string;
  tags: string[];
};
export type MemberData = Partial<Member> & { discordId: string };

/** broken は読み込めなかったファイル(GitHub で直してもらう) */
type Item<T> = { key: string; oid: string; data: T; broken?: string };
export type NewsItem = Item<NewsData> & { body: string };
export type WorkItem = Item<WorkData> & { body: string };
export type MemberItem = Item<MemberData>;

export type Snapshot = {
  /** 読んだブランチ。確認待ちの PR があれば edit/<DiscordのユーザーID> */
  ref: string;
  pull: Pull;
  news: NewsItem[];
  works: WorkItem[];
  members: MemberItem[];
  schedule: { oid: string | null; items: ScheduleEvent[]; broken?: string };
};

export type Kind = "news" | "works" | "members" | "schedule";
export type SaveRequest = {
  kind: Kind;
  action?: "save" | "delete";
  key?: string;
  isNew?: boolean;
  /** 読み込んだときのファイルの oid。ほかの人が先に変えていたら保存を止めるのに使う */
  oid?: string | null;
  data?: unknown;
  body?: string;
  upload?: { base64: string };
};
export type SaveResult = { pull: Pull; unchanged: boolean; commit: string | null };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly conflict = false,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin/${path}`, { credentials: "same-origin", cache: "no-store", ...init });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // API が動いていない(next dev など)と HTML が返ってくる
  }
  const body = (data ?? {}) as { error?: string; conflict?: boolean };
  if (!res.ok) throw new ApiError(body.error ?? `うまくいきませんでした(${res.status})`, res.status, Boolean(body.conflict));
  if (data === null) throw new ApiError("API から返事がありませんでした", res.status);
  return data as T;
}

const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  session: () => request<{ user: AdminUser; missing: string[] }>("session"),
  content: () => request<Snapshot>("content"),
  save: (body: SaveRequest) => request<SaveResult>("save", post(body)),
  logout: () => request<{ ok: boolean }>("logout", post({})),
};
