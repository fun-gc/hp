"use client";

import { Fragment, useSyncExternalStore } from "react";
import type { ScheduleEvent } from "@/lib/schema";

// 終わりの時刻がない予定は、始まりからこの時間だけ開催中とみなす
const DEFAULT_LENGTH_MIN = 120;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** 日本時間の今を "YYYY-MM-DD HH:MM" で返す。分が変わるまで同じ文字列なので、再描画は 1 分に 1 回で済む */
function nowInJapan() {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
}

function subscribeMinute(onChange: () => void) {
  const timer = setInterval(onChange, 15 * 1000);
  return () => clearInterval(timer);
}

function minutes(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

/** 時刻のない予定はその日いっぱい開催中とみなす */
function isLive(e: ScheduleEvent, now: string) {
  const [date, time] = now.split(" ");
  if (e.date !== date) return false;
  if (!e.start) return true;
  const t = minutes(time);
  const start = minutes(e.start);
  const end = e.end ? minutes(e.end) : start + DEFAULT_LENGTH_MIN;
  return start <= t && t < end;
}

function Slashes() {
  return (
    <span className="mx-5 flex shrink-0 gap-1" aria-hidden>
      <span className="h-4 w-1.5 -skew-x-[24deg] bg-fun-red" />
      <span className="h-4 w-1.5 -skew-x-[24deg] bg-fun-green" />
      <span className="h-4 w-1.5 -skew-x-[24deg] bg-fun-yellow" />
    </span>
  );
}

/**
 * ヘッダーのすぐ下に、いま開催中の講座やイベントを右から左へ流す。
 * 静的サイトなので、開催中かどうかはビルド時ではなく閲覧時のブラウザで決める。
 */
export function NowBanner({ events }: { events: ScheduleEvent[] }) {
  const now = useSyncExternalStore(subscribeMinute, nowInJapan, () => "");
  const live = now ? events.filter((e) => isLive(e, now)) : [];
  if (!live.length) return null;

  const messages = live.map((e) => `${e.place ? `${e.place}で` : ""}開催中！ ${e.title}`);
  // 画面の幅より長くなるよう同じ並びを繰り返し、半分の位置まで流して継ぎ目なくループさせる
  const repeat = Math.max(2, Math.ceil(120 / messages.join("").length));
  const group = Array.from({ length: repeat }, () => messages).flat();
  const duration = `${Math.max(20, group.join("").length * 0.3)}s`;

  return (
    <div className="flex h-9 items-stretch overflow-hidden bg-ink text-sm font-bold text-paper">
      <p className="sr-only" role="status">
        {messages.join("、")}
      </p>
      <span
        className="relative z-10 flex shrink-0 items-center bg-fun-yellow pr-6 pl-4 font-display tracking-[0.2em] text-ink [clip-path:polygon(0_0,100%_0,calc(100%-12px)_100%,0_100%)] sm:pl-6"
        aria-hidden
      >
        NOW
      </span>
      <div className="relative min-w-0 flex-1 overflow-hidden" aria-hidden>
        <div className="marquee flex h-full w-max items-center" style={{ animationDuration: duration }}>
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center">
              {group.map((message, i) => (
                <Fragment key={i}>
                  <Slashes />
                  <span className="whitespace-nowrap">{message}</span>
                </Fragment>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
