import { Flower2, Image as ImageIcon, QrCode, Rainbow, ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/admin/metric-card";
import { SeraSectionTitle, SeraSurface } from "@/components/sera/surface";
import { backendFetch, type QrAnalytics } from "@/lib/backend";

type QrStyleSummary = {
  frameStyle?: string;
  frameShape?: string;
  icon?: string;
};

function parseStyle(value: unknown): QrStyleSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  return {
    frameStyle: typeof input.frameStyle === "string" ? input.frameStyle : undefined,
    frameShape: typeof input.frameShape === "string" ? input.frameShape : undefined,
    icon: typeof input.icon === "string" ? input.icon : undefined,
  };
}

function StyleBadges({ value }: { value: unknown }) {
  const style = parseStyle(value);
  const decorative = style.frameStyle === "rainbow" || style.frameStyle === "floral";
  return (
    <div className="flex min-w-44 flex-wrap gap-2">
      {style.frameStyle === "rainbow" && (
        <Badge size="xs" iconLeft={<Rainbow size={12} />} className="bg-violet-500/12 text-violet-300">
          Cầu vồng
        </Badge>
      )}
      {style.frameStyle === "floral" && (
        <Badge size="xs" iconLeft={<Flower2 size={12} />} className="bg-pink-500/12 text-pink-300">
          Viền hoa
        </Badge>
      )}
      {style.icon === "custom" && (
        <Badge size="xs" iconLeft={<ImageIcon size={12} />} className="bg-cyan-500/12 text-cyan-300">
          Logo riêng
        </Badge>
      )}
      {!decorative && style.icon !== "custom" && (
        <Badge size="xs" className="bg-[var(--surface-raised)] text-[var(--ink-muted)]">
          {style.frameShape === "ticket" ? "Ticket" : style.frameStyle ?? "Classic"}
        </Badge>
      )}
    </div>
  );
}

export default async function QrPage() {
  const data = await backendFetch<QrAnalytics>("/api/admin/qr");
  return (
    <div className="grid gap-7">
      <header>
        <p className="label">Product analytics</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">QR Studio</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
          Theo dõi các phong cách QR được tạo. Logo ảnh riêng vẫn nằm trên thiết bị; admin chỉ nhận loại khung và thông số
          thiết kế an toàn.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          icon={QrCode}
          value={data.totalCreated.toLocaleString("vi-VN")}
          label="QR đã tạo"
          note="Tất cả thời gian"
        />
        <MetricCard
          icon={ScanLine}
          value={data.totalScanned.toLocaleString("vi-VN")}
          label="Lượt quét"
          note="Chỉ lưu sự kiện tổng hợp"
        />
      </div>

      <SeraSurface className="overflow-hidden">
        <div className="p-6">
          <SeraSectionTitle eyebrow="Latest" title="QR vừa tạo" />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Loại</th>
                <th>Phong cách</th>
                <th>Nội dung</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {data.latest.map((code) => (
                <tr key={code.id}>
                  <td className="font-mono text-xs uppercase text-[var(--brand)]">{code.kind}</td>
                  <td>
                    <StyleBadges value={code.style} />
                  </td>
                  <td className="max-w-xl truncate text-sm">{code.content}</td>
                  <td className="text-sm text-[var(--ink-muted)]">
                    {new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(
                      new Date(code.createdAt),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SeraSurface>
    </div>
  );
}
