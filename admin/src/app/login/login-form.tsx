"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import Button from "@/components/ui/button";
import { BrandMark } from "@/components/brand/brand-mark";
import { SeraField } from "@/components/sera/field";
import { SeraSurface } from "@/components/sera/surface";
import { clientBackendFetch } from "@/lib/api-response";
export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await clientBackendFetch<{ user: { role: string } }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: String(data.get("email") ?? "").trim(), password: data.get("password") }),
      });
      if (result.user?.role !== "ADMIN") {
        setError("Tài khoản này không có quyền quản trị. Vui lòng dùng tài khoản admin.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không thể đăng nhập. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }
  return <SeraSurface className="w-full max-w-[460px] overflow-hidden p-2"><div className="rounded-[20px] bg-[var(--surface-raised)] p-7 sm:p-9"><BrandMark /><div className="mt-10"><span className="mb-5 grid size-12 place-items-center rounded-2xl border bg-[var(--surface)] text-[var(--brand)]"><LockKeyhole size={21} /></span><h1 className="text-3xl font-semibold tracking-[-.04em]">Admin command center</h1><p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Quản lý vận hành, không gian riêng tư và trải nghiệm Snapkit.</p></div><form className="mt-8 grid gap-3" onSubmit={submit}><SeraField id="email" name="email" label="Email" type="email" autoComplete="email" placeholder="admin@snapkit.local" required /><SeraField id="password" name="password" label="Mật khẩu" type="password" autoComplete="current-password" placeholder="Tối thiểu 8 ký tự" error={error} required /><Button type="submit" size="lg" loading={loading} iconRight={<ArrowRight size={18} />} className="mt-2 min-h-12 w-full rounded-2xl bg-[var(--accent)] text-[#102019] hover:bg-[#c8ff67]">Đăng nhập an toàn</Button></form></div></SeraSurface>;
}
