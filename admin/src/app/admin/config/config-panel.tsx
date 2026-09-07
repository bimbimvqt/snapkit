"use client";

import { clientBackendFetch } from "@/lib/api-response";

import { type CSSProperties, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Check,
  Clock3,
  CloudUpload,
  Images,
  Layers3,
  Monitor,
  Moon,
  Navigation,
  RefreshCw,
  RectangleHorizontal,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sun,
} from "lucide-react";
import Button from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeraSectionTitle, SeraSurface } from "@/components/sera/surface";
import { cn } from "@/lib/utils";

type Flag = {
  key: string;
  description: string | null;
  enabled: boolean;
  rollout: number;
};
type ThemePreset =
  | "midnight_lime"
  | "ocean_cyan"
  | "violet_pulse"
  | "sunset_coral"
  | "mint_light"
  | "threads_mono";
type ThemeMode = "dark" | "light" | "system";
type NavigationStyle = "floating" | "glass" | "solid";
type ThemeSettings = { preset: ThemePreset; mode: ThemeMode; navigationStyle: NavigationStyle };
type CleanerSettings = {
  maxScanAssets: number;
  similarImageLimit: number;
  largeVideoThresholdMb: number;
  adminSyncEnabled: boolean;
  adminMediaUploadEnabled: boolean;
  adminSyncLimit: number;
  adminImagePreviewMaxPx: number;
  adminPreviewMaxFileMb: number;
};
type AdMode = "off" | "test" | "live";
type AdsSettings = {
  mode: AdMode;
  bannerEnabled: boolean;
  interstitialEnabled: boolean;
  interstitialEvery: number;
  minimumInterstitialIntervalSeconds: number;
  nonPersonalizedAds: boolean;
  androidBannerAdUnitId: string;
  iosBannerAdUnitId: string;
  androidInterstitialAdUnitId: string;
  iosInterstitialAdUnitId: string;
};
type MobileConfig = Record<string, unknown> & {
  theme?: Partial<ThemeSettings>;
  cleaner?: Partial<CleanerSettings>;
  ads?: Partial<AdsSettings>;
};

const defaultTheme: ThemeSettings = {
  preset: "midnight_lime",
  mode: "dark",
  navigationStyle: "floating",
};

const defaultCleaner: CleanerSettings = {
  maxScanAssets: 500,
  similarImageLimit: 180,
  largeVideoThresholdMb: 100,
  adminSyncEnabled: true,
  adminMediaUploadEnabled: false,
  adminSyncLimit: 100,
  adminImagePreviewMaxPx: 1280,
  adminPreviewMaxFileMb: 50,
};

const defaultAds: AdsSettings = {
  mode: "test",
  bannerEnabled: true,
  interstitialEnabled: true,
  interstitialEvery: 3,
  minimumInterstitialIntervalSeconds: 180,
  nonPersonalizedAds: true,
  androidBannerAdUnitId: "ca-app-pub-5682981484728700/2193696256",
  iosBannerAdUnitId: "ca-app-pub-5682981484728700/6627765287",
  androidInterstitialAdUnitId: "ca-app-pub-5682981484728700/6623895850",
  iosInterstitialAdUnitId: "ca-app-pub-5682981484728700/1072186276",
};

const adModes = [
  { id: "off" as const, name: "Tắt", description: "Không request quảng cáo trên app" },
  { id: "test" as const, name: "Kiểm thử", description: "Dùng test ID chính thức của Google" },
  { id: "live" as const, name: "Production", description: "Phân phối quảng cáo bằng ID thật" },
];

const presets: Array<{
  id: ThemePreset;
  name: string;
  description: string;
  colors: [string, string, string];
  canvas: string;
  surface: string;
  ink: string;
  lightCanvas: string;
  lightSurface: string;
  lightInk: string;
  recommendedNavigation?: NavigationStyle;
}> = [
  {
    id: "midnight_lime",
    name: "Midnight Lime",
    description: "Xanh đêm cao cấp",
    colors: ["#55D6A7", "#B7F34D", "#0B1513"],
    canvas: "#0B1513",
    surface: "#172622",
    ink: "#F2F8F5",
    lightCanvas: "#F3F8F6",
    lightSurface: "#FFFFFF",
    lightInk: "#13231D",
  },
  {
    id: "ocean_cyan",
    name: "Ocean Cyan",
    description: "Trong trẻo, công nghệ",
    colors: ["#22D3EE", "#67E8F9", "#07151C"],
    canvas: "#07151C",
    surface: "#102733",
    ink: "#ECFEFF",
    lightCanvas: "#F0FAFC",
    lightSurface: "#FFFFFF",
    lightInk: "#13231D",
  },
  {
    id: "violet_pulse",
    name: "Violet Pulse",
    description: "Sáng tạo, hiện đại",
    colors: ["#A78BFA", "#E879F9", "#100C1C"],
    canvas: "#100C1C",
    surface: "#221936",
    ink: "#FAF5FF",
    lightCanvas: "#F8F5FF",
    lightSurface: "#FFFFFF",
    lightInk: "#21172F",
  },
  {
    id: "sunset_coral",
    name: "Sunset Coral",
    description: "Ấm áp, nổi bật",
    colors: ["#FB7185", "#FDBA74", "#1C1012"],
    canvas: "#1C1012",
    surface: "#321C20",
    ink: "#FFF7ED",
    lightCanvas: "#FFF7F4",
    lightSurface: "#FFFFFF",
    lightInk: "#2A171A",
  },
  {
    id: "mint_light",
    name: "Mint Light",
    description: "Sáng, nhẹ và tối giản",
    colors: ["#0F9F72", "#84CC16", "#F3FAF7"],
    canvas: "#091713",
    surface: "#10241D",
    ink: "#F2F8F5",
    lightCanvas: "#F3FAF7",
    lightSurface: "#FFFFFF",
    lightInk: "#13231D",
  },
  {
    id: "threads_mono",
    name: "Threads Mono",
    description: "Đen trắng tối giản, thanh điều hướng kính",
    colors: ["#F5F5F5", "#D6D6D6", "#101010"],
    canvas: "#101010",
    surface: "#171717",
    ink: "#F5F5F5",
    lightCanvas: "#F7F7F7",
    lightSurface: "#FFFFFF",
    lightInk: "#111111",
    recommendedNavigation: "glass",
  },
];

const modes = [
  { id: "dark" as const, name: "Tối", icon: Moon },
  { id: "light" as const, name: "Sáng", icon: Sun },
  { id: "system" as const, name: "Theo máy", icon: Monitor },
];

const navigationStyles = [
  { id: "floating" as const, name: "Floating", description: "Thanh nổi bo tròn, khoảng thở rộng" },
  { id: "glass" as const, name: "Glass", description: "Bề mặt trong mờ, viền tinh tế" },
  { id: "solid" as const, name: "Solid", description: "Dock liền cạnh, chỉ báo tab rõ ràng" },
];

function parseTheme(config: MobileConfig): ThemeSettings {
  const input = config.theme ?? {};
  return {
    preset: presets.some((item) => item.id === input.preset) ? input.preset! : defaultTheme.preset,
    mode: modes.some((item) => item.id === input.mode) ? input.mode! : defaultTheme.mode,
    navigationStyle: navigationStyles.some((item) => item.id === input.navigationStyle)
      ? input.navigationStyle!
      : defaultTheme.navigationStyle,
  };
}

function parseCleaner(config: MobileConfig): CleanerSettings {
  const input = config.cleaner ?? {};
  return {
    maxScanAssets: typeof input.maxScanAssets === "number" ? input.maxScanAssets : defaultCleaner.maxScanAssets,
    similarImageLimit: typeof input.similarImageLimit === "number" ? input.similarImageLimit : defaultCleaner.similarImageLimit,
    largeVideoThresholdMb: typeof input.largeVideoThresholdMb === "number" ? input.largeVideoThresholdMb : defaultCleaner.largeVideoThresholdMb,
    adminSyncEnabled: typeof input.adminSyncEnabled === "boolean" ? input.adminSyncEnabled : defaultCleaner.adminSyncEnabled,
    adminMediaUploadEnabled: typeof input.adminMediaUploadEnabled === "boolean"
      ? input.adminMediaUploadEnabled
      : defaultCleaner.adminMediaUploadEnabled,
    adminSyncLimit: typeof input.adminSyncLimit === "number" ? input.adminSyncLimit : defaultCleaner.adminSyncLimit,
    adminImagePreviewMaxPx: typeof input.adminImagePreviewMaxPx === "number" ? input.adminImagePreviewMaxPx : defaultCleaner.adminImagePreviewMaxPx,
    adminPreviewMaxFileMb: typeof input.adminPreviewMaxFileMb === "number" ? input.adminPreviewMaxFileMb : defaultCleaner.adminPreviewMaxFileMb,
  };
}

function parseAds(config: MobileConfig): AdsSettings {
  const input = config.ads ?? {};
  const legacyMode = config.adMode === "off" || config.adMode === "test" || config.adMode === "live"
    ? config.adMode
    : defaultAds.mode;
  return {
    mode: adModes.some((item) => item.id === input.mode) ? input.mode! : legacyMode,
    bannerEnabled: typeof input.bannerEnabled === "boolean" ? input.bannerEnabled : defaultAds.bannerEnabled,
    interstitialEnabled: typeof input.interstitialEnabled === "boolean" ? input.interstitialEnabled : defaultAds.interstitialEnabled,
    interstitialEvery: typeof input.interstitialEvery === "number"
      ? input.interstitialEvery
      : typeof config.interstitialEvery === "number"
        ? config.interstitialEvery
        : defaultAds.interstitialEvery,
    minimumInterstitialIntervalSeconds: typeof input.minimumInterstitialIntervalSeconds === "number"
      ? input.minimumInterstitialIntervalSeconds
      : defaultAds.minimumInterstitialIntervalSeconds,
    nonPersonalizedAds: typeof input.nonPersonalizedAds === "boolean"
      ? input.nonPersonalizedAds
      : defaultAds.nonPersonalizedAds,
    androidBannerAdUnitId: typeof input.androidBannerAdUnitId === "string" && input.androidBannerAdUnitId.trim()
      ? input.androidBannerAdUnitId.trim()
      : defaultAds.androidBannerAdUnitId,
    iosBannerAdUnitId: typeof input.iosBannerAdUnitId === "string" && input.iosBannerAdUnitId.trim()
      ? input.iosBannerAdUnitId.trim()
      : defaultAds.iosBannerAdUnitId,
    androidInterstitialAdUnitId: typeof input.androidInterstitialAdUnitId === "string"
      && input.androidInterstitialAdUnitId.trim()
      ? input.androidInterstitialAdUnitId.trim()
      : defaultAds.androidInterstitialAdUnitId,
    iosInterstitialAdUnitId: typeof input.iosInterstitialAdUnitId === "string" && input.iosInterstitialAdUnitId.trim()
      ? input.iosInterstitialAdUnitId.trim()
      : defaultAds.iosInterstitialAdUnitId,
  };
}

function NumberSetting({
  id,
  label,
  description,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label htmlFor={id} className="rounded-2xl border bg-[var(--surface-raised)] p-4">
      <span className="block text-sm font-bold">{label}</span>
      <span className="mt-1 block min-h-10 text-xs leading-5 text-[var(--ink-muted)]">{description}</span>
      <span className="mt-3 flex items-center rounded-xl border bg-[var(--surface)] focus-within:border-[var(--brand)] focus-within:ring-4 focus-within:ring-[color-mix(in_srgb,var(--brand)_14%,transparent)]">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-h-12 min-w-0 flex-1 bg-transparent px-4 text-sm font-bold outline-none"
        />
        <span className="px-4 text-xs text-[var(--ink-muted)]">{suffix}</span>
      </span>
    </label>
  );
}

function TextSetting({
  id,
  label,
  description,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="rounded-2xl border bg-[var(--surface-raised)] p-4">
      <span className="block text-sm font-bold">{label}</span>
      <span className="mt-1 block min-h-10 text-xs leading-5 text-[var(--ink-muted)]">{description}</span>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 min-h-12 w-full rounded-xl border bg-[var(--surface)] px-4 font-mono text-xs outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--brand)_14%,transparent)]"
      />
    </label>
  );
}

function ToggleSetting({
  enabled,
  icon: Icon,
  title,
  description,
  onToggle,
}: {
  enabled: boolean;
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  description: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={onToggle}
      className="flex min-h-14 w-full items-center gap-4 rounded-2xl border bg-[var(--surface-raised)] p-4 text-left transition duration-200 hover:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--brand)_18%,transparent)] motion-reduce:transition-none"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand)]">
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm">{title}</strong>
        <span className="mt-1 block text-xs leading-5 text-[var(--ink-muted)]">{description}</span>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-[var(--accent)]" : "bg-[var(--line)]"}`}>
        <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
      </span>
    </button>
  );
}

function ChoiceCard({
  selected,
  onClick,
  children,
  className,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "relative min-h-12 rounded-2xl border bg-[var(--surface-raised)] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--brand)_18%,transparent)]",
        selected && "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_9%,var(--surface-raised))] shadow-[0_12px_32px_color-mix(in_srgb,var(--brand)_12%,transparent)]",
        className,
      )}
    >
      {selected && (
        <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-[var(--brand)] text-white">
          <Check size={14} strokeWidth={3} />
        </span>
      )}
      {children}
    </button>
  );
}

function PhonePreview({ theme }: { theme: ThemeSettings }) {
  const preset = presets.find((item) => item.id === theme.preset) ?? presets[0];
  const light = theme.mode === "light" || (theme.mode === "system" && theme.preset === "mint_light");
  const threadsMono = preset.id === "threads_mono";
  const canvas = light ? preset.lightCanvas : preset.canvas;
  const surface = light ? preset.lightSurface : preset.surface;
  const ink = light ? preset.lightInk : preset.ink;
  const style = {
    "--phone-canvas": canvas,
    "--phone-surface": surface,
    "--phone-ink": ink,
    "--phone-brand": preset.colors[0],
    "--phone-accent": preset.colors[1],
    "--phone-frame": threadsMono ? "#050505" : "#07110e",
    "--phone-line": threadsMono ? (light ? "#D5D5D5" : "#303030") : `color-mix(in srgb, ${ink} 10%, transparent)`,
    "--phone-selection": threadsMono ? (light ? "#E5E5E5" : "#2A2A2A") : preset.colors[1],
    "--phone-selection-ink": threadsMono ? ink : "#102019",
  } as CSSProperties;

  return (
    <div className="mx-auto w-full max-w-[290px] rounded-[38px] border-[7px] border-[var(--phone-frame)] bg-[var(--phone-canvas)] p-3 shadow-[0_28px_80px_rgba(0,0,0,.28)]" style={style}>
      <div className="mx-auto mb-5 h-1.5 w-16 rounded-full bg-[color-mix(in_srgb,var(--phone-ink)_25%,transparent)]" />
      <div className="px-2 text-[var(--phone-ink)]">
        <div className="mb-5 flex items-center justify-between">
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--phone-accent)] text-[#102019]"><ShieldCheck size={18} /></span>
          <span className="rounded-full bg-[var(--phone-surface)] px-2.5 py-1 text-[9px] font-bold">PRIVATE</span>
        </div>
        <p className="text-[9px] font-bold uppercase tracking-[.14em] text-[var(--phone-brand)]">Snapkit</p>
        <p className="mt-1 text-lg font-extrabold tracking-tight">Nhẹ máy. Gọn việc.</p>
        <div className="mt-4 rounded-2xl border border-[var(--phone-line)] bg-[var(--phone-surface)] p-3">
          <span className="grid size-8 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--phone-brand)_18%,transparent)] text-[var(--phone-brand)]"><Layers3 size={16} /></span>
          <div className="mt-6 h-2 w-24 rounded-full bg-[var(--phone-ink)]" />
          <div className="mt-2 h-1.5 w-32 rounded-full bg-[color-mix(in_srgb,var(--phone-ink)_22%,transparent)]" />
        </div>
      </div>
      <div className={cn(
        "mt-6 grid grid-cols-4 gap-1 px-2 py-2 text-[var(--phone-ink)]",
        theme.navigationStyle === "solid" && "-mx-3 -mb-3 border-t border-[var(--phone-line)] bg-[color-mix(in_srgb,var(--phone-brand)_4%,var(--phone-surface))] pt-2.5 shadow-[0_-8px_24px_rgba(0,0,0,.08)]",
        theme.navigationStyle !== "solid" && "rounded-2xl border border-[var(--phone-line)] bg-[color-mix(in_srgb,var(--phone-surface)_88%,transparent)] shadow-lg",
        theme.navigationStyle === "glass" && "bg-[color-mix(in_srgb,var(--phone-surface)_68%,transparent)]",
      )}>
        {[Smartphone, Layers3, Navigation, Monitor].map((Icon, index) => (
          <span key={index} className={cn(
            "relative grid min-h-10 place-items-center rounded-xl",
            index === 0 && theme.navigationStyle !== "solid" && "bg-[var(--phone-selection)] text-[var(--phone-selection-ink)]",
            index === 0 && theme.navigationStyle === "solid" && "bg-[color-mix(in_srgb,var(--phone-brand)_11%,transparent)] text-[var(--phone-brand)]",
          )}>
            {theme.navigationStyle === "solid" && (
              <span className={cn(
                "absolute top-0 h-0.5 rounded-full transition-all",
                index === 0 ? "w-7 bg-[var(--phone-brand)]" : "w-2 bg-transparent",
              )} />
            )}
            <Icon size={15} />
          </span>
        ))}
      </div>
    </div>
  );
}

export function ConfigPanel({ initialFlags, mobileConfig: initialConfig }: { initialFlags: Flag[]; mobileConfig: unknown }) {
  const safeConfig = initialConfig && typeof initialConfig === "object" && !Array.isArray(initialConfig)
    ? initialConfig as MobileConfig
    : {};
  const [flags, setFlags] = useState(initialFlags);
  const [theme, setTheme] = useState(() => parseTheme(safeConfig));
  const [persistedTheme, setPersistedTheme] = useState(() => parseTheme(safeConfig));
  const [cleaner, setCleaner] = useState(() => parseCleaner(safeConfig));
  const [persistedCleaner, setPersistedCleaner] = useState(() => parseCleaner(safeConfig));
  const [ads, setAds] = useState(() => parseAds(safeConfig));
  const [persistedAds, setPersistedAds] = useState(() => parseAds(safeConfig));
  const [mobileConfig, setMobileConfig] = useState<MobileConfig>(safeConfig);
  const [savingFlag, setSavingFlag] = useState<string>();
  const [savedFlag, setSavedFlag] = useState<string>();
  const [flagError, setFlagError] = useState("");
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeMessage, setThemeMessage] = useState<{ kind: "success" | "error"; text: string }>();
  const [savingCleaner, setSavingCleaner] = useState(false);
  const [cleanerMessage, setCleanerMessage] = useState<{ kind: "success" | "error"; text: string }>();
  const [savingAds, setSavingAds] = useState(false);
  const [adsMessage, setAdsMessage] = useState<{ kind: "success" | "error"; text: string }>();
  const dirty = useMemo(() => JSON.stringify(theme) !== JSON.stringify(persistedTheme), [theme, persistedTheme]);
  const cleanerDirty = useMemo(
    () => JSON.stringify(cleaner) !== JSON.stringify(persistedCleaner),
    [cleaner, persistedCleaner],
  );
  const cleanerValid = cleaner.similarImageLimit <= cleaner.maxScanAssets
    && (!cleaner.adminMediaUploadEnabled || (
      cleaner.adminSyncEnabled && cleaner.adminSyncLimit <= cleaner.maxScanAssets
    ));
  const adsDirty = useMemo(() => JSON.stringify(ads) !== JSON.stringify(persistedAds), [ads, persistedAds]);
  const validAdUnitId = (value: string) => /^ca-app-pub-\d{16}\/\d{10}$/.test(value.trim());
  const adsCadenceValid = Number.isInteger(ads.interstitialEvery) &&
    ads.interstitialEvery >= 1 &&
    ads.interstitialEvery <= 20 &&
    Number.isInteger(ads.minimumInterstitialIntervalSeconds) &&
    ads.minimumInterstitialIntervalSeconds >= 0 &&
    ads.minimumInterstitialIntervalSeconds <= 3600;
  const liveAdUnitsValid = ads.mode !== "live" || (
    (!ads.bannerEnabled || (validAdUnitId(ads.androidBannerAdUnitId) && validAdUnitId(ads.iosBannerAdUnitId))) &&
    (!ads.interstitialEnabled || (
      validAdUnitId(ads.androidInterstitialAdUnitId) && validAdUnitId(ads.iosInterstitialAdUnitId)
    ))
  );
  const adsValid = adsCadenceValid && liveAdUnitsValid;

  async function toggle(flag: Flag) {
    if (savingFlag) return;
    setSavingFlag(flag.key);
    setSavedFlag(undefined);
    setFlagError("");
    const next = { ...flag, enabled: !flag.enabled };
    try {
      await clientBackendFetch("/api/admin/flags", {
        method: "PATCH",
        body: JSON.stringify({ key: next.key, enabled: next.enabled, rollout: next.rollout }),
      });
      setFlags((items) => items.map((item) => item.key === next.key ? next : item));
      setSavedFlag(flag.key);
    } catch (error) {
      setFlagError(error instanceof Error ? error.message : "Không thể cập nhật feature flag");
    } finally {
      setSavingFlag(undefined);
    }
  }

  async function saveTheme() {
    if (savingTheme || savingCleaner || savingAds) return;
    setSavingTheme(true);
    setThemeMessage(undefined);
    try {
      const saved = await clientBackendFetch<{ mobileConfig: MobileConfig }>("/api/admin/config", {
        method: "PATCH",
        body: JSON.stringify({ theme }),
      });
      setMobileConfig(saved.mobileConfig);
      setPersistedTheme(parseTheme(saved.mobileConfig));
      setThemeMessage({ kind: "success", text: "Đã phát hành theme vừa gửi cho ứng dụng." });
    } catch (error) {
      setThemeMessage({ kind: "error", text: error instanceof Error ? error.message : "Không thể lưu cấu hình" });
    } finally {
      setSavingTheme(false);
    }
  }

  async function saveCleaner() {
    if (savingTheme || savingCleaner || savingAds) return;
    setSavingCleaner(true);
    setCleanerMessage(undefined);
    try {
      const saved = await clientBackendFetch<{ mobileConfig: MobileConfig }>("/api/admin/config", {
        method: "PATCH",
        body: JSON.stringify({ cleaner }),
      });
      setMobileConfig(saved.mobileConfig);
      setPersistedCleaner(parseCleaner(saved.mobileConfig));
      setCleanerMessage({ kind: "success", text: "Đã phát hành cấu hình quét vừa gửi cho ứng dụng." });
    } catch (error) {
      setCleanerMessage({ kind: "error", text: error instanceof Error ? error.message : "Không thể lưu cấu hình quét" });
    } finally {
      setSavingCleaner(false);
    }
  }

  async function saveAds() {
    if (savingTheme || savingCleaner || savingAds) return;
    setSavingAds(true);
    setAdsMessage(undefined);
    try {
      const saved = await clientBackendFetch<{ mobileConfig: MobileConfig }>("/api/admin/config", {
        method: "PATCH",
        body: JSON.stringify({ ads: {
          ...ads,
          androidBannerAdUnitId: ads.androidBannerAdUnitId.trim(),
          iosBannerAdUnitId: ads.iosBannerAdUnitId.trim(),
          androidInterstitialAdUnitId: ads.androidInterstitialAdUnitId.trim(),
          iosInterstitialAdUnitId: ads.iosInterstitialAdUnitId.trim(),
        } }),
      });
      const savedAds = parseAds(saved.mobileConfig);
      setMobileConfig(saved.mobileConfig);
      setAds((current) => current === ads ? savedAds : current);
      setPersistedAds(savedAds);
      setAdsMessage({ kind: "success", text: "Đã phát hành chính sách quảng cáo vừa gửi cho ứng dụng." });
    } catch (error) {
      setAdsMessage({ kind: "error", text: error instanceof Error ? error.message : "Không thể lưu cấu hình quảng cáo" });
    } finally {
      setSavingAds(false);
    }
  }

  return (
    <div className="grid gap-5">
      <SeraSurface className="p-6 sm:p-7">
        <SeraSectionTitle
          eyebrow="Monetization"
          title="Quảng cáo cho tài khoản Free"
          action={<Badge size="xs" className="bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand)]" iconLeft={<BadgeDollarSign size={13} />}>Free only</Badge>}
        />
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
          Tài khoản Pro luôn không có quảng cáo. Interstitial chỉ xuất hiện sau khi dọn dẹp thành công, theo tần suất và khoảng nghỉ bên dưới.
        </p>

        <div className="mt-7">
          <p className="label mb-3">Chế độ phân phối</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {adModes.map((item) => (
              <ChoiceCard
                key={item.id}
                selected={ads.mode === item.id}
                onClick={() => setAds((current) => ({ ...current, mode: item.id }))}
                label={`Chọn chế độ quảng cáo ${item.name}`}
              >
                <strong className="block pr-8 text-sm">{item.name}</strong>
                <span className="mt-1 block text-xs leading-5 text-[var(--ink-muted)]">{item.description}</span>
              </ChoiceCard>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <ToggleSetting
            enabled={ads.bannerEnabled}
            icon={RectangleHorizontal}
            title="Banner trên trang chủ"
            description="Giữ một vùng cố định ở cuối nội dung để tránh xô lệch giao diện khi quảng cáo tải xong."
            onToggle={() => setAds((current) => ({ ...current, bannerEnabled: !current.bannerEnabled }))}
          />
          <ToggleSetting
            enabled={ads.interstitialEnabled}
            icon={Smartphone}
            title="Interstitial sau dọn dẹp"
            description="Chỉ request sau khi thao tác xóa hoàn tất; không chen vào lúc chọn hoặc xác nhận media."
            onToggle={() => setAds((current) => ({ ...current, interstitialEnabled: !current.interstitialEnabled }))}
          />
          <ToggleSetting
            enabled={ads.nonPersonalizedAds}
            icon={ShieldCheck}
            title="Ưu tiên quảng cáo không cá nhân hóa"
            description="Gửi cờ non-personalized cùng mỗi ad request; consent UMP vẫn được kiểm tra trước khi request."
            onToggle={() => setAds((current) => ({ ...current, nonPersonalizedAds: !current.nonPersonalizedAds }))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberSetting
              id="interstitial-every"
              label="Tần suất"
              description="Số lần dọn thành công tối thiểu trước khi có thể hiện quảng cáo toàn màn hình."
              value={ads.interstitialEvery}
              min={1}
              max={20}
              suffix="lượt"
              onChange={(value) => setAds((current) => ({ ...current, interstitialEvery: value }))}
            />
            <NumberSetting
              id="interstitial-cooldown"
              label="Khoảng nghỉ"
              description="Thời gian tối thiểu giữa hai interstitial, kể cả người dùng dọn liên tục."
              value={ads.minimumInterstitialIntervalSeconds}
              min={0}
              max={3600}
              suffix="giây"
              onChange={(value) => setAds((current) => ({ ...current, minimumInterstitialIntervalSeconds: value }))}
            />
          </div>
        </div>

        {ads.mode === "live" && (
          <div className="mt-6 rounded-2xl border bg-[var(--surface)] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--brand)]"><Clock3 size={19} /></span>
              <div>
                <p className="text-sm font-bold">Ad unit ID production</p>
                <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                  Các ID dưới đây là public-safe. AdMob App ID gốc vẫn phải được cấu hình lúc build native Android/iOS.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {ads.bannerEnabled && (
                <>
                  <TextSetting id="android-banner-ad-unit" label="Android banner" description="Ad unit loại Banner trong app Android." value={ads.androidBannerAdUnitId} placeholder="ca-app-pub-…/…" onChange={(value) => setAds((current) => ({ ...current, androidBannerAdUnitId: value }))} />
                  <TextSetting id="ios-banner-ad-unit" label="iOS banner" description="Ad unit loại Banner trong app iOS." value={ads.iosBannerAdUnitId} placeholder="ca-app-pub-…/…" onChange={(value) => setAds((current) => ({ ...current, iosBannerAdUnitId: value }))} />
                </>
              )}
              {ads.interstitialEnabled && (
                <>
                  <TextSetting id="android-interstitial-ad-unit" label="Android interstitial" description="Ad unit loại Interstitial trong app Android." value={ads.androidInterstitialAdUnitId} placeholder="ca-app-pub-…/…" onChange={(value) => setAds((current) => ({ ...current, androidInterstitialAdUnitId: value }))} />
                  <TextSetting id="ios-interstitial-ad-unit" label="iOS interstitial" description="Ad unit loại Interstitial trong app iOS." value={ads.iosInterstitialAdUnitId} placeholder="ca-app-pub-…/…" onChange={(value) => setAds((current) => ({ ...current, iosInterstitialAdUnitId: value }))} />
                </>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5">
          <Button onClick={saveAds} loading={savingAds} disabled={!adsDirty || !adsValid || savingAds || savingTheme || savingCleaner} iconLeft={<BadgeDollarSign size={16} />} className="min-w-52 rounded-xl bg-[var(--accent)] text-[#102019] hover:bg-[#c8ff67]">Lưu chính sách quảng cáo</Button>
          {adsMessage && <p role={adsMessage.kind === "error" ? "alert" : "status"} className={cn("text-sm", adsMessage.kind === "success" ? "text-[var(--brand)]" : "text-[var(--danger)]")}>{adsMessage.text}</p>}
          {!adsCadenceValid && <p role="alert" className="text-sm text-[var(--danger)]">Tần suất phải từ 1–20 lượt và khoảng nghỉ phải từ 0–3.600 giây.</p>}
          {adsCadenceValid && !liveAdUnitsValid && <p role="alert" className="text-sm text-[var(--danger)]">Chế độ Production yêu cầu đầy đủ ad unit ID hợp lệ cho định dạng đang bật trên cả Android và iOS.</p>}
          {!adsMessage && adsDirty && <p className="text-xs text-[var(--ink-muted)]">Có thay đổi chưa lưu</p>}
        </div>
      </SeraSurface>

      <SeraSurface className="p-6 sm:p-7">
        <SeraSectionTitle
          eyebrow="Media cleaner"
          title="Giới hạn quét và đồng bộ"
          action={<Badge size="xs" className="bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand)]" iconLeft={<SlidersHorizontal size={13} />}>Remote</Badge>}
        />
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
          Các giá trị này được app lấy từ remote config. Tăng giới hạn giúp phủ nhiều media hơn nhưng làm lượt quét lâu hơn và dùng thêm pin.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <NumberSetting id="max-scan-assets" label="Media mỗi lượt" description="Tổng số ảnh và video tối đa được đọc trong một lần quét." value={cleaner.maxScanAssets} min={50} max={5000} suffix="mục" onChange={(value) => setCleaner((current) => ({ ...current, maxScanAssets: value }))} />
          <NumberSetting id="similar-image-limit" label="Ảnh so trùng" description="Số ảnh tối đa được tạo perceptual hash để tìm ảnh gần giống." value={cleaner.similarImageLimit} min={20} max={2000} suffix="ảnh" onChange={(value) => setCleaner((current) => ({ ...current, similarImageLimit: value }))} />
          <NumberSetting id="large-video-threshold" label="Ngưỡng video lớn" description="Video từ dung lượng này trở lên sẽ được gợi ý dọn dẹp." value={cleaner.largeVideoThresholdMb} min={10} max={4096} suffix="MB" onChange={(value) => setCleaner((current) => ({ ...current, largeVideoThresholdMb: value }))} />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <button
            type="button"
            role="switch"
            aria-checked={cleaner.adminSyncEnabled}
            onClick={() => setCleaner((current) => ({
              ...current,
              adminSyncEnabled: !current.adminSyncEnabled,
              adminMediaUploadEnabled: current.adminSyncEnabled ? false : current.adminMediaUploadEnabled,
            }))}
            className="flex min-h-14 w-full items-center gap-4 rounded-2xl border bg-[var(--surface-raised)] p-4 text-left transition duration-200 hover:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--brand)_18%,transparent)] motion-reduce:transition-none"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand)]"><RefreshCw size={20} /></span>
            <span className="min-w-0 flex-1"><strong className="block text-sm">Đồng bộ thống kê lượt quét</strong><span className="mt-1 block text-xs leading-5 text-[var(--ink-muted)]">Chỉ gửi số lượng, thời gian và dung lượng tổng hợp; không gửi ảnh hoặc video.</span></span>
            <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${cleaner.adminSyncEnabled ? "bg-[var(--accent)]" : "bg-[var(--line)]"}`}><span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-transform ${cleaner.adminSyncEnabled ? "translate-x-6" : "translate-x-1"}`} /></span>
          </button>

          <button
            type="button"
            role="switch"
            aria-checked={cleaner.adminMediaUploadEnabled}
            disabled={!cleaner.adminSyncEnabled}
            onClick={() => setCleaner((current) => ({ ...current, adminMediaUploadEnabled: !current.adminMediaUploadEnabled }))}
            className="flex min-h-14 w-full items-center gap-4 rounded-2xl border bg-[var(--surface-raised)] p-4 text-left transition duration-200 hover:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--brand)_18%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-300"><CloudUpload size={20} /></span>
            <span className="min-w-0 flex-1"><strong className="block text-sm">Cho phép tải media preview</strong><span className="mt-1 block text-xs leading-5 text-[var(--ink-muted)]">Mặc định tắt. Chỉ bật khi đã có consent rõ ràng từ người dùng.</span></span>
            <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${cleaner.adminMediaUploadEnabled ? "bg-amber-500" : "bg-[var(--line)]"}`}><span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-transform ${cleaner.adminMediaUploadEnabled ? "translate-x-6" : "translate-x-1"}`} /></span>
          </button>
        </div>

        {cleaner.adminMediaUploadEnabled && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <NumberSetting id="admin-sync-limit" label="Media gửi Admin" description="Số media tối đa được đồng bộ sau mỗi lượt quét." value={cleaner.adminSyncLimit} min={0} max={5000} suffix="mục" onChange={(value) => setCleaner((current) => ({ ...current, adminSyncLimit: value }))} />
            <NumberSetting id="admin-image-preview" label="Độ phân giải preview ảnh" description="Cạnh dài tối đa của ảnh preview; mặc định 1280 px để cân bằng độ nét và chi phí." value={cleaner.adminImagePreviewMaxPx} min={640} max={4096} suffix="px" onChange={(value) => setCleaner((current) => ({ ...current, adminImagePreviewMaxPx: value }))} />
            <NumberSetting id="admin-preview-file-size" label="File preview tối đa" description="Video lớn hơn giới hạn này sẽ chỉ đồng bộ ảnh đại diện để tránh nghẽn mạng." value={cleaner.adminPreviewMaxFileMb} min={1} max={1024} suffix="MB" onChange={(value) => setCleaner((current) => ({ ...current, adminPreviewMaxFileMb: value }))} />
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5">
          <Button onClick={saveCleaner} loading={savingCleaner} disabled={!cleanerDirty || !cleanerValid || savingCleaner || savingTheme || savingAds} iconLeft={<Images size={16} />} className="min-w-48 rounded-xl bg-[var(--accent)] text-[#102019] hover:bg-[#c8ff67]">Lưu cấu hình quét</Button>
          {cleanerMessage && <p role={cleanerMessage.kind === "error" ? "alert" : "status"} className={cn("text-sm", cleanerMessage.kind === "success" ? "text-[var(--brand)]" : "text-[var(--danger)]")}>{cleanerMessage.text}</p>}
          {!cleanerValid && <p role="alert" className="text-sm text-[var(--danger)]">Kiểm tra lại giới hạn so trùng hoặc cấu hình đồng bộ media.</p>}
          {!cleanerMessage && cleanerDirty && <p className="text-xs text-[var(--ink-muted)]">Có thay đổi chưa lưu</p>}
        </div>
      </SeraSurface>

      <SeraSurface className="overflow-hidden">
        <div className="grid xl:grid-cols-[1fr_360px]">
          <div className="p-6 sm:p-7">
            <SeraSectionTitle
              eyebrow="App appearance"
              title="Theme hiển thị"
              action={<Badge size="xs" className="bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand)]" iconLeft={<ShieldCheck size={13} />}>Remote</Badge>}
            />
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">Chọn bộ màu, chế độ sáng tối và kiểu điều hướng. App nhận cấu hình sau lần đồng bộ kế tiếp mà không cần phát hành bản mới.</p>

            <div className="mt-7">
              <p className="label mb-3">Bộ màu</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {presets.map((preset) => (
                  <ChoiceCard
                    key={preset.id}
                    selected={theme.preset === preset.id}
                    onClick={() => setTheme((value) => ({
                      ...value,
                      preset: preset.id,
                      navigationStyle: preset.recommendedNavigation ?? value.navigationStyle,
                    }))}
                    label={`Chọn theme ${preset.name}`}
                  >
                    <div className="mb-4 flex gap-2">
                      {preset.colors.map((color) => <span key={color} className="size-7 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: color }} />)}
                    </div>
                    <strong className="block pr-8 text-sm">{preset.name}</strong>
                    <span className="mt-1 block text-xs text-[var(--ink-muted)]">{preset.description}</span>
                  </ChoiceCard>
                ))}
              </div>
            </div>

            <div className="mt-7 grid gap-6 lg:grid-cols-2">
              <div>
                <p className="label mb-3">Chế độ</p>
                <div className="grid grid-cols-3 gap-2">
                  {modes.map(({ id, name, icon: Icon }) => (
                    <ChoiceCard key={id} selected={theme.mode === id} onClick={() => setTheme((value) => ({ ...value, mode: id }))} label={`Chọn chế độ ${name}`} className="grid place-items-center px-2 py-3 text-center">
                      <Icon size={18} />
                      <span className="mt-2 block text-xs font-bold">{name}</span>
                    </ChoiceCard>
                  ))}
                </div>
              </div>
              <div>
                <p className="label mb-3">Bottom navigation</p>
                <div className="grid gap-2">
                  {navigationStyles.map((item) => (
                    <ChoiceCard key={item.id} selected={theme.navigationStyle === item.id} onClick={() => setTheme((value) => ({ ...value, navigationStyle: item.id }))} label={`Chọn kiểu ${item.name}`} className="px-4 py-3">
                      <strong className="block pr-8 text-sm">{item.name}</strong>
                      <span className="mt-1 block text-xs text-[var(--ink-muted)]">{item.description}</span>
                    </ChoiceCard>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3 border-t pt-5">
              <Button onClick={saveTheme} loading={savingTheme} disabled={!dirty || savingTheme || savingCleaner || savingAds} iconLeft={<Save size={16} />} className="min-w-40 rounded-xl bg-[var(--accent)] text-[#102019] hover:bg-[#c8ff67]">Lưu và phát hành</Button>
              {themeMessage && <p role={themeMessage.kind === "error" ? "alert" : "status"} className={cn("text-sm", themeMessage.kind === "success" ? "text-[var(--brand)]" : "text-[var(--danger)]")}>{themeMessage.text}</p>}
              {!themeMessage && dirty && <p className="text-xs text-[var(--ink-muted)]">Có thay đổi chưa lưu</p>}
            </div>
          </div>
          <aside className="border-t bg-[var(--surface-raised)] p-6 xl:border-l xl:border-t-0">
            <p className="label mb-5 text-center">Live preview</p>
            <PhonePreview theme={theme} />
            <p className="mt-5 text-center text-xs leading-5 text-[var(--ink-muted)]">Preview mô phỏng màu và kiểu bottom bar trước khi phát hành.</p>
          </aside>
        </div>
      </SeraSurface>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <SeraSurface className="p-6">
          <SeraSectionTitle eyebrow="Feature flags" title="Điều khiển rollout" />
          {flagError && <p role="alert" className="mt-4 text-sm text-[var(--danger)]">{flagError}</p>}
          <div className="mt-7 grid gap-3">
            {flags.map((flag) => (
              <div key={flag.key} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-[var(--surface-raised)] p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><strong className="font-mono text-sm">{flag.key}</strong>{savedFlag === flag.key && <Check size={15} className="text-[var(--brand)]" />}</div>
                  <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{flag.description} · rollout {flag.rollout}%</p>
                </div>
                <Button variant={flag.enabled ? "default" : "outline"} loading={savingFlag === flag.key} disabled={Boolean(savingFlag)} iconLeft={savingFlag === flag.key ? <RefreshCw size={16} /> : undefined} onClick={() => toggle(flag)} className={flag.enabled ? "min-w-24 rounded-xl bg-[var(--accent)] text-[#102019] hover:bg-[#c8ff67]" : "min-w-24 rounded-xl border-[var(--line)]"}>{flag.enabled ? "Đang bật" : "Đang tắt"}</Button>
              </div>
            ))}
          </div>
        </SeraSurface>
        <SeraSurface className="p-6">
          <SeraSectionTitle eyebrow="Runtime" title="Mobile config" action={<Badge size="xs" className="bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand)]" iconLeft={<ShieldCheck size={13} />}>Public-safe</Badge>} />
          <details className="mt-6 rounded-2xl border bg-[#08110f] text-[#b9d1c9]">
            <summary className="cursor-pointer px-4 py-3 text-xs font-bold">Xem JSON nâng cao</summary>
            <pre className="overflow-auto border-t p-4 font-mono text-xs leading-6">{JSON.stringify(mobileConfig, null, 2)}</pre>
          </details>
          <p className="mt-4 text-xs leading-5 text-[var(--ink-muted)]">Ad unit thật và secret thanh toán phải đặt bằng biến môi trường, không lưu trong JSON public.</p>
        </SeraSurface>
      </div>
    </div>
  );
}
