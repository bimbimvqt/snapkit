"use client";

import { ErrorState } from "@/components/admin/error-state";

export default function AdminError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState retry={retry} />;
}
