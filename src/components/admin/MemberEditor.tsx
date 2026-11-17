"use client";

import { useState, type FormEvent } from "react";
import { roleIds, roleLabels } from "@/lib/schema";
import type { AdminUser, MemberData, MemberItem, SaveRequest, WorkItem } from "./api";
import {
  Broken,
  buttonClass,
  Checkbox,
  CheckboxGroup,
  Empty,
  FormActions,
  FormTitle,
  ListButton,
  ListDetail,
  SelectField,
  splitLines,
  splitList,
  TextArea,
  TextField,
  toNumber,
} from "./fields";

type Save = (request: SaveRequest) => Promise<boolean>;

type Draft = {
  isNew: boolean;
  oid: string | null;
  discordId: string;
  name: string;
  avatarUrl: string;
  roles: string[];
  admissionYear: string;
  bio: string;
  favoriteGames: string;
  works: string[];
  x: string;
  github: string;
  website: string;
  medals: string;
  public: boolean;
  order: string;
  gradeLabel: string;
  alumni: string;
  rest: Partial<MemberData>;
};

const draftOf = (item: MemberItem | undefined, discordId: string, user: AdminUser): Draft => {
  // 自分を追加するときは、Discord の名前とアイコンを入れておく
  const m: Partial<MemberData> = item?.data ?? (discordId === user.id ? { name: user.name, avatarUrl: user.avatar } : {});
  // 編集画面にない項目は、そのまま送り返す(保存のときにサーバーでも今のファイルから引き継ぐ)
  const { links, override, ...rest } = m;
  return {
    isNew: !item,
    oid: item?.oid ?? null,
    discordId: item?.key ?? discordId,
    name: m.name ?? "",
    avatarUrl: m.avatarUrl ?? "",
    roles: m.roles ?? [],
    admissionYear: m.admissionYear ? String(m.admissionYear) : "",
    bio: m.bio ?? "",
    favoriteGames: (m.favoriteGames ?? []).join("\n"),
    works: m.works ?? [],
    x: links?.x ?? "",
    github: links?.github ?? "",
    website: links?.website ?? "",
    medals: (m.medals ?? []).join("、"),
    public: m.public ?? true,
    order: m.order === undefined ? "" : String(m.order),
    gradeLabel: override?.gradeLabel ?? "",
    alumni: override?.alumni === undefined ? "" : String(override.alumni),
    rest,
  };
};

// 「@名前」やユーザー名だけでも受け付ける(/profile links と同じ)
function normalizeLink(kind: "x" | "github" | "website", input: string) {
  const value = input.trim();
  if (!value) return "";
  const handle = value.replace(/^@/, "");
  if (kind === "x" && /^\w{1,15}$/.test(handle)) return `https://x.com/${handle}`;
  if (kind === "github" && /^[A-Za-z0-9-]{1,39}$/.test(handle)) return `https://github.com/${handle}`;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function toData(d: Draft): MemberData {
  return {
    ...d.rest,
    discordId: d.discordId.trim(),
    name: d.name,
    avatarUrl: d.avatarUrl || undefined,
    roles: roleIds.filter((r) => d.roles.includes(r)),
    admissionYear: Number(d.admissionYear),
    bio: d.bio || undefined,
    favoriteGames: splitLines(d.favoriteGames),
    works: d.works,
    links: { x: normalizeLink("x", d.x), github: normalizeLink("github", d.github), website: normalizeLink("website", d.website) },
    medals: splitList(d.medals),
    public: d.public,
    order: toNumber(d.order),
    override: { gradeLabel: d.gradeLabel || undefined, alumni: d.alumni === "" ? undefined : d.alumni === "true" },
  };
}

export function MemberEditor({ items, works, user, busy, save }: { items: MemberItem[]; works: WorkItem[]; user: AdminUser; busy: boolean; save: Save }) {
  // 選んでいるメンバーの Discord のユーザー ID。"" は新しく追加するとき
  const [selected, setSelected] = useState<string | null>(null);
  const current = items.find((m) => m.key === selected);
  const registered = items.some((m) => m.key === user.id);

  return (
    <ListDetail
      list={
        <>
          <div className="flex flex-wrap gap-2">
            {!registered && (
              <button type="button" className={buttonClass.secondary} onClick={() => setSelected(user.id)}>
                ＋ 自分を追加
              </button>
            )}
            <button type="button" className={buttonClass.secondary} onClick={() => setSelected("")}>
              ＋ メンバーを追加
            </button>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">Discord の /profile edit からも、本人が登録・編集できます。</p>
          <ul className="mt-4 border-t border-ink">
            {items.map((m) => (
              <li key={m.key}>
                <ListButton active={selected === m.key} onClick={() => setSelected(m.key)} muted={m.data?.public === false}>
                  <span className="flex items-center gap-3">
                    {m.data?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Discord のアイコン(静的書き出しなので next/image の最適化は使わない)
                      <img src={m.data.avatarUrl} alt="" className="size-8 shrink-0 rounded-full border border-ink/30 object-cover" />
                    ) : (
                      <span className="size-8 shrink-0 rounded-full border border-ink/30 bg-paper-2" aria-hidden="true" />
                    )}
                    <span className="min-w-0">
                      <span className="block font-bold leading-snug">
                        {m.broken ? m.key : m.data.name}
                        {m.key === user.id && <span className="ml-2 font-mono text-[10px] text-muted">YOU</span>}
                      </span>
                      <span className="block font-mono text-[11px] text-muted">
                        {m.broken ? "読み込めません" : m.data.public === false ? "非公開" : `${m.data.admissionYear} 年度入学`}
                      </span>
                    </span>
                  </span>
                </ListButton>
              </li>
            ))}
          </ul>
        </>
      }
    >
      {selected === null || (selected !== "" && selected !== user.id && !current) ? (
        <Empty>左の一覧から選ぶか、「メンバーを追加」を押してください。</Empty>
      ) : current?.broken ? (
        <Broken path={`content/members/${current.key}.json`} message={current.broken} />
      ) : (
        <MemberForm
          key={`${selected}:${current?.oid ?? "new"}`}
          item={current}
          discordId={selected}
          works={works}
          user={user}
          busy={busy}
          save={save}
          onSaved={setSelected}
          onDeleted={() => setSelected(null)}
        />
      )}
    </ListDetail>
  );
}

function MemberForm({
  item,
  discordId,
  works,
  user,
  busy,
  save,
  onSaved,
  onDeleted,
}: {
  item?: MemberItem;
  discordId: string;
  works: WorkItem[];
  user: AdminUser;
  busy: boolean;
  save: Save;
  onSaved: (key: string) => void;
  onDeleted: () => void;
}) {
  const [d, setD] = useState(() => draftOf(item, discordId, user));
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));
  const mine = d.discordId === user.id;
  const thisYear = new Date().getFullYear();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const key = d.discordId.trim();
    if (await save({ kind: "members", key, isNew: d.isNew, oid: d.oid, data: toData(d) })) onSaved(key);
  }

  async function remove() {
    if (await save({ kind: "members", action: "delete", key: d.discordId, oid: d.oid })) onDeleted();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <FormTitle note={`content/members/${d.discordId || "…"}.json`}>{d.isNew ? "メンバーを追加" : "メンバーを編集"}</FormTitle>
      <div className="grid gap-6 sm:grid-cols-2">
        {d.isNew && !mine ? (
          <TextField
            label="Discord のユーザー ID"
            required
            inputMode="numeric"
            pattern="\d{5,25}"
            value={d.discordId}
            onChange={(id) => set({ discordId: id.trim() })}
            hint="Discord で開発者モードを ON にして、名前を右クリック →「ユーザー ID をコピー」。ファイル名に使うので公開されます"
          />
        ) : (
          <TextField label="Discord のユーザー ID" value={d.discordId} onChange={() => {}} disabled hint="ファイル名に使うので変えられません" />
        )}
        <TextField label="名前" required maxLength={32} value={d.name} onChange={(name) => set({ name })} hint="サイトに公開されます" />
      </div>

      <div className="flex items-end gap-4">
        {d.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Discord のアイコン
          <img src={d.avatarUrl} alt="" className="size-14 shrink-0 rounded-full border border-ink/30 object-cover" />
        ) : (
          <span className="size-14 shrink-0 rounded-full border border-ink/30 bg-paper-2" aria-hidden="true" />
        )}
        <TextField className="flex-1" label="アイコンの URL" value={d.avatarUrl} onChange={(avatarUrl) => set({ avatarUrl })} />
        {mine && d.avatarUrl !== user.avatar && (
          <button type="button" className={`${buttonClass.secondary} mb-0.5 shrink-0`} onClick={() => set({ avatarUrl: user.avatar })}>
            今の Discord のアイコンにする
          </button>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <TextField
          label="入学年度"
          type="number"
          required
          min={2000}
          max={thisYear + 1}
          value={d.admissionYear}
          onChange={(admissionYear) => set({ admissionYear })}
          hint="学年は自動で計算します"
        />
        <CheckboxGroup label="担当" options={roleIds.map((id) => ({ value: id, label: roleLabels[id] }))} value={d.roles} onChange={(roles) => set({ roles })} />
      </div>
      <TextArea label="自己紹介" rows={3} maxLength={200} value={d.bio} onChange={(bio) => set({ bio })} hint="200 文字まで" />
      <TextArea label="好きなゲーム" rows={3} value={d.favoriteGames} onChange={(favoriteGames) => set({ favoriteGames })} hint="1 行に 1 つ、5 つまで" />

      <fieldset className="grid gap-6 sm:grid-cols-3">
        <legend className="mb-3 text-sm font-bold">リンク</legend>
        <TextField label="X" value={d.x} onChange={(x) => set({ x })} placeholder="@fungc" />
        <TextField label="GitHub" value={d.github} onChange={(github) => set({ github })} placeholder="ユーザー名か URL" />
        <TextField label="Web サイト" value={d.website} onChange={(website) => set({ website })} placeholder="https://…" />
      </fieldset>

      <details className="border border-ink/25 bg-white/40 px-4 py-3 open:pb-6" open={!d.isNew && Boolean(d.order || d.gradeLabel || d.alumni || d.medals || d.works.length)}>
        <summary className="cursor-pointer text-sm font-bold">運営が入れる項目(作品・メダル・並び順・学年の表示)</summary>
        <div className="mt-5 space-y-6">
          <Checkbox label="サイトのメンバー欄に載せる" checked={d.public} onChange={(checked) => set({ public: checked })} hint="外すと、ファイルは残したままサイトには出しません" />
          <CheckboxGroup
            label="作品"
            options={works.filter((w) => !w.broken).map((w) => ({ value: w.key, label: w.data.title }))}
            value={d.works}
            onChange={(selected) => set({ works: selected })}
            hint="10 個まで"
          />
          <TextField label="メダル" value={d.medals} onChange={(medals) => set({ medals })} hint="content/medals.json の id を「、」で区切ります" />
          <div className="grid gap-6 sm:grid-cols-3">
            <TextField label="並び順" type="number" value={d.order} onChange={(order) => set({ order })} hint="小さいほど先に出ます(部長など)" />
            <TextField label="学年の表示" maxLength={16} value={d.gradeLabel} onChange={(gradeLabel) => set({ gradeLabel })} placeholder="M1" hint="院生などで表示を変えるとき" />
            <SelectField
              label="OB・OG の欄"
              value={d.alumni}
              onChange={(alumni) => set({ alumni })}
              options={[
                { value: "", label: "自動(4 年生から)" },
                { value: "true", label: "OB・OG の欄に出す" },
                { value: "false", label: "在学生の欄に出す" },
              ]}
            />
          </div>
        </div>
      </details>

      <FormActions busy={busy} isNew={d.isNew} onDelete={remove} />
    </form>
  );
}
