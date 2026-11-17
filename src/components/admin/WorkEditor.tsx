"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import type { SaveRequest, WorkData, WorkItem } from "./api";
import { Broken, buttonClass, Empty, Field, FormActions, FormTitle, inputClass, ListButton, ListDetail, SelectField, splitList, TextArea, TextField, toNumber } from "./fields";

type Save = (request: SaveRequest) => Promise<boolean>;

const MAX_IMAGE_MB = 5;

type Draft = {
  isNew: boolean;
  key: string;
  slug: string;
  oid: string | null;
  title: string;
  authors: string;
  year: string;
  month: string;
  event: string;
  order: string;
  playUrl: string;
  playLabel: string;
  youtube: string;
  thumbnail: string;
  tags: string;
  body: string;
  rest: Partial<WorkData>;
};

const draftOf = (item?: WorkItem): Draft => {
  const w: Partial<WorkData> = item?.data ?? {};
  const known = ["title", "authors", "year", "month", "event", "order", "playUrl", "playLabel", "youtubeId", "thumbnail", "tags"];
  return {
    isNew: !item,
    key: item?.key ?? "",
    slug: "",
    oid: item?.oid ?? null,
    title: w.title ?? "",
    authors: (w.authors ?? []).join("、"),
    year: String(w.year ?? new Date().getFullYear()),
    month: w.month ? String(w.month) : "",
    event: w.event ?? "",
    order: w.order === undefined ? "" : String(w.order),
    playUrl: w.playUrl ?? "",
    playLabel: w.playLabel ?? "",
    youtube: w.youtubeId ?? "",
    thumbnail: w.thumbnail ?? "",
    tags: (w.tags ?? []).join("、"),
    body: item?.body ?? "",
    rest: Object.fromEntries(Object.entries(w).filter(([k]) => !known.includes(k))),
  };
};

/** YouTube の URL(watch?v=、youtu.be/、shorts/)からも動画 ID を取り出す */
export function youtubeId(input: string) {
  const value = input.trim();
  const m = /(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{6,20})/.exec(value);
  return m ? m[1] : value;
}

export function WorkEditor({ items, busy, save }: { items: WorkItem[]; busy: boolean; save: Save }) {
  // 選んでいる作品のファイル名。"" は新しく追加するとき
  const [selected, setSelected] = useState<string | null>(null);
  const current = items.find((w) => w.key === selected);
  const events = [...new Set(items.map((w) => w.data?.event).filter((e): e is string => Boolean(e)))];
  const labels = [...new Set(items.map((w) => w.data?.playLabel).filter((e): e is string => Boolean(e)))];

  return (
    <ListDetail
      list={
        <>
          <button type="button" className={buttonClass.secondary} onClick={() => setSelected("")}>
            ＋ 作品を追加
          </button>
          <ul className="mt-4 border-t border-ink">
            {items.map((w) => (
              <li key={w.key}>
                <ListButton active={selected === w.key} onClick={() => setSelected(w.key)}>
                  <span className="block font-mono text-xs text-muted">
                    {w.broken ? "読み込めません" : [w.data.year, w.data.event].filter(Boolean).join(" · ")}
                  </span>
                  <span className="block font-bold leading-snug">{w.broken ? w.key : w.data.title}</span>
                </ListButton>
              </li>
            ))}
          </ul>
        </>
      }
    >
      {selected === null || (selected !== "" && !current) ? (
        <Empty>左の一覧から選ぶか、「作品を追加」を押してください。</Empty>
      ) : current?.broken ? (
        <Broken path={`content/works/${current.key}.md`} message={current.broken} />
      ) : (
        <WorkForm
          key={`${selected}:${current?.oid ?? "new"}`}
          item={current}
          events={events}
          labels={labels}
          busy={busy}
          save={save}
          onSaved={setSelected}
          onDeleted={() => setSelected(null)}
        />
      )}
    </ListDetail>
  );
}

function WorkForm({
  item,
  events,
  labels,
  busy,
  save,
  onSaved,
  onDeleted,
}: {
  item?: WorkItem;
  events: string[];
  labels: string[];
  busy: boolean;
  save: Save;
  onSaved: (key: string) => void;
  onDeleted: () => void;
}) {
  const [d, setD] = useState(() => draftOf(item));
  const [upload, setUpload] = useState<{ base64: string; preview: string; name: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));
  const key = d.isNew ? `${d.year}-${d.slug}` : d.key;
  const id = youtubeId(d.youtube);
  const preview = upload?.preview ?? (d.thumbnail || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ""));

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setUploadError(null);
    if (!file) return setUpload(null);
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      e.target.value = "";
      return setUploadError(`画像は ${MAX_IMAGE_MB} MB までにしてください`);
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setUpload({ base64: url.slice(url.indexOf(",") + 1), preview: url, name: file.name });
    };
    reader.readAsDataURL(file);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const data: WorkData = {
      ...d.rest,
      title: d.title,
      authors: splitList(d.authors),
      year: Number(d.year),
      month: toNumber(d.month),
      event: d.event,
      order: toNumber(d.order),
      playUrl: d.playUrl,
      playLabel: d.playLabel,
      youtubeId: id,
      thumbnail: d.thumbnail,
      tags: splitList(d.tags),
    };
    const ok = await save({ kind: "works", key, isNew: d.isNew, oid: d.oid, data, body: d.body, ...(upload ? { upload: { base64: upload.base64 } } : {}) });
    if (ok) onSaved(key);
  }

  async function remove() {
    if (await save({ kind: "works", action: "delete", key: d.key, oid: d.oid })) onDeleted();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormTitle note={`content/works/${d.isNew ? key : d.key}.md`}>{d.isNew ? "作品を追加" : "作品を編集"}</FormTitle>
      <TextField label="タイトル" required maxLength={120} value={d.title} onChange={(title) => set({ title })} />
      <TextField label="作者" required value={d.authors} onChange={(authors) => set({ authors })} hint="「、」で区切ります(例: ゆうげつ ほか)" />
      <div className="grid gap-6 sm:grid-cols-3">
        <TextField label="年" type="number" required min={2000} max={2100} value={d.year} onChange={(year) => set({ year })} />
        <SelectField
          label="展示した月"
          value={d.month}
          onChange={(month) => set({ month })}
          options={[{ value: "", label: "なし" }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} 月` }))]}
          hint="同じ年の中で新しい順に並びます"
        />
        <TextField label="並び順" type="number" value={d.order} onChange={(order) => set({ order })} hint="同じイベントの中で、小さいほど左に出ます" />
      </div>
      {d.isNew && (
        <TextField
          label="ファイル名に使う名前"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="hitofuri-golf"
          value={d.slug}
          onChange={(slug) => set({ slug: slug.toLowerCase() })}
          hint={`半角の英小文字・数字・ハイフンで付けます。content/works/${key}.md になります`}
        />
      )}
      <TextField label="イベント" list="admin-work-events" maxLength={60} value={d.event} onChange={(event) => set({ event })} placeholder="未来祭 2026" />
      <datalist id="admin-work-events">
        {events.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <TextField label="遊べるページの URL" type="url" value={d.playUrl} onChange={(playUrl) => set({ playUrl })} placeholder="https://unityroom.com/games/…" />
        <TextField label="ボタンの文字" list="admin-work-labels" maxLength={40} value={d.playLabel} onChange={(playLabel) => set({ playLabel })} placeholder="unityroom で遊ぶ" />
        <datalist id="admin-work-labels">
          {labels.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </div>
      <TextField label="YouTube" value={d.youtube} onChange={(youtube) => set({ youtube })} hint="動画の URL か ID。サムネイルを押すと再生されます" />

      <div className="grid gap-6 sm:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="relative aspect-video overflow-hidden border border-ink/25 bg-ink">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- 選んだ画像をそのまま見せる
            <img src={preview} alt="" className="size-full object-contain" />
          ) : (
            <span className="grid size-full place-items-center font-mono text-xs text-white/60">NO IMAGE</span>
          )}
        </div>
        <div className="space-y-4">
          <Field label="サムネイル画像" hint={`PNG・JPEG・GIF・WebP、${MAX_IMAGE_MB} MB まで。public/works/${key || "…"}.png のような名前で置きます。なければ YouTube のサムネイルを使います`}>
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={pick} className={`${inputClass} file:mr-3 file:border-0 file:bg-ink file:px-3 file:py-1 file:font-mono file:text-xs file:text-white`} />
          </Field>
          {uploadError && <p className="text-sm font-bold text-fun-red-ink">{uploadError}</p>}
          {!upload && <TextField label="画像のパス" value={d.thumbnail} onChange={(thumbnail) => set({ thumbnail })} placeholder="/works/2026-xxx.png" />}
        </div>
      </div>

      <TextField label="タグ" value={d.tags} onChange={(tags) => set({ tags })} hint="「、」で区切ります(例: アクション、チーム開発)" />
      <TextArea label="説明" rows={4} value={d.body} onChange={(body) => set({ body })} />
      <FormActions busy={busy} isNew={d.isNew} onDelete={remove} />
    </form>
  );
}
