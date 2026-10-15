import Link from "next/link";
import { Cube } from "@/components/Cube";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-24 sm:px-6">
      <Cube color="red" className="size-16" />
      <p className="font-display text-7xl font-bold text-fun-red">404</p>
      <h1 className="text-2xl font-black">ページが見つかりませんでした</h1>
      <Link href="/" className="bg-ink px-5 py-3 font-bold text-white hover:bg-fun-red">
        トップページへ戻る
      </Link>
    </div>
  );
}
