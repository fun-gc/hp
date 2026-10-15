import type { Medal, Member } from "@/lib/schema";
import { roleLabels } from "@/lib/schema";
import type { MemberStanding } from "@/lib/grade";

const medalColor: Record<Medal["color"], string> = {
  red: "bg-fun-red text-white",
  green: "bg-fun-green text-white",
  yellow: "bg-fun-yellow text-ink",
  ink: "bg-ink text-white",
};

export function MemberCard({
  member,
  standing,
  medals,
}: {
  member: Member;
  standing: MemberStanding;
  medals: Medal[];
}) {
  return (
    <article className="flex flex-col gap-4 border border-line bg-white p-5">
      <div className="flex items-center gap-4">
        {member.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Discord のアバター画像をそのまま表示する
          <img src={member.avatarUrl} alt="" className="size-16 shrink-0 rounded-full bg-paper object-cover" loading="lazy" />
        ) : (
          <div className="grid size-16 shrink-0 place-items-center rounded-full bg-ink font-display text-2xl font-bold text-white">
            {member.name.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-lg font-black">{member.name}</p>
          <p className="text-sm text-muted">{standing.label}</p>
        </div>
      </div>

      {member.roles.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs">
          {member.roles.map((r) => (
            <li key={r} className="border border-line px-2 py-0.5 font-bold">
              {roleLabels[r]}
            </li>
          ))}
        </ul>
      )}

      {member.bio && <p className="text-sm leading-relaxed">{member.bio}</p>}

      {member.favoriteGames && member.favoriteGames.length > 0 && (
        <p className="text-sm">
          <span className="font-bold">好きなゲーム:</span> {member.favoriteGames.join("、")}
        </p>
      )}

      {medals.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="メダル">
          {medals.map((m) => (
            <li key={m.id} title={m.description} className={`px-2 py-0.5 text-xs font-bold ${medalColor[m.color]}`}>
              ★ {m.name}
            </li>
          ))}
        </ul>
      )}

      {member.links && (
        <p className="mt-auto flex gap-4 text-sm font-bold">
          {member.links.x && (
            <a href={member.links.x} target="_blank" rel="noreferrer" className="hover:text-fun-red-ink">
              X
            </a>
          )}
          {member.links.github && (
            <a href={member.links.github} target="_blank" rel="noreferrer" className="hover:text-fun-red-ink">
              GitHub
            </a>
          )}
          {member.links.website && (
            <a href={member.links.website} target="_blank" rel="noreferrer" className="hover:text-fun-red-ink">
              Web
            </a>
          )}
        </p>
      )}
    </article>
  );
}
