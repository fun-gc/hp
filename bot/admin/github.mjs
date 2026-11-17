// 編集画面(/admin)で保存した内容を GitHub に書き込む。運営が PR をマージすると Cloudflare Pages が再ビルドして公開される。
// 編集した人ごとにブランチ edit/<DiscordのユーザーID> と PR を 1 つだけ使い、マージ前に何度保存しても同じ PR に積む
// (/profile の member/<ID> と同じ考え方。bot/members/github.mjs)。
// フォルダの中身は GraphQL でまとめて読む。Cloudflare の無料プランでは、1 リクエストの中で外へ出せるリクエストが 50 回までのため。
// コミットも GraphQL の createCommitOnBranch で作り、Markdown と画像を 1 つのコミットにまとめる。
// Cloudflare(Pages Functions)と Node のどちらでも動くよう、fetch だけを使う。

import { DIRS, SCHEDULE_PATH } from "./content.mjs";

const API = "https://api.github.com";
export const BASE = "main";

export const editBranch = (discordId) => `edit/${discordId}`;

/** ほかの人(か別のタブ)が先に同じものを変えていたとき */
export class ConflictError extends Error {
  constructor(message = "ほかの人が先にこの内容を変更しました。読み込み直してから、もう一度編集してください。") {
    super(message);
    this.name = "ConflictError";
  }
}

export function utf8Base64(text) {
  let binary = "";
  for (const b of new TextEncoder().encode(text)) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** token はトークンを返す関数(GitHub App のトークンは期限があるので、使うたびに聞く) */
export function createEditorRepo({ token, repo, fetch = globalThis.fetch }) {
  const [owner, name] = repo.split("/");

  async function call(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${await token()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "FUNGC-site-admin",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data };
  }

  async function rest(method, route, body, { allow = [] } = {}) {
    const res = await call(method, `${API}/repos/${repo}${route}`, body);
    if (res.ok || allow.includes(res.status)) return res;
    const hint = {
      401: "トークンが正しくないか期限切れです",
      403: "GitHub App に Contents と Pull requests の書き込みの権限がありません",
    }[res.status];
    const err = new Error(`GitHub API ${method} ${route} が ${res.status} を返しました${hint ? `(${hint})` : ""}`);
    err.status = res.status;
    throw err;
  }

  async function graphql(query, variables) {
    const res = await call("POST", `${API}/graphql`, { query, variables });
    if (!res.ok) throw new Error(`GitHub GraphQL が ${res.status} を返しました`);
    if (res.data?.errors?.length) {
      const message = res.data.errors.map((e) => e.message).join(" / ");
      if (/expected branch to point to/i.test(message)) throw new ConflictError();
      throw new Error(`GitHub GraphQL: ${message}`);
    }
    return res.data.data;
  }

  const findOpenPull = async (branch) =>
    (await rest("GET", `/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`)).data?.[0] ?? null;

  const blob = (o) => (o ? { oid: o.oid, text: typeof o.text === "string" ? o.text : null } : null);

  /** rev(ブランチ名)の時点の、編集画面で扱うファイルをまとめて読む */
  async function readContent(rev) {
    const dir = `entries { name oid object { ... on Blob { text } } }`;
    const data = await graphql(
      `query($owner: String!, $name: String!, $rev: String!, $news: String!, $works: String!, $members: String!, $schedule: String!) {
        repository(owner: $owner, name: $name) {
          head: object(expression: $rev) { oid }
          news: object(expression: $news) { ... on Tree { ${dir} } }
          works: object(expression: $works) { ... on Tree { ${dir} } }
          members: object(expression: $members) { ... on Tree { ${dir} } }
          schedule: object(expression: $schedule) { oid ... on Blob { text } }
        }
      }`,
      {
        owner,
        name,
        rev,
        news: `${rev}:${DIRS.news}`,
        works: `${rev}:${DIRS.works}`,
        members: `${rev}:${DIRS.members}`,
        schedule: `${rev}:${SCHEDULE_PATH}`,
      },
    );
    const r = data.repository;
    if (!r?.head) throw new Error(`ブランチ ${rev} が見つかりません`);
    const entries = (tree) => (tree?.entries ?? []).map((e) => ({ name: e.name, oid: e.oid, text: e.object?.text ?? null }));
    return {
      head: r.head.oid,
      files: { news: entries(r.news), works: entries(r.works), members: entries(r.members), schedule: blob(r.schedule) },
    };
  }

  /** rev の時点の head と、paths のファイルの中身({ oid, text } か、なければ null) */
  async function readFiles(rev, paths) {
    const variables = { owner, name, rev };
    const fields = paths.map((path, i) => {
      variables[`e${i}`] = `${rev}:${path}`;
      return `f${i}: object(expression: $e${i}) { oid ... on Blob { text } }`;
    });
    const declared = paths.map((_, i) => `, $e${i}: String!`).join("");
    const data = await graphql(
      `query($owner: String!, $name: String!, $rev: String!${declared}) {
        repository(owner: $owner, name: $name) { head: object(expression: $rev) { oid } ${fields.join(" ")} }
      }`,
      variables,
    );
    const r = data.repository;
    if (!r?.head) throw new Error(`ブランチ ${rev} が見つかりません`);
    return { head: r.head.oid, files: Object.fromEntries(paths.map((path, i) => [path, blob(r[`f${i}`])])) };
  }

  /** 確認待ちの PR のブランチに、その後に main へ入った変更を取り込む(同じファイルを別の PR が先に変えていると、ここでぶつかる) */
  async function catchUp(branch) {
    const merged = await rest("POST", "/merges", { base: branch, head: BASE, commit_message: "main の変更を取り込む" }, { allow: [409] });
    if (merged.status === 409) {
      throw new ConflictError("確認待ちの変更が、そのあと公開されたほかの変更とぶつかっています。運営に PR を見てもらってください。");
    }
  }

  /** PR がないときに、ブランチを main の sha から作り直す(前の PR がマージ・クローズ済みでブランチが残っていても) */
  async function resetBranch(branch, sha) {
    const created = await rest("POST", "/git/refs", { ref: `refs/heads/${branch}`, sha }, { allow: [422] });
    if (created.status === 422) await rest("PATCH", `/git/refs/heads/${branch}`, { sha, force: true });
  }

  async function commit({ branch, expectedHeadOid, headline, body, additions = [], deletions = [] }) {
    const data = await graphql(
      `mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid url } } }`,
      {
        input: {
          branch: { repositoryNameWithOwner: repo, branchName: branch },
          message: { headline, ...(body ? { body } : {}) },
          expectedHeadOid,
          fileChanges: { additions, deletions: deletions.map((path) => ({ path })) },
        },
      },
    );
    return data.createCommitOnBranch.commit;
  }

  const summary = (pull) => (pull ? { number: pull.number, url: pull.html_url } : null);

  return {
    findOpenPull,
    readContent,
    readFiles,

    /** 編集画面に出す内容。確認待ちの PR があれば、そのブランチ(本人の変更が入った状態)を読む */
    async load(discordId) {
      const branch = editBranch(discordId);
      const pull = await findOpenPull(branch);
      const ref = pull ? branch : BASE;
      const { head, files } = await readContent(ref);
      return { ref, head, pull: summary(pull), files };
    },

    /**
     * 編集した人のブランチに 1 つコミットし、PR がなければ作る。
     * change(files) は paths の今の中身を受け取り、{ headline, additions: [{ path, contents(base64) }], deletions: [path] }、
     * 変更がなければ { unchanged: true }、問題があれば { error } を返す。
     */
    async save({ discordId, paths, change, message, pullTitle, pullBody }) {
      const branch = editBranch(discordId);
      let pull = await findOpenPull(branch);
      if (pull) await catchUp(branch);
      // PR がなければ main を読み、変更があるときだけブランチを作る(何も変えずに保存したときに、空のブランチを残さない)
      const { head, files } = await readFiles(pull ? branch : BASE, paths);
      const result = change(files);
      if (result.error || result.unchanged) return { ...result, pull: summary(pull) };
      if (!pull) await resetBranch(branch, head);
      const made = await commit({ branch, expectedHeadOid: head, headline: result.headline, body: message, additions: result.additions, deletions: result.deletions });
      if (!pull) pull = (await rest("POST", "/pulls", { title: pullTitle, head: branch, base: BASE, body: pullBody })).data;
      return { commit: made, pull: summary(pull) };
    },
  };
}
