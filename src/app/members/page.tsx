import type { Metadata } from "next";
import { MemberCard } from "@/components/MemberCard";
import { PageHeading, SectionLabel } from "@/components/SectionLabel";
import { getMedals, getMembers } from "@/lib/content";
import { memberStanding } from "@/lib/grade";

export const metadata: Metadata = { title: "メンバー" };

export default function MembersPage() {
  // 学年はビルドした日を基準に計算する。毎年 4 月 1 日に自動で再ビルドして繰り上げる。
  const now = new Date();
  const medals = new Map(getMedals().map((m) => [m.id, m]));
  const members = getMembers()
    .map((m) => ({ member: m, standing: memberStanding(m.admissionYear, now, m.override) }))
    .sort((a, b) => b.standing.grade - a.standing.grade || a.member.name.localeCompare(b.member.name, "ja"));
  const active = members.filter((m) => !m.standing.alumni);
  const alumni = members.filter((m) => m.standing.alumni);

  const renderGrid = (list: typeof members) => (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {list.map(({ member, standing }) => (
        <MemberCard
          key={member.discordId}
          member={member}
          standing={standing}
          medals={member.medals.flatMap((id) => medals.get(id) ?? [])}
        />
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeading
        label="MEMBERS"
        title="メンバー"
        lead="プロフィールは Discord の /profile コマンドから登録できるようにする予定です。掲載を希望したメンバーだけを表示しています。"
      />

      {members.length === 0 ? (
        <p className="border border-dashed border-line px-4 py-16 text-center text-muted">
          メンバー紹介は準備中です。
        </p>
      ) : (
        <div className="space-y-16">
          {active.length > 0 && renderGrid(active)}
          {alumni.length > 0 && (
            <section className="space-y-6">
              <SectionLabel>ALUMNI</SectionLabel>
              <h2 className="text-2xl font-black">OB・OG</h2>
              {renderGrid(alumni)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
