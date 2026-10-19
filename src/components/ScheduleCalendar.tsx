"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { eventKindLabels, type ScheduleEvent } from "@/lib/schema";

// 印はどれも、同じ色の明度を落とした縁で囲む
const kindStyle: Record<ScheduleEvent["kind"], { dot: string; tag: string }> = {
  course: { dot: "bg-fun-red ring-1 ring-fun-red-ink", tag: "bg-fun-red text-white" },
  exhibition: { dot: "bg-fun-green ring-1 ring-fun-green-ink", tag: "bg-fun-green text-white" },
  event: { dot: "bg-fun-yellow ring-1 ring-fun-yellow-edge", tag: "bg-fun-yellow text-ink" },
  other: { dot: "bg-muted ring-1 ring-ink-2", tag: "bg-ink text-white" },
};

const weekdays = ["日曜", "月曜", "火曜", "水曜", "木曜", "金曜", "土曜"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function todayInJapan() {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return ymd(jst.getUTCFullYear(), jst.getUTCMonth() + 1, jst.getUTCDate());
}

const noopSubscribe = () => () => {};

/**
 * 講座やイベントの予定カレンダー。日付は "YYYY-MM-DD" の文字列で扱い、タイムゾーンのずれを避ける。
 * 静的サイトなので、「今日」はビルド時ではなく閲覧時のブラウザで決める(buildDate は描画前の仮の値)。
 */
export function ScheduleCalendar({ events, buildDate }: { events: ScheduleEvent[]; buildDate: string }) {
  const today = useSyncExternalStore(noopSubscribe, todayInJapan, () => buildDate);
  const [chosenMonth, setMonth] = useState<string | null>(null);
  const month = chosenMonth ?? today.slice(0, 7);
  const [selected, setSelected] = useState<string | null>(null);
  const [year, mon] = month.split("-").map(Number);

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>();
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [events]);

  const firstWeekday = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthEvents = events.filter((e) => e.date.startsWith(month));
  const listed = selected ? (byDate.get(selected) ?? []) : monthEvents;

  function shift(delta: number) {
    const d = new Date(Date.UTC(year, mon - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
    setSelected(null);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <button type="button" onClick={() => shift(-1)} className="px-3 py-1 font-bold hover:text-fun-red-ink" aria-label="前の月">
            ←
          </button>
          <p className="font-display text-xl font-bold tracking-wider" aria-live="polite">
            {year}.{pad(mon)}
          </p>
          <button type="button" onClick={() => shift(1)} className="px-3 py-1 font-bold hover:text-fun-red-ink" aria-label="次の月">
            →
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs font-bold text-muted">
          {weekdays.map((w, i) => (
            <div key={w} className={`py-2 ${i === 0 ? "text-fun-red-ink" : ""}`}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-t border-line">
          {cells.map((day, i) => {
            if (day === null) return <div key={`blank-${i}`} className="aspect-square border-b border-r border-line bg-paper/60 [&:nth-child(7n)]:border-r-0" />;
            const date = ymd(year, mon, day);
            const dayEvents = byDate.get(date) ?? [];
            const isToday = date === today;
            const isSelected = date === selected;
            return (
              <button
                key={date}
                type="button"
                disabled={dayEvents.length === 0}
                onClick={() => setSelected(isSelected ? null : date)}
                aria-label={`${mon}月${day}日${dayEvents.length ? `、予定${dayEvents.length}件` : ""}`}
                aria-pressed={isSelected}
                className={`relative flex aspect-square flex-col items-center justify-start gap-1 border-b border-r border-line p-1 text-sm transition-colors [&:nth-child(7n)]:border-r-0 sm:p-2 ${
                  isSelected ? "bg-ink text-white" : dayEvents.length ? "hover:bg-fun-yellow/40" : ""
                }`}
              >
                <span
                  className={`grid size-7 place-items-center font-display font-semibold ${
                    isToday && !isSelected ? "rounded-full bg-fun-red text-white" : ""
                  }`}
                >
                  {day}
                </span>
                <span className="flex flex-wrap justify-center gap-1">
                  {dayEvents.map((e, j) => (
                    <span key={j} className={`size-2.5 ${kindStyle[e.kind].dot}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4 border-t border-line px-4 py-3 text-xs text-muted">
          {(Object.keys(kindStyle) as ScheduleEvent["kind"][]).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`size-2.5 ${kindStyle[k].dot}`} />
              {eventKindLabels[k]}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 font-bold">
          {selected ? `${Number(selected.slice(5, 7))}月${Number(selected.slice(8))}日の予定` : `${mon}月の予定`}
        </p>
        {listed.length === 0 ? (
          <p className="border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            この月の予定はまだありません。決まりしだい追加します。
          </p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {listed.map((e, i) => (
              <li key={`${e.date}-${i}`} className="flex gap-4 py-4">
                <div className="w-14 shrink-0 text-center">
                  <p className="font-display text-2xl font-bold leading-none">{Number(e.date.slice(8))}</p>
                  <p className="text-xs text-muted">{weekdays[new Date(`${e.date}T00:00:00Z`).getUTCDay()]}</p>
                </div>
                <div className="space-y-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-bold ${kindStyle[e.kind].tag}`}>{eventKindLabels[e.kind]}</span>
                    <span className="font-bold">{e.title}</span>
                  </p>
                  <p className="text-sm text-muted">
                    {[e.start && `${e.start}${e.end ? `〜${e.end}` : "〜"}`, e.place].filter(Boolean).join(" / ")}
                  </p>
                  {e.note && <p className="text-sm">{e.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
