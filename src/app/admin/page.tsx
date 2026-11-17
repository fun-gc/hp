import type { Metadata } from "next";
import { AdminApp } from "@/components/admin/AdminApp";

// 編集画面。中身はブラウザでログインしてから読み込むので、ここでは枠だけを書き出す(docs/admin.md)
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminApp />;
}
