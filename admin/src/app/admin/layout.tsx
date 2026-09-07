import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/admin/app-shell";
import { BackendError, backendFetch, type AdminSessionUser } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  let user: AdminSessionUser;

  try {
    user = await backendFetch<AdminSessionUser>("/api/v1/auth/me");
  } catch (error) {
    if (error instanceof BackendError && (error.status === 401 || error.status === 403)) {
      redirect("/login");
    }
    throw error;
  }

  if (user.role !== "ADMIN") redirect("/login");
  return <AppShell email={user.email}>{children}</AppShell>;
}
