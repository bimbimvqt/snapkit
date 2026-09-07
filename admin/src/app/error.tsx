"use client";

import { ErrorState } from "@/components/admin/error-state";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="grid min-h-screen place-items-center p-5"><ErrorState retry={retry} /></main>;
}
