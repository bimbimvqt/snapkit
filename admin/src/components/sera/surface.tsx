import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
export function SeraSurface({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) { return <section className={cn("sera-surface", className)} {...props}>{children}</section>; }
export function SeraSectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) { return <div className="flex items-end justify-between gap-4"><div>{eyebrow && <p className="label mb-2">{eyebrow}</p>}<h2 className="text-xl font-semibold tracking-tight">{title}</h2></div>{action}</div>; }
