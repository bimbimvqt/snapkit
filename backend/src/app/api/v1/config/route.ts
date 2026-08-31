import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import { defaultSubscriptionConfig, parseSubscriptionConfig } from "@/lib/subscription-plans";

export const dynamic = "force-dynamic";

export async function GET() {
  const [flags, config, subscriptionConfig] = await Promise.all([
    db.featureFlag.findMany({ orderBy: { key: "asc" } }),
    db.appConfig.findUnique({ where: { key: "mobile" } }),
    db.appConfig.findUnique({ where: { key: "subscription_plans" } }),
  ]);
  const mobile = config?.value && typeof config.value === "object" && !Array.isArray(config.value) ? config.value : { maintenance: false, adMode: "test", interstitialEvery: 3 };
  return ok({
    flags: Object.fromEntries(flags.map((flag) => [flag.key, flag.enabled])),
    mobile: { ...mobile, pro: subscriptionConfig ? parseSubscriptionConfig(subscriptionConfig.value) : defaultSubscriptionConfig },
  });
}
