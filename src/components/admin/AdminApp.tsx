"use client";

// 編集画面(/admin)。FUNGC の Discord サーバーのメンバーが Discord でログインして、お知らせ・予定・メンバー・作品を編集する。
// 保存した内容は、編集した人ごとの PR(ブランチ edit/<DiscordのユーザーID>)に積まれ、運営がマージするとサイトに出る(docs/admin.md)。
import { useCallback, useEffect, useState } from "react";
import { Annot, Tri } from "@/components/Poster";
import { api, ApiError, type AdminUser, type Pull, type SaveRequest, type Snapshot } from "./api";
import { buttonClass } from "./fields";
import { MemberEditor } from "./MemberEditor";
import { NewsEditor } from "./NewsEditor";
import { ScheduleEditor } from "./ScheduleEditor";
import { WorkEditor } from "./WorkEditor";

type Phase =
  | { kind: "loading" }
  | { kind: "offline"; message: string }
  | { kind: "anon"; error: string | null }
  | { kind: "ready"; user: AdminUser; missing: string[] };

const LOGIN_ERRORS: Record<string, string> = {
  denied: "Discord でのログインがキャンセルされました。",
  state: "ログインの確認がうまくいきませんでした。もう一度ログインしてください。",
  "not-member": "FUNGC の Discord サーバーに参加している人だけがログインできます。サーバーに参加してから、もう一度お試しください。",
  setup: "サイトにログインの設定がまだありません。運営に知らせてください。",
  failed: "ログインできませんでした。少し時間をおいて、もう一度お試しください。",
};

const TABS = [
  { id: "news", ja: "お知らせ", en: "NEWS" },
  { id: "schedule", ja: "予定", en: "SCHEDULE" },
  { id: "members", ja: "メンバー", en: "MEMBERS" },
  { id: "works", ja: "作品", en: "WORKS" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function AdminApp() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    // Discord から戻ってきたときの ?error= を読んで、アドレスからは消しておく
    const error = new URLSearchParams(window.location.search).get("error");
    if (error) window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    api.session().then(
      ({ user, missing }) => setPhase({ kind: "ready", user, missing }),
      (err: unknown) => {
        if (err instanceof ApiError && err.status === 401) setPhase({ kind: "anon", error: error ? (LOGIN_ERRORS[error] ?? LOGIN_ERRORS.failed) : null });
        else setPhase({ kind: "offline", message: err instanceof Error ? err.message : String(err) });
      },
    );
  }, []);

  return (
    <div className="wrap py-14 sm:py-20">
      <div className="mb-12">
        <div className="flex items-center gap-3 text-muted" aria-hidden="true">
          <Tri className="size-3 text-ink" />
          <span className="text-xs font-medium tracking-[0.2em]">編集画面</span>
          <span className="h-px min-w-8 flex-1 bg-current opacity-50" />
          <Annot>MEMBERS ONLY</Annot>
        </div>
        <h1 className="poster-word mt-3 text-6xl sm:text-8xl">Admin</h1>
      </div>

      {phase.kind === "loading" && <p className="font-mono text-sm text-muted">LOADING…</p>}
      {phase.kind === "offline" && (
        <div className="max-w-2xl space-y-3 border-l-4 border-fun-red-ink bg-white/60 px-5 py-4">
          <p className="font-bold">編集画面の API につながりませんでした。</p>
          <p className="text-sm leading-relaxed text-muted">
            この画面は Cloudflare Pages の上(fungc.org やプレビュー)でだけ動きます。手元で試すときは、npm run build のあとに npx wrangler pages dev out を使ってください。({phase.message})
          </p>
        </div>
      )}
      {phase.kind === "anon" && <Login error={phase.error} />}
      {phase.kind === "ready" && <Editor user={phase.user} missing={phase.missing} onLogout={() => setPhase({ kind: "anon", error: null })} />}
    </div>
  );
}

function Login({ error }: { error: string | null }) {
  return (
    <section className="max-w-2xl space-y-7">
      <p className="leading-relaxed">
        FUNGC の Discord サーバーに参加している人は、Discord でログインすると、サイトのお知らせ・予定・メンバー・作品を編集できます。保存した内容は運営が確認してから、サイトに反映されます。
      </p>
      {error && (
        <p role="alert" className="border-l-4 border-fun-red-ink bg-white/60 px-4 py-3 text-sm font-bold">
          {error}
        </p>
      )}
      {/* API へのリンクなので、ページを移るふつうのリンクにする(next/link は使わない) */}
      <a href="/api/admin/login" className={buttonClass.primary}>
        DISCORD でログイン
      </a>
      <p className="text-xs leading-relaxed text-muted">Discord から受け取るのは、ユーザー名・表示名・アイコンだけです。ログインは 7 日間続きます。</p>
    </section>
  );
}

type Notice = { tone: "ok" | "error"; text: string; pull?: Pull; conflict?: boolean };

function Editor({ user, missing, onLogout }: { user: AdminUser; missing: string[]; onLogout: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [tab, setTab] = useState<Tab>(() => {
    const hash = window.location.hash.slice(1);
    return TABS.some((t) => t.id === hash) ? (hash as Tab) : "news";
  });

  const reload = useCallback(
    () =>
      api.content().then(
        (data) => {
          setSnapshot(data);
          setLoadError(null);
        },
        (err: unknown) => setLoadError(err instanceof Error ? err.message : String(err)),
      ),
    [],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  function choose(next: Tab) {
    setTab(next);
    setNotice(null);
    window.history.replaceState(null, "", `#${next}`);
  }

  /** 保存・削除して読み込み直す。うまくいったら true */
  const save = useCallback(
    async (request: SaveRequest) => {
      setBusy(true);
      setNotice(null);
      try {
        const result = await api.save(request);
        await reload();
        setNotice(
          result.unchanged
            ? { tone: "ok", text: "変更はありませんでした。" }
            : {
                tone: "ok",
                text: request.action === "delete" ? "削除しました。運営が確認してマージすると、サイトから消えます。" : "保存しました。運営が確認してマージすると、サイトに反映されます。",
                pull: result.pull,
              },
        );
        return true;
      } catch (err) {
        const conflict = err instanceof ApiError && err.conflict;
        setNotice({ tone: "error", text: err instanceof Error ? err.message : String(err), conflict });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  async function logout() {
    await api.logout().catch(() => {});
    onLogout();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4 border-y border-ink py-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- Discord のアイコン */}
        <img src={user.avatar} alt="" className="size-10 rounded-full border border-ink/30" />
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">{user.name}</p>
          <p className="font-mono text-xs text-muted">@{user.username}</p>
        </div>
        <button type="button" onClick={logout} className={buttonClass.secondary}>
          LOGOUT
        </button>
      </div>

      {missing.length > 0 && (
        <p className="border-l-4 border-fun-red-ink bg-white/60 px-4 py-3 text-sm">
          サイトの設定が足りません({missing.join("、")})。運営に知らせてください(docs/admin.md)。
        </p>
      )}

      <PullStatus pull={snapshot?.pull ?? null} />

      <div role="tablist" aria-label="編集するもの" className="flex flex-wrap gap-1 border-b border-ink">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => choose(t.id)}
            className={`-mb-px flex items-baseline gap-2 border border-b-0 px-4 py-2.5 transition-colors ${
              tab === t.id ? "border-ink bg-fun-yellow" : "border-transparent hover:bg-paper-2"
            }`}
          >
            <span className="font-bold">{t.ja}</span>
            <span className="font-mono text-[10px] tracking-[0.18em] text-muted">{t.en}</span>
          </button>
        ))}
      </div>

      {notice && (
        <div role="status" className={`border-l-4 bg-white/60 px-4 py-3 text-sm ${notice.tone === "ok" ? "border-fun-green-ink" : "border-fun-red-ink"}`}>
          <p className="whitespace-pre-line font-bold">{notice.text}</p>
          {notice.pull && (
            <p className="mt-1">
              確認用の PR:{" "}
              <a href={notice.pull.url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:bg-fun-yellow">
                #{notice.pull.number}
              </a>
            </p>
          )}
          {notice.conflict && (
            <button type="button" className={`${buttonClass.secondary} mt-3`} onClick={() => reload().then(() => setNotice(null))}>
              読み込み直す
            </button>
          )}
        </div>
      )}

      {loadError && (
        <div className="space-y-3 border-l-4 border-fun-red-ink bg-white/60 px-4 py-3 text-sm">
          <p className="font-bold">内容を読み込めませんでした。</p>
          <p className="text-muted">{loadError}</p>
          <button type="button" className={buttonClass.secondary} onClick={() => reload()}>
            もう一度読み込む
          </button>
        </div>
      )}
      {!snapshot && !loadError && <p className="font-mono text-sm text-muted">LOADING…</p>}

      {snapshot && (
        <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.ja}>
          {tab === "news" && <NewsEditor items={snapshot.news} busy={busy} save={save} />}
          {tab === "schedule" && <ScheduleEditor schedule={snapshot.schedule} busy={busy} save={save} />}
          {tab === "members" && <MemberEditor items={snapshot.members} works={snapshot.works} user={user} busy={busy} save={save} />}
          {tab === "works" && <WorkEditor items={snapshot.works} busy={busy} save={save} />}
        </div>
      )}
    </div>
  );
}

function PullStatus({ pull }: { pull: Pull }) {
  if (!pull) {
    return <p className="text-sm leading-relaxed text-muted">保存すると、運営が確認するための PR が GitHub にできます。運営がマージすると、数分でサイトに反映されます。</p>;
  }
  return (
    <p className="text-sm leading-relaxed">
      <span className="hl mr-2 px-1 font-mono text-xs">PENDING</span>
      あなたの変更は運営の確認待ちです(
      <a href={pull.url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:bg-fun-yellow">
        PR #{pull.number}
      </a>
      )。この画面には確認待ちの変更も入った内容が出ています。見た目は PR に付く Cloudflare Pages のプレビューで確かめられます。
    </p>
  );
}
