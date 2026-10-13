import { cn } from "@/lib/utils";

export function SummaryTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string | null;
  tone?: "sage" | "oxide";
}) {
  return (
    <div className="desk-panel p-6">
      <p className="field-label">{label}</p>
      <p
        className={cn(
          "display mt-4 whitespace-nowrap text-[clamp(1.45rem,1.9vw,2.2rem)] leading-none",
          tone === "oxide"
            ? "text-oxide-hi"
            : tone === "sage"
              ? "text-sage-hi"
              : "text-bone",
        )}
      >
        {value}
      </p>
      <p className="mt-4 truncate text-[12.5px] text-bone-faint">
        {detail ?? "-"}
      </p>
    </div>
  );
}
