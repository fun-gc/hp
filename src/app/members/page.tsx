import type { Metadata } from "next";
import { PageHeading, SubHead } from "@/components/Heading";
import { MemberCard } from "@/components/MemberCard";
import { getMedals, getMembers } from "@/lib/content";
import { memberStanding } from "@/lib/grade";
import { stagger } from "@/lib/motion";

export const metadata: Metadata = { title: "Members" };

export default function MembersPage() {
  // 学年はビルドした日を基準に計算する。毎年 4 月 1 日に自動で再ビルドして繰り上げる。
  const now = new Date();
  const medals = new Map(getMedals().map((m) => [m.id, m]));
  const members = getMembers()
    .map((m) => ({ member: m, standing: memberStanding(m.admissionYear, now, m.override) }))
    // order を付けた人(部長など)を先に、残りは学年の高い順・名前順に並べる
    .sort(
      (a, b) =>
        (a.member.order ?? Infinity) - (b.member.order ?? Infinity) ||
        b.standing.grade - a.standing.grade ||
        a.member.name.localeCompare(b.member.name, "ja"),
    );
  const active = members.filter((m) => !m.standing.alumni);
  const alumni = members.filter((m) => m.standing.alumni);

  const renderGrid = (list: typeof members) => (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {list.map(({ member, standing }, i) => (
        <div key={member.discordId} className="grid" data-reveal style={stagger((i % 3) + 1)}>
          <MemberCard member={member} standing={standing} medals={member.medals.flatMap((id) => medals.get(id) ?? [])} />
        </div>
      ))}
    </div>
  );

  return (
    <>
      <PageHeading en="MEMBERS" />
      <div className="wrap py-16 sm:py-20">
        {members.length === 0 ? (
          <p className="corner-ticks px-4 py-16 text-center text-muted">メンバー紹介は準備中です。</p>
        ) : (
          <div className="space-y-20">
            {active.length > 0 && renderGrid(active)}
            {alumni.length > 0 && (
              <section>
                <SubHead note={`${String(alumni.length).padStart(2, "0")} PLAYERS`}>Alumni</SubHead>
                {renderGrid(alumni)}
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}
