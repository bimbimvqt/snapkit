import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import { mobileConfigWithDefaults } from "@/lib/mobile-config";
import { defaultSubscriptionConfig, parseSubscriptionConfig } from "@/lib/subscription-plans";

export const dynamic = "force-dynamic";

export async function GET() {
  const [flags, config, subscriptionConfig] = await Promise.all([
    db.featureFlag.findMany({ orderBy: { key: "asc" } }),
    db.appConfig.findUnique({ where: { key: "mobile" } }),
    db.appConfig.findUnique({ where: { key: "subscription_plans" } }),
  ]);
  const mobile = mobileConfigWithDefaults(config?.value);
  return ok({
    flags: Object.fromEntries(flags.map((flag) => [flag.key, flag.enabled])),
    mobile: { ...mobile, pro: subscriptionConfig ? parseSubscriptionConfig(subscriptionConfig.value) : defaultSubscriptionConfig },
  });
}
