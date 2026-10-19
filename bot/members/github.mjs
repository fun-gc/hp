// /profile の変更を GitHub の PR にする。運営がマージすると Cloudflare Pages が再ビルドしてサイトに載る。
// 1 人につきブランチ member/<DiscordのユーザーID> と PR を 1 つだけ使い、マージ前に何度送っても同じ PR に積む。
// Cloudflare(Pages Functions)と Node のどちらでも動くよう、fetch だけを使う。

const API = "https://api.github.com";
const BASE = "main";

export const memberPath = (discordId) => `content/members/${discordId}.json`;
export const memberBranch = (discordId) => `member/${discordId}`;

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(base64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** token はトークンを返す関数(GitHub App のトークンは期限があるので、使うたびに聞く) */
export function createGitHub({ token, repo, fetch = globalThis.fetch }) {
  const owner = repo.split("/")[0];

  async function api(method, route, body) {
    const res = await fetch(`${API}/repos/${repo}${route}`, {
      method,
      headers: {
        Authorization: `Bearer ${await token()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "FUNGC-site-members",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404) return null;
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      const hint = { 401: "トークンが正しくないか期限切れです", 403: "Contents と Pull requests の書き込みの権限がありません" }[res.status];
      const err = new Error(`GitHub API ${method} ${route} が ${res.status} を返しました${hint ? `(${hint})` : ""}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const findOpenPull = async (branch) =>
    (await api("GET", `/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`))?.[0] ?? null;

  async function readJson(path, ref) {
    const file = await api("GET", `/contents/${path}?ref=${encodeURIComponent(ref)}`);
    return file ? { sha: file.sha, data: JSON.parse(fromBase64(file.content)) } : null;
  }

  // 前の PR がマージ・クローズ済みで古いブランチが残っていても、main から作り直す
  async function resetBranch(branch) {
    const { object } = await api("GET", `/git/ref/heads/${BASE}`);
    try {
      await api("POST", "/git/refs", { ref: `refs/heads/${branch}`, sha: object.sha });
    } catch (err) {
      if (err.status !== 422) throw err;
      await api("PATCH", `/git/refs/heads/${branch}`, { sha: object.sha, force: true });
    }
  }

  // PR の題と説明は最後に送った内容に合わせる(登録の PR が途中で削除に変わることもある)
  const upsertPull = (pull, branch, title, body) =>
    pull
      ? api("PATCH", `/pulls/${pull.number}`, { title, body })
      : api("POST", "/pulls", { title, head: branch, base: BASE, body });

  return {
    /** 登録内容を読む。審査中の PR があればその内容を返す */
    async loadMember(discordId) {
      const pull = await findOpenPull(memberBranch(discordId));
      const file = await readJson(memberPath(discordId), pull ? memberBranch(discordId) : BASE);
      return { member: file?.data ?? null, pull };
    },

    /**
     * update(今の内容) が返したメンバーを書き込み、PR を作る(あれば積む)。
     * update が { error } を返したら何も書かずにそれを返す。
     */
    async saveMember(discordId, update, { title, body, committer }) {
      const branch = memberBranch(discordId);
      const path = memberPath(discordId);
      let pull = await findOpenPull(branch);
      if (!pull) await resetBranch(branch);
      const current = await readJson(path, branch);
      const result = update(current?.data ?? null);
      if (result.error) return result;

      await api("PUT", `/contents/${path}`, {
        message: title,
        content: toBase64(result.content),
        branch,
        committer,
        ...(current ? { sha: current.sha } : {}),
      });
      pull = await upsertPull(pull, branch, title, body);
      return { ...result, pull };
    },

    /**
     * 掲載をやめる。main にファイルがあれば消す PR を作り、まだ載っていない(審査中だけ)なら PR を閉じる。
     */
    async deleteMember(discordId, { title, body, committer }) {
      const branch = memberBranch(discordId);
      const path = memberPath(discordId);
      let pull = await findOpenPull(branch);
      const published = await readJson(path, BASE);
      if (!published) {
        if (!pull) return { status: "missing" };
        await api("PATCH", `/pulls/${pull.number}`, { state: "closed" });
        return { status: "withdrawn", pull };
      }
      if (!pull) await resetBranch(branch);
      const current = await readJson(path, branch);
      if (current) await api("DELETE", `/contents/${path}`, { message: title, sha: current.sha, branch, committer });
      pull = await upsertPull(pull, branch, title, body);
      return { status: "requested", pull };
    },
  };
}
