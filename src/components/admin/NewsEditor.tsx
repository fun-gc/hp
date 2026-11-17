"use client";

import { useState, type FormEvent } from "react";
import type { NewsItem, SaveRequest } from "./api";
import { Broken, buttonClass, Empty, Field, FormActions, FormTitle, ListButton, ListDetail, MarkdownField, splitList, TextField, today } from "./fields";

type Save = (request: SaveRequest) => Promise<boolean>;

type Draft = { isNew: boolean; key: string; slug: string; oid: string | null; title: string; date: string; tags: string; body: string };

const draftOf = (item?: NewsItem): Draft =>
  item
    ? { isNew: false, key: item.key, slug: "", oid: item.oid, title: item.data.title, date: item.data.date, tags: item.data.tags.join("、"), body: item.body }
    : { isNew: true, key: "", slug: "", oid: null, title: "", date: today(), tags: "", body: "" };

export function NewsEditor({ items, busy, save }: { items: NewsItem[]; busy: boolean; save: Save }) {
  // 選んでいるお知らせのファイル名。"" は新しく追加するとき
  const [selected, setSelected] = useState<string | null>(null);
  const current = items.find((n) => n.key === selected);

  return (
    <ListDetail
      list={
        <>
          <button type="button" className={buttonClass.secondary} onClick={() => setSelected("")}>
            ＋ お知らせを追加
          </button>
          <ul className="mt-4 border-t border-ink">
            {items.map((n) => (
              <li key={n.key}>
                <ListButton active={selected === n.key} onClick={() => setSelected(n.key)}>
                  <span className="block font-mono text-xs text-muted">{n.broken ? "読み込めません" : n.data.date.replaceAll("-", ".")}</span>
                  <span className="block font-bold leading-snug">{n.broken ? n.key : n.data.title}</span>
                </ListButton>
              </li>
            ))}
          </ul>
        </>
      }
    >
      {selected === null || (selected !== "" && !current) ? (
        <Empty>左の一覧から選ぶか、「お知らせを追加」を押してください。</Empty>
      ) : current?.broken ? (
        <Broken path={`content/news/${current.key}.md`} message={current.broken} />
      ) : (
        <NewsForm
          key={`${selected}:${current?.oid ?? "new"}`}
          item={current}
          busy={busy}
          save={save}
          onSaved={setSelected}
          onDeleted={() => setSelected(null)}
        />
      )}
    </ListDetail>
  );
}

function NewsForm({ item, busy, save, onSaved, onDeleted }: { item?: NewsItem; busy: boolean; save: Save; onSaved: (key: string) => void; onDeleted: () => void }) {
  const [d, setD] = useState(() => draftOf(item));
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));
  const key = d.isNew ? `${d.date}-${d.slug}` : d.key;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const ok = await save({ kind: "news", key, isNew: d.isNew, oid: d.oid, data: { title: d.title, date: d.date, tags: splitList(d.tags) }, body: d.body });
    if (ok) onSaved(key);
  }

  async function remove() {
    if (await save({ kind: "news", action: "delete", key: d.key, oid: d.oid })) onDeleted();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormTitle note={`content/news/${d.isNew ? `${key || "…"}` : d.key}.md`}>{d.isNew ? "お知らせを追加" : "お知らせを編集"}</FormTitle>
      <div className="grid gap-6 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <TextField label="日付" type="date" required value={d.date} onChange={(date) => set({ date })} />
        {d.isNew ? (
          <TextField
            label="URL に使う名前"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="miraive"
            value={d.slug}
            onChange={(slug) => set({ slug: slug.toLowerCase() })}
            hint={`半角の英小文字・数字・ハイフンで付けます。ページの URL は fungc.org/news/${key}/ になります`}
          />
        ) : (
          <Field label="ページの URL">
            <span className="block py-2 font-mono text-sm">fungc.org/news/{d.key}/</span>
          </Field>
        )}
      </div>
      <TextField label="タイトル" required maxLength={120} value={d.title} onChange={(title) => set({ title })} />
      <TextField label="タグ" hint="「、」で区切ります(例: イベント、メンバー募集)" value={d.tags} onChange={(tags) => set({ tags })} />
      <MarkdownField
        label="本文(Markdown)"
        hint="## で見出し、- で箇条書き、[文字](URL) でリンクになります。HTML のタグは使えません。"
        value={d.body}
        onChange={(body) => set({ body })}
      />
      <FormActions busy={busy} isNew={d.isNew} onDelete={remove} />
    </form>
  );
}
