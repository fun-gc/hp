import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { z } from "zod";
import {
  medalSchema,
  memberSchema,
  newsSchema,
  scheduleEventSchema,
  workSchema,
  type Medal,
  type Member,
  type News,
  type ScheduleEvent,
  type Work,
} from "./schema";

// ビルド時に content/ 以下を読み込む。ここで投げたエラーはビルド失敗として PR の CI に出る。
const contentDir = path.join(process.cwd(), "content");

function listFiles(dir: string, ext: string): string[] {
  const full = path.join(contentDir, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(ext) && !f.startsWith("_"))
    .sort();
}

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, file: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`${file} の内容が正しくありません:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function getMembers(): Member[] {
  return listFiles("members", ".json")
    .map((file) => {
      const raw = JSON.parse(fs.readFileSync(path.join(contentDir, "members", file), "utf8"));
      const member = parseOrThrow(memberSchema, raw, `content/members/${file}`);
      if (file !== `${member.discordId}.json`) {
        throw new Error(`content/members/${file} のファイル名は ${member.discordId}.json にしてください`);
      }
      return member;
    })
    .filter((m) => m.public);
}

export function getMedals(): Medal[] {
  const file = path.join(contentDir, "medals.json");
  if (!fs.existsSync(file)) return [];
  return parseOrThrow(z.array(medalSchema), JSON.parse(fs.readFileSync(file, "utf8")), "content/medals.json");
}

export function getWorks(): Work[] {
  return listFiles("works", ".md")
    .map((file) => {
      const { data, content } = matter(fs.readFileSync(path.join(contentDir, "works", file), "utf8"));
      const meta = parseOrThrow(workSchema, data, `content/works/${file}`);
      return { ...meta, slug: file.replace(/\.md$/, ""), body: content.trim() };
    })
    .sort(
      (a, b) =>
        b.year - a.year ||
        (b.month ?? 0) - (a.month ?? 0) ||
        (a.event ?? "").localeCompare(b.event ?? "", "ja") ||
        a.title.localeCompare(b.title, "ja"),
    );
}

export function getNews(): News[] {
  return listFiles("news", ".md")
    .map((file) => {
      const { data, content } = matter(fs.readFileSync(path.join(contentDir, "news", file), "utf8"));
      const meta = parseOrThrow(newsSchema, data, `content/news/${file}`);
      const html = marked.parse(content, { async: false });
      const excerpt = content.replace(/[#>*_`\[\]()!-]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
      return { ...meta, slug: file.replace(/\.md$/, ""), html, excerpt };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function getSchedule(): ScheduleEvent[] {
  const file = path.join(contentDir, "schedule.json");
  if (!fs.existsSync(file)) return [];
  return parseOrThrow(
    z.array(scheduleEventSchema),
    JSON.parse(fs.readFileSync(file, "utf8")),
    "content/schedule.json",
  ).sort((a, b) => (a.date + (a.start ?? "")).localeCompare(b.date + (b.start ?? "")));
}
