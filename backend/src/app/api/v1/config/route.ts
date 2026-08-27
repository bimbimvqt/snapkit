import { db } from "@/lib/db";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const [flags, config] = await Promise.all([db.featureFlag.findMany({ orderBy: { key: "asc" } }), db.appConfig.findUnique({ where: { key: "mobile" } })]);
  return ok({ flags: Object.fromEntries(flags.map((flag) => [flag.key, flag.enabled])), mobile: config?.value ?? { maintenance: false, adMode: "test", interstitialEvery: 3 } });
}

