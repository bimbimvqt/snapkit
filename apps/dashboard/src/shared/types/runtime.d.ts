export {};
declare global {
  const __APP_VERSION__: string;
  interface Window {
    SnapkitI18n: { t(key: string, values?: (string | number)[]): string; setLanguage(language: string): void; language: string };
    snapkitDesktop?: import('../../features/updates/model').DesktopUpdates;
    SNAPKIT_CONTROLLER?: boolean;
    SNAPKIT_PREVIEW?: unknown;
    lucide?: { createIcons(options?: unknown): void };
  }
}
