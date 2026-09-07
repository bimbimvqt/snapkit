"use client";

import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";
import Button from "@/components/ui/button";
import { SeraSurface } from "@/components/sera/surface";

export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <SeraSurface className="mx-auto grid w-full max-w-xl gap-5 p-7 sm:p-9">
      <TriangleAlert size={32} className="text-[var(--warning)]" aria-hidden="true" />
      <div role="alert">
        <h1 className="text-2xl font-semibold">Chưa thể tải trang quản trị</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">Máy chủ có thể đang bận hoặc mất kết nối. Hãy thử tải lại. Nếu phiên làm việc đã hết hạn, hãy đăng nhập lại.</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={retry} iconLeft={<RefreshCw size={18} />} className="min-h-12 rounded-xl">Thử lại</Button>
        <Link href="/login" className="rounded-lg px-2 py-3 text-sm font-semibold text-[var(--brand)] hover:underline">Đăng nhập lại</Link>
      </div>
    </SeraSurface>
  );
}
