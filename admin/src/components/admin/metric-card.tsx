import type { LucideIcon } from "lucide-react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { SeraSurface } from "@/components/sera/surface";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  change,
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  change?: number | null;
}) {
  const TrendIcon = change === null || change === undefined || change === 0 ? Minus : change > 0 ? TrendingUp : TrendingDown;
  return (
    <SeraSurface className="p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-[var(--surface-raised)] text-[var(--brand)]">
          <Icon size={20} aria-hidden="true" />
        </span>
        {change !== undefined && (
          <span
            className={cn(
              "inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 text-xs font-bold tabular-nums",
              change !== null && change > 0 && "bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand-strong)]",
              change !== null && change < 0 && "bg-[color-mix(in_srgb,var(--danger)_11%,transparent)] text-[var(--danger)]",
              (change === null || change === 0) && "bg-[var(--surface-raised)] text-[var(--ink-muted)]",
            )}
            aria-label={
              change === null
                ? "Không có dữ liệu kỳ trước"
                : `${change >= 0 ? "Tăng" : "Giảm"} ${Math.abs(change)} phần trăm so với 30 ngày trước`
            }
          >
            <TrendIcon size={14} aria-hidden="true" />
            {change === null ? "Mới" : `${change > 0 ? "+" : ""}${change}%`}
          </span>
        )}
      </div>
      <p className="mt-6 text-3xl font-semibold tracking-[-.05em] tabular-nums">{value}</p>
      <p className="mt-2 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{note}</p>
    </SeraSurface>
  );
}
