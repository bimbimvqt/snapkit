"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bell, Flag, LogOut, Menu, QrCode, Settings2, Users, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import Button from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/admin", label: "Tổng quan", icon: BarChart3 }, { href: "/admin/users", label: "Người dùng", icon: Users },
  { href: "/admin/qr", label: "QR Studio", icon: QrCode }, { href: "/admin/config", label: "Cấu hình app", icon: Settings2 }, { href: "/admin/audit", label: "Audit log", icon: Flag },
];

export function AppShell({ children, email }: { children: ReactNode; email?: string | null }) {
  const pathname = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false); const [loggingOut, setLoggingOut] = useState(false);
  async function logout() { setLoggingOut(true); try { const response = await fetch("/backend/api/v1/auth/logout", { method: "POST" }); if (response.ok) { router.replace("/login"); router.refresh(); } } finally { setLoggingOut(false); } }
  return <div className="min-h-screen lg:grid lg:grid-cols-[272px_1fr]"><a href="#main-content" className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-[#102019] transition focus:translate-y-0">Bỏ qua điều hướng</a>
    {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
    <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-[272px] -translate-x-full flex-col border-r bg-[var(--surface)] p-5 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0", open && "translate-x-0")}>
      <div className="flex items-center justify-between"><BrandMark /><Button variant="ghost" iconLeft={<X size={19} />} aria-label="Đóng menu" className="lg:hidden" onClick={() => setOpen(false)} /></div>
      <nav className="mt-10 grid gap-2" aria-label="Điều hướng quản trị">{navigation.map(({ href, label, icon: Icon }) => { const active = href === "/admin" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} onClick={() => setOpen(false)} className={cn("flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold text-[var(--ink-muted)] transition hover:bg-[var(--surface-raised)] hover:text-[var(--ink)]", active && "bg-[var(--accent)] text-[#102019] shadow-[0_8px_24px_rgba(183,243,77,.12)]")}><Icon size={19} strokeWidth={active ? 2.4 : 1.8} />{label}</Link>; })}</nav>
      <div className="mt-auto rounded-2xl border bg-[var(--surface-raised)] p-4"><Badge size="sm" className="bg-[color-mix(in_srgb,var(--brand)_18%,transparent)] text-[var(--brand-strong)]">Production ready</Badge><p className="mt-3 truncate text-sm font-semibold">{email}</p><p className="mt-1 text-xs text-[var(--ink-muted)]">Backend độc lập · API v1</p></div>
    </aside>
    <div className="min-w-0"><header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b bg-[color-mix(in_srgb,var(--canvas)_88%,transparent)] px-5 backdrop-blur-xl sm:px-8"><div className="flex items-center gap-3"><Button variant="outline" iconLeft={<Menu size={20} />} aria-label="Mở menu" className="lg:hidden" onClick={() => setOpen(true)} /><div><p className="label">Operations</p><p className="text-sm font-semibold">Toolbox control room</p></div></div><div className="flex items-center gap-2"><Button variant="outline" iconLeft={<Bell size={19} />} aria-label="Thông báo" className="rounded-xl border-[var(--line)] bg-[var(--surface)]" /><Button variant="outline" iconLeft={<LogOut size={18} />} loading={loggingOut} onClick={logout} className="rounded-xl border-[var(--line)] bg-[var(--surface)]"><span className="hidden sm:inline">Đăng xuất</span></Button></div></header><main id="main-content" tabIndex={-1} className="mx-auto max-w-[1500px] p-5 sm:p-8 lg:p-10">{children}</main></div>
  </div>;
}
