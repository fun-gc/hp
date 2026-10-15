// テンプレートの小さなキューブアイコン。1 面だけ色が付く。
type Face = "top" | "left" | "right";
type Color = "red" | "green" | "yellow";

const colorVar: Record<Color, string> = {
  red: "var(--color-fun-red)",
  green: "var(--color-fun-green)",
  yellow: "var(--color-fun-yellow)",
};

const defaultFace: Record<Color, Face> = { red: "top", green: "left", yellow: "right" };

export function Cube({
  color,
  face = defaultFace[color],
  className = "size-7",
}: {
  color: Color;
  face?: Face;
  className?: string;
}) {
  const fill = (f: Face) => (f === face ? colorVar[color] : f === "top" ? "#ecebe6" : "#dddcd6");
  return (
    <svg viewBox="0 0 40 44" className={className} aria-hidden="true">
      <polygon points="20,2 38,12 20,22 2,12" fill={fill("top")} />
      <polygon points="2,12 20,22 20,42 2,32" fill={fill("left")} />
      <polygon points="20,22 38,12 38,32 20,42" fill={fill("right")} />
    </svg>
  );
}

export const cubeCycle: Color[] = ["red", "green", "yellow"];
