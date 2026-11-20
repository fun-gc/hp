"use client";

// 編集画面の入力欄とボタン。見た目はサイトと同じ色(globals.css の @theme)にそろえる
import { marked } from "marked";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { todayInJapan } from "@/lib/date";

export const inputClass =
  "w-full border border-ink/40 bg-white/80 px-3 py-2 text-[15px] leading-relaxed text-ink placeholder:text-muted/60 focus:border-ink focus:outline-none focus:ring-2 focus:ring-fun-yellow disabled:opacity-60";

export const buttonClass = {
  primary:
    "inline-flex items-center gap-2 bg-ink px-5 py-2.5 font-mono text-sm font-medium tracking-[0.14em] text-white transition-colors hover:bg-fun-yellow hover:text-ink disabled:pointer-events-none disabled:opacity-50",
  secondary:
    "inline-flex items-center gap-2 border border-ink px-4 py-2 font-mono text-xs font-medium tracking-[0.14em] transition-colors hover:bg-ink hover:text-paper disabled:pointer-events-none disabled:opacity-50",
  danger:
    "inline-flex items-center gap-2 border border-fun-red-ink px-4 py-2 font-mono text-xs font-medium tracking-[0.14em] text-fun-red-ink transition-colors hover:bg-fun-red-ink hover:text-white disabled:pointer-events-none disabled:opacity-50",
};

export function Field({ label, hint, className = "", children }: { label: string; hint?: ReactNode; className?: string; children: ReactNode }) {
  // 説明(hint)は label の外に置き、入力欄の名前に混ざらないようにする
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block space-y-1.5">
        <span className="block text-sm font-bold">{label}</span>
        {children}
      </label>
      {hint && <p className="text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

type TextProps = { label: string; hint?: ReactNode; className?: string; value: string; onChange: (value: string) => void } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "className"
>;

export function TextField({ label, hint, className, value, onChange, ...rest }: TextProps) {
  return (
    <Field label={label} hint={hint} className={className}>
      <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </Field>
  );
}

export function TextArea({
  label,
  hint,
  className,
  value,
  onChange,
  rows = 4,
  maxLength,
  mono = false,
}: {
  label: string;
  hint?: ReactNode;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
  mono?: boolean;
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <textarea
        className={`${inputClass} ${mono ? "font-mono text-sm" : ""}`}
        value={value}
        rows={rows}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  className,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: ReactNode;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Field label={label} hint={hint} className={className}>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckboxGroup({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: ReactNode;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-sm font-bold">{label}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-[15px]">
            <input
              type="checkbox"
              className="size-4 accent-ink"
              checked={value.includes(o.value)}
              onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))}
            />
            {o.label}
          </label>
        ))}
      </div>
      {hint && <p className="text-xs leading-relaxed text-muted">{hint}</p>}
    </fieldset>
  );
}

export function Checkbox({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (checked: boolean) => void; hint?: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-[15px] font-bold">
        <input type="checkbox" className="size-4 accent-ink" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {hint && <p className="text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

/** Markdown の本文。サイトと同じ marked で、お知らせのページと同じ見た目のプレビューを出す */
export function MarkdownField({ label, hint, value, onChange }: { label: string; hint?: ReactNode; value: string; onChange: (value: string) => void }) {
  const [preview, setPreview] = useState(false);
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={id} className="text-sm font-bold">
          {label}
        </label>
        <div className="flex font-mono text-[11px] tracking-[0.14em]" role="group" aria-label="表示の切り替え">
          {[
            [false, "EDIT"],
            [true, "PREVIEW"],
          ].map(([on, text]) => (
            <button
              key={String(text)}
              type="button"
              aria-pressed={preview === on}
              onClick={() => setPreview(Boolean(on))}
              className={`border border-ink px-2.5 py-1 first:border-r-0 ${preview === on ? "bg-ink text-white" : "hover:bg-fun-yellow"}`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      {preview ? (
        // 自分で書いた文を自分のブラウザで見るだけ。保存のときはサーバーで HTML のタグを通さない
        <div className="prose-fun min-h-48 border border-ink/40 bg-white/80 px-4 py-3" dangerouslySetInnerHTML={{ __html: marked.parse(value || "(本文がありません)", { async: false }) }} />
      ) : (
        <textarea id={id} className={`${inputClass} min-h-72 font-mono text-sm`} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <p className="text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

/** 一覧と、選んだものの入力欄を左右に並べる(狭い画面では上下) */
export function ListDetail({ list, children }: { list: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-14">
      <div>{list}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function ListButton({ active, onClick, children, muted = false }: { active: boolean; onClick: () => void; children: ReactNode; muted?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`block w-full border-b border-ink/20 px-2 py-3 text-left transition-colors ${active ? "bg-fun-yellow" : "hover:bg-paper-2"} ${muted ? "text-muted" : ""}`}
    >
      {children}
    </button>
  );
}

/** 「、」「,」で区切った入力を配列にする */
export const splitList = (text: string) =>
  text
    .split(/[、,，]/)
    .map((s) => s.trim())
    .filter(Boolean);

/** 1 行に 1 つの入力を配列にする */
export const splitLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

export const toNumber = (text: string) => (text.trim() === "" ? undefined : Number(text));

/** 日本時間の今日(YYYY-MM-DD) */
export const today = () => todayInJapan();

export function FormTitle({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="border-b border-ink pb-3">
      <h2 className="text-xl font-extrabold">{children}</h2>
      {note && <p className="mt-1 font-mono text-xs text-muted">{note}</p>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="border border-dashed border-ink/40 px-5 py-10 text-center text-sm text-muted">{children}</p>;
}

/** 読み込めなかったファイル。編集画面では直せないので、GitHub で直してもらう */
export function Broken({ path, message }: { path: string; message: string }) {
  return (
    <div className="space-y-2 border-l-4 border-fun-red-ink bg-white/60 px-5 py-4 text-sm">
      <p className="font-bold">{path} を読み込めませんでした。</p>
      <p className="text-muted">{message}</p>
      <p>
        GitHub の{" "}
        <a className="underline underline-offset-4 hover:bg-fun-yellow" href={`https://github.com/fun-gc/hp/blob/main/${path}`} target="_blank" rel="noreferrer">
          ファイルの画面
        </a>{" "}
        から直してください。
      </p>
    </div>
  );
}

/** 保存と削除のボタン。削除はもう一度押してもらってから */
export function FormActions({ busy, isNew, onDelete }: { busy: boolean; isNew: boolean; onDelete?: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-ink/25 pt-6">
      <button type="submit" disabled={busy} className={buttonClass.primary}>
        {busy ? "保存しています…" : isNew ? "追加する" : "保存する"}
      </button>
      {!isNew &&
        onDelete &&
        (confirming ? (
          <>
            <span className="text-sm font-bold text-fun-red-ink">本当に削除しますか?</span>
            <button type="button" className={buttonClass.danger} onClick={onDelete} disabled={busy}>
              削除する
            </button>
            <button type="button" className={buttonClass.secondary} onClick={() => setConfirming(false)}>
              やめる
            </button>
          </>
        ) : (
          <button type="button" className={`${buttonClass.danger} sm:ml-auto`} onClick={() => setConfirming(true)} disabled={busy}>
            削除
          </button>
        ))}
    </div>
  );
}
