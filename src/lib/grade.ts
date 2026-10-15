// 学年の自動計算。入学年度だけを記録しておけば、毎年 4 月に学年が繰り上がる。
// 4 年生になった時点で OB/OG 扱いにする(サークルの運用ルール)。
export const ALUMNI_FROM_GRADE = 4;

/** 日本時間で見た「年度」(4 月始まり)を返す。 */
export function academicYear(date: Date): number {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const month = jst.getUTCMonth() + 1;
  return month >= 4 ? year : year - 1;
}

export type MemberStanding = {
  grade: number;
  alumni: boolean;
  label: string;
};

export function memberStanding(
  admissionYear: number,
  now: Date,
  override?: { gradeLabel?: string; alumni?: boolean },
): MemberStanding {
  const grade = academicYear(now) - admissionYear + 1;
  const alumni = override?.alumni ?? grade >= ALUMNI_FROM_GRADE;
  const label = override?.gradeLabel ?? (alumni ? "OB・OG" : `${Math.max(grade, 1)}年`);
  return { grade, alumni, label };
}
