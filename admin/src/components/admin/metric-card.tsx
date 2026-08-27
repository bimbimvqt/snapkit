import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { SeraSurface } from "@/components/sera/surface";
export function MetricCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: LucideIcon }) { return <SeraSurface className="p-5"><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-[var(--surface-raised)] text-[var(--brand)]"><Icon size={20} /></span><ArrowUpRight className="text-[var(--ink-muted)]" size={17} /></div><p className="mt-6 text-3xl font-semibold tracking-[-.05em]">{value}</p><p className="mt-2 text-sm font-semibold">{label}</p><p className="mt-1 text-xs text-[var(--ink-muted)]">{note}</p></SeraSurface>; }

