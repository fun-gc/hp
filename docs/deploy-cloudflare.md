# 公開の仕組み(Cloudflare Pages)

```
GitHub (fun-gc/hp)
  ├─ PR を作る      → Cloudflare Pages がプレビュー用 URL を発行(PR にコメントが付く)
  └─ main にマージ  → Cloudflare Pages が本番 https://fungc.org を更新
```

ビルドは `next build`、書き出し先は `out/`。サーバーは使わない静的サイトなので、Cloudflare の無料枠(ビルド月 500 回)で足ります。

## 初回の設定(管理者が 1 回だけ)

### 1. Cloudflare Pages とリポジトリをつなぐ

参考: [Deploy a static Next.js site](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/)

1. Cloudflare ダッシュボード → **Workers & Pages** → **Create application** → **Pages** タブ → **Import an existing Git repository**
2. GitHub と接続し、Cloudflare のアプリのインストール先に **fun-gc** 組織を選び、`hp` リポジトリへのアクセスを許可する
3. `fun-gc/hp` を選んで **Begin setup**
4. **Framework preset** に **Next.js (Static HTML Export)** を選ぶ(Build command `npx next build`、Build output directory `out` が自動で入る)
5. **Save and Deploy**

Node.js のバージョンはリポジトリの `.node-version`(22)で指定しています。

### 2. 独自ドメイン fungc.org

Pages のプロジェクト → **Custom domains** → `fungc.org` を追加。ドメインの DNS が Cloudflare にあれば、レコードは自動で作られます。`www.fungc.org` も追加しておくと安心です。

### 3. 年度替わりの自動再ビルド

メンバーの学年はビルドした日を基準に計算するので、毎年 4 月 1 日に再ビルドします(`.github/workflows/yearly-rebuild.yml`)。

1. Pages のプロジェクト → **Settings** → **Builds** → **Deploy hooks** で、ブランチ `main` のフックを作り URL をコピー
2. GitHub の `fun-gc/hp` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**、名前 `CF_PAGES_DEPLOY_HOOK` で URL を貼る

### 4. main ブランチの保護(PR 必須・1 人承認)

GitHub の `fun-gc/hp` → **Settings** → **Rules** → **Rulesets** → **New branch ruleset**

- Target: `main`(Include default branch)
- **Require a pull request before merging** → Required approvals: 1
- **Require status checks to pass** → `build` を追加
- 運営が 1 人しかいない間は、自分の PR を承認できないので **Bypass list** に組織の管理者(Organization admin)を入れておく

### 5. 引き継ぎに備える

Cloudflare アカウントは個人のメールアドレスで作っているので、サークル共用の Google アカウントを **Manage Account → Members** から管理者として招待しておくと、卒業時の引き継ぎが楽になります。GitHub の組織 `fun-gc` にも、共用アカウントか次の運営を Owner として入れておきます。
