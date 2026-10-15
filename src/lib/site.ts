// サイト全体の設定。リンクや連絡先を変えるときはここだけ直せばよい。
export const site = {
  name: "FUN GC",
  fullName: "FUN GC(公立はこだて未来大学 ゲーム制作サークル)",
  description:
    "公立はこだて未来大学のゲーム制作サークル FUN GC の公式サイト。Unity を使ったゲーム開発講座、新入生歓迎イベント Miraive や未来祭でのゲーム展示、チームでの長期ゲーム開発をしています。",
  url: "https://fungc.org",
  university: "公立はこだて未来大学",
  email: "contact@fungc.org",
  // Google フォームの URL が決まったら入れる。空のままならボタンは出ない。
  contactFormUrl: "",
  // 講座資料のリポジトリ。公開されるまでは courseRepoPublic を false にしておく。
  courseRepoUrl: "https://github.com/yugetu12/fungc-unity-course/tree/unity-base-0",
  courseRepoPublic: false,
  social: {
    x: "https://x.com/fugutwi",
    github: "https://github.com/fun-gc",
  },
  events: {
    welcome: "Miraive(ミライブ)",
    festival: "未来祭",
  },
} as const;

export const navItems = [
  { href: "/about/", label: "活動紹介", en: "ABOUT" },
  { href: "/course/", label: "講座", en: "COURSE" },
  { href: "/works/", label: "作品", en: "WORKS" },
  { href: "/members/", label: "メンバー", en: "MEMBERS" },
  { href: "/news/", label: "お知らせ", en: "NEWS" },
  { href: "/join/", label: "入部案内", en: "JOIN" },
] as const;
