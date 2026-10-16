import type { Work } from "./schema";

// サムネイルは「自前の画像・GIF」→「YouTube のサムネイル」の順で使う
export function workPoster(work: Work) {
  return work.thumbnail ?? (work.youtubeId ? `https://i.ytimg.com/vi/${work.youtubeId}/hqdefault.jpg` : undefined);
}
