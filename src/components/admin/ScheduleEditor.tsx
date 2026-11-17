"use client";

import { useState, type FormEvent } from "react";
import { eventKindLabels, eventKinds, type ScheduleEvent } from "@/lib/schema";
import type { SaveRequest, Snapshot } from "./api";
import { Broken, buttonClass, Empty, FormActions, FormTitle, ListButton, ListDetail, SelectField, TextArea, TextField, today } from "./fields";

type Save = (request: SaveRequest) => Promise<boolean>;
type Draft = { [K in "date" | "start" | "end" | "title" | "kind" | "place" | "note" | "host"]: string } & { discordThreadId?: string };

const draftOf = (e?: ScheduleEvent): Draft => ({
  date: e?.date ?? today(),
  start: e?.start ?? "",
  end: e?.end ?? "",
  title: e?.title ?? "",
  kind: e?.kind ?? "course",
  place: e?.place ?? "",
  note: e?.note ?? "",
  host: e?.host ?? "",
  ...(e?.discordThreadId ? { discordThreadId: e.discordThreadId } : {}),
});

const kindColor: Record<string, string> = {
  course: "bg-fun-red",
  exhibition: "bg-fun-green",
  event: "bg-fun-yellow",
  other: "bg-line",
};

/** 予定は content/schedule.json の 1 つのファイルなので、1 件を直しても一覧をまるごと保存する */
export function ScheduleEditor({ schedule, busy, save }: { schedule: Snapshot["schedule"]; busy: boolean; save: Save }) {
  // 選んでいる予定の番号。-1 は新しく追加するとき
  const [selected, setSelected] = useState<number | null>(null);
  const items = schedule.items;
  const day = today();

  if (schedule.broken) return <Broken path="content/schedule.json" message={schedule.broken} />;

  const saveList = async (list: unknown[]) => save({ kind: "schedule", oid: schedule.oid, data: list });

  return (
    <ListDetail
      list={
        <>
          <button type="button" className={buttonClass.secondary} onClick={() => setSelected(-1)}>
            ＋ 予定を追加
          </button>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Discord のメンバー募集チャンネルに投稿した予定は、自動でカレンダーに載るので、ここには出ません。Discord に投稿しない予定だけを入れてください。
          </p>
          <ul className="mt-4 border-t border-ink">
            {items.length === 0 && <li className="py-4 text-sm text-muted">まだ予定はありません。</li>}
            {items.map((e, i) => (
              <li key={`${i}:${e.date}:${e.title}`}>
                <ListButton active={selected === i} onClick={() => setSelected(i)} muted={e.date < day}>
                  <span className="flex items-center gap-2 font-mono text-xs text-muted">
                    <span className={`inline-block size-2.5 ${kindColor[e.kind] ?? "bg-line"}`} aria-hidden="true" />
                    {e.date.replaceAll("-", ".")}
                    {e.start && ` ${e.start}`}
                    {e.date < day && "(終わった予定)"}
                  </span>
                  <span className="block font-bold leading-snug">{e.title}</span>
                </ListButton>
              </li>
            ))}
          </ul>
        </>
      }
    >
      {selected === null || (selected >= 0 && !items[selected]) ? (
        <Empty>左の一覧から選ぶか、「予定を追加」を押してください。</Empty>
      ) : (
        <EventForm
          key={`${selected}:${schedule.oid}`}
          event={selected >= 0 ? items[selected] : undefined}
          busy={busy}
          onSubmit={async (event) => {
            const list = selected >= 0 ? items.map((e, i) => (i === selected ? event : e)) : [...items, event];
            // 保存すると日付順に並び替わり、番号が変わるので選び直してもらう
            if (await saveList(list)) setSelected(null);
          }}
          onDelete={async () => {
            if (await saveList(items.filter((_, i) => i !== selected))) setSelected(null);
          }}
        />
      )}
    </ListDetail>
  );
}

function EventForm({ event, busy, onSubmit, onDelete }: { event?: ScheduleEvent; busy: boolean; onSubmit: (event: Draft) => void; onDelete: () => void }) {
  const [d, setD] = useState(() => draftOf(event));
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));
  const isNew = !event;

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit(d);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormTitle note="content/schedule.json">{isNew ? "予定を追加" : "予定を編集"}</FormTitle>
      <div className="grid gap-6 sm:grid-cols-3">
        <TextField label="日付" type="date" required value={d.date} onChange={(date) => set({ date })} />
        <TextField label="開始" type="time" value={d.start} onChange={(start) => set({ start })} hint="省略できます" />
        <TextField label="終了" type="time" value={d.end} onChange={(end) => set({ end })} hint="省略できます" />
      </div>
      <TextField label="タイトル" required maxLength={120} value={d.title} onChange={(title) => set({ title })} placeholder="Unity 講座 第2回" />
      <div className="grid gap-6 sm:grid-cols-2">
        <SelectField
          label="種類"
          value={d.kind}
          onChange={(kind) => set({ kind })}
          options={eventKinds.map((k) => ({ value: k, label: `${eventKindLabels[k]}(${{ course: "赤", exhibition: "緑", event: "黄", other: "灰" }[k]})` }))}
        />
        <TextField label="場所" maxLength={80} value={d.place} onChange={(place) => set({ place })} placeholder="3階 アトリウム" />
      </div>
      <TextArea label="内容" rows={3} maxLength={200} value={d.note} onChange={(note) => set({ note })} hint="カレンダーに出る短い説明です" />
      <TextField label="主催" maxLength={40} value={d.host} onChange={(host) => set({ host })} hint="予定一覧の右端に出る名前です" />
      <FormActions busy={busy} isNew={isNew} onDelete={onDelete} />
    </form>
  );
}
