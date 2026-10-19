import { z } from "zod";

// content/ 以下のデータの形。Discord Bot が書き込むファイルもここで検証するので、
// 形が崩れたデータはビルドの時点でエラーになり、壊れたまま公開されない。

export const roleIds = ["programmer", "artist", "sound", "planner", "other"] as const;
export const roleLabels: Record<(typeof roleIds)[number], string> = {
  programmer: "プログラム",
  artist: "グラフィック",
  sound: "サウンド",
  planner: "企画",
  other: "その他",
};

export const memberSchema = z.object({
  discordId: z.string().regex(/^\d{5,25}$/, "Discord のユーザー ID(数字)"),
  name: z.string().min(1).max(32),
  avatarUrl: z.url().optional(),
  roles: z.array(z.enum(roleIds)).default([]),
  admissionYear: z.number().int().min(2000).max(2100),
  bio: z.string().max(200).optional(),
  favoriteGames: z.array(z.string().max(50)).max(5).optional(),
  works: z.array(z.string().max(80)).max(10).optional(),
  links: z
    .object({
      x: z.url().optional(),
      github: z.url().optional(),
      website: z.url().optional(),
    })
    .optional(),
  medals: z.array(z.string()).default([]),
  // 本人がサイト掲載を ON にしたメンバーだけを表示する
  public: z.boolean(),
  override: z
    .object({
      gradeLabel: z.string().max(16).optional(),
      alumni: z.boolean().optional(),
    })
    .optional(),
});
export type Member = z.infer<typeof memberSchema>;

export const medalSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  description: z.string(),
  color: z.enum(["red", "green", "yellow", "ink"]),
});
export type Medal = z.infer<typeof medalSchema>;

export const workSchema = z.object({
  title: z.string(),
  authors: z.array(z.string()).min(1),
  year: z.number().int(),
  // 同じ年の中での並び順に使う(展示した月)。新しいものほど上に出る
  month: z.number().int().min(1).max(12).optional(),
  event: z.string().optional(),
  // 同じイベント内での並び順。小さいほど左(先)に出る。省略すると最後尾でタイトル順
  order: z.number().int().optional(),
  playUrl: z.url().optional(),
  playLabel: z.string().optional(),
  youtubeId: z.string().optional(),
  // public/ 以下に置いた画像や GIF のパス(例: /works/xxx.gif)。YouTube のサムネイルより優先する
  thumbnail: z.string().startsWith("/").optional(),
  tags: z.array(z.string()).default([]),
});
export type Work = z.infer<typeof workSchema> & { slug: string; body: string };

export const newsSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
});
export type News = z.infer<typeof newsSchema> & { slug: string; html: string; excerpt: string };

export const eventKinds = ["course", "exhibition", "event", "other"] as const;
export const eventKindLabels: Record<(typeof eventKinds)[number], string> = {
  course: "講座",
  exhibition: "展示",
  event: "イベント",
  other: "その他",
};

export const scheduleEventSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式"),
  start: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  end: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  title: z.string(),
  kind: z.enum(eventKinds).default("course"),
  place: z.string().optional(),
  note: z.string().optional(),
  // 主催者の名前(Discord から読んだ予定では投稿者のサーバーでの表示名)
  host: z.string().max(40).optional(),
});
export type ScheduleEvent = z.infer<typeof scheduleEventSchema>;
