// ポスター風の試作では、画面に出す見出しやボタンを英語にしている。そのための英語のラベルをここにまとめる。
// content/ のデータ(作品の説明、お知らせ、プロフィールなど)は書いた人の言葉なので、そのまま日本語で出す。
import type { MemberStanding } from "./grade";
import type { Member, ScheduleEvent, Work } from "./schema";

export const eventKindEn: Record<ScheduleEvent["kind"], string> = {
  course: "COURSE",
  exhibition: "EXHIBITION",
  event: "EVENT",
  other: "OTHER",
};

export const roleEn: Record<Member["roles"][number], string> = {
  programmer: "PROGRAM",
  artist: "GRAPHICS",
  sound: "SOUND",
  planner: "PLANNING",
  other: "OTHER",
};

export const weekdaysEn = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export const monthsEn = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

function ordinal(n: number) {
  const suffix = n % 10 === 1 && n % 100 !== 11 ? "ST" : n % 10 === 2 && n % 100 !== 12 ? "ND" : n % 10 === 3 && n % 100 !== 13 ? "RD" : "TH";
  return `${n}${suffix}`;
}

/** 学年の表示。運営が個別に付けたラベル(override.gradeLabel)はそのまま出す */
export function gradeEn(standing: MemberStanding, override?: Member["override"]) {
  if (override?.gradeLabel) return override.gradeLabel;
  if (standing.alumni) return "ALUMNI";
  return `${ordinal(Math.max(standing.grade, 1))} YEAR`;
}

/** 「unityroom で遊ぶ」などのボタン名を、英語の動詞と遊べる場所に置き換える */
export function playLinkEn(work: Work) {
  const label = work.playLabel ?? "";
  const verb = label.includes("ダウンロード") ? "DOWNLOAD" : "PLAY";
  const note = label.includes("マウス") ? " · MOUSE" : "";
  let host = "";
  try {
    host = new URL(work.playUrl ?? "").hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }
  return { verb: `${verb}${note}`, host };
}
