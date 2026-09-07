"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Crown, Flag, Images, LogOut, Menu, QrCode, Settings2, Sparkles, Users, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import Button from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/brand/brand-mark";
import { clientBackendFetch } from "@/lib/api-response";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/admin", label: "Tổng quan", icon: BarChart3 },
  { href: "/admin/users", label: "Người dùng", icon: Users },
  { href: "/admin/qr", label: "QR Studio", icon: QrCode },
  { href: "/admin/ai-caption", label: "AI Studio", icon: Sparkles },
  { href: "/admin/media-scans", label: "Media đã quét", icon: Images },
  { href: "/admin/subscriptions", label: "Gói Pro", icon: Crown },
  { href: "/admin/config", label: "Cấu hình app", icon: Settings2 },
  { href: "/admin/audit", label: "Audit log", icon: Flag },
];

export function AppShell({ children, email }: { children: ReactNode; email?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  function closeMenu() {
    menuRef.current?.close();
    setOpen(false);
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await clientBackendFetch("/api/v1/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      setLogoutError("Chưa thể đăng xuất. Vui lòng thử lại.");
    } finally {
      setLoggingOut(false);
    }
  }

  function sidebar(mobile: boolean) {
    return <>
      <div className="flex items-center justify-between gap-4">
        <BrandMark />
        {mobile && <Button variant="ghost" iconLeft={<X size={19} />} aria-label="Đóng menu" className="min-h-11 min-w-11" onClick={closeMenu} />}
      </div>
      <nav className="my-8 grid gap-2" aria-label="Điều hướng quản trị">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={closeMenu} className={cn("flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold text-[var(--ink-muted)] transition hover:bg-[var(--surface-raised)] hover:text-[var(--ink)]", active && "bg-[var(--accent)] text-[#102019] shadow-[0_8px_24px_rgba(183,243,77,.12)]")}><Icon size={19} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />{label}</Link>;
        })}
      </nav>
      <div className="mt-auto rounded-2xl border bg-[var(--surface-raised)] p-4">
        <Badge size="sm" className="bg-[color-mix(in_srgb,var(--brand)_18%,transparent)] text-[var(--brand-strong)]">Quản trị viên</Badge>
        <p className="mt-3 truncate text-sm font-semibold">{email}</p>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">Snapkit Admin</p>
      </div>
    </>;
  }

  return <div className="min-h-screen lg:grid lg:grid-cols-[272px_1fr]">
    <a href="#main-content" className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-[#102019] transition focus:translate-y-0">Bỏ qua điều hướng</a>
    <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r bg-[var(--surface)] p-5 lg:flex">{sidebar(false)}</aside>
    <dialog ref={menuRef} id="admin-navigation" aria-label="Menu quản trị" onClose={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) closeMenu(); }} className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(320px,calc(100vw-2rem))] max-w-none border-r bg-[var(--surface)] p-0 text-[var(--ink)] backdrop:bg-black/60">
      <div className="flex min-h-full flex-col p-5">{sidebar(true)}</div>
    </dialog>
    <div className="min-w-0">
      <header className="sticky top-0 z-20 border-b bg-[color-mix(in_srgb,var(--canvas)_88%,transparent)] backdrop-blur-xl">
        <div className="flex min-h-20 items-center justify-between gap-3 px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" iconLeft={<Menu size={20} />} aria-label="Mở menu" aria-controls="admin-navigation" aria-expanded={open} className="min-h-11 min-w-11 shrink-0 lg:hidden" onClick={() => { menuRef.current?.showModal(); setOpen(true); }} />
            <div className="min-w-0"><p className="label">Operations</p><p className="truncate text-sm font-semibold">Snapkit control room</p></div>
          </div>
          <Button variant="outline" iconLeft={<LogOut size={18} />} aria-label="Đăng xuất" loading={loggingOut} onClick={logout} className="min-h-11 min-w-11 shrink-0 rounded-xl border-[var(--line)] bg-[var(--surface)]"><span className="hidden sm:inline">Đăng xuất</span></Button>
        </div>
        {logoutError && <p role="alert" className="px-5 pb-3 text-sm text-[var(--danger)] sm:px-8">{logoutError}</p>}
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1500px] p-5 sm:p-8 lg:p-10">{children}</main>
    </div>
  </div>;
}
