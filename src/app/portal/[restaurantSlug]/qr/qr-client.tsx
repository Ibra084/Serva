"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Download, ExternalLink, Palette, QrCode, UtensilsCrossed } from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { PortalEmptyState } from "@/components/portal/empty-state";
import { Select } from "@/components/ui/select";
import { useRestaurantData } from "@/lib/use-restaurant-data";
import { usePortalData } from "@/lib/portal-cache";

const DEFAULT_TABLES = ["T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08"];

function downloadSvgAsPng(svg: SVGSVGElement, filename: string) {
  const size = svg.width.baseVal.value || 256;
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(image, 0, 0, size, size);
    }
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }, "image/png");
  };
  image.src = url;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
    >
      {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

export function QrClient({ restaurantSlug }: { restaurantSlug: string }) {
  const { data, loading, hasData } = useRestaurantData(restaurantSlug);
  const { data: portalData } = usePortalData();
  const svgRef = useRef<SVGSVGElement>(null);
  const isBooklet = portalData.menuAppearance.layout === "booklet";

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const restaurantUrl = `${origin}/qr/${restaurantSlug}`;

  const tableIds = useMemo(() => {
    if (data && data.tables.length > 0) {
      return Array.from(new Set(data.tables.map((table) => table.tableId))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      );
    }
    return DEFAULT_TABLES;
  }, [data]);

  const [selectedTarget, setSelectedTarget] = useState("general");
  const previewUrl =
    selectedTarget === "general" ? restaurantUrl : `${restaurantUrl}?table=${encodeURIComponent(selectedTarget)}`;

  function handleDownload() {
    if (!svgRef.current) return;
    const filename = selectedTarget === "general" ? `${restaurantSlug}-qr.png` : `${restaurantSlug}-${selectedTarget}-qr.png`;
    downloadSvgAsPng(svgRef.current, filename);
  }

  if (loading) {
    return (
      <>
        <PortalTopbar restaurantSlug={restaurantSlug} />
        <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
          <div className="h-64 w-full animate-pulse rounded-2xl bg-secondary" />
        </main>
      </>
    );
  }

  return (
    <>
      <PortalTopbar restaurantSlug={restaurantSlug} />
      <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <QrCode className="size-5 text-primary" />
              <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">QR Experience</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate the QR menu your guests scan at the table — every interaction feeds your QR Insights.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/portal/${restaurantSlug}/menu-builder`}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <UtensilsCrossed className="size-3.5" />
              Menu Builder
            </Link>
            <Link
              href={`/portal/${restaurantSlug}/qr/appearance`}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              <Palette className="size-3.5" />
              Customize appearance
            </Link>
          </div>
        </div>

        {!hasData || !data || data.menu.length === 0 ? (
          <PortalEmptyState
            restaurantSlug={restaurantSlug}
            icon={UtensilsCrossed}
            title="No menu data yet"
            description="Upload your menu.csv (or use sample data) to activate the customer QR experience."
          />
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-medium text-foreground">QR code preview</p>

              <div className="mt-3 flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Encodes</label>
                <Select value={selectedTarget} onChange={(event) => setSelectedTarget(event.target.value)}>
                  <option value="general">General restaurant link</option>
                  {tableIds.map((tableId) => (
                    <option key={tableId} value={tableId}>
                      Table {tableId}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="mt-3 flex items-center justify-center rounded-lg bg-white p-4">
                <QRCodeSVG ref={svgRef} value={previewUrl} size={220} marginSize={2} level="M" />
              </div>
              <p className="mt-2 truncate text-center text-[0.7rem] text-muted-foreground">{previewUrl}</p>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <Download className="size-3.5" />
                  Download QR
                </button>
                <Link
                  href={previewUrl.replace(origin, "")}
                  target="_blank"
                  className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
                >
                  <ExternalLink className="size-3.5 shrink-0" />
                  {isBooklet ? "Preview Booklet Menu" : "Preview Customer Menu"}
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-medium text-foreground">Restaurant QR link</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The general link guests land on when no table is specified.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-foreground">
                    {restaurantUrl}
                  </code>
                  <CopyButton value={restaurantUrl} />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-medium text-foreground">Table-specific QR links</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Each link tags orders and AI interactions with the table number.
                </p>
                <div className="mt-3 flex flex-col divide-y divide-border">
                  {tableIds.map((tableId) => {
                    const tableUrl = `${restaurantUrl}?table=${encodeURIComponent(tableId)}`;
                    return (
                      <div key={tableId} className="flex items-center gap-3 py-2.5">
                        <span className="w-14 shrink-0 text-sm font-medium text-foreground">{tableId}</span>
                        <code className="flex-1 truncate text-xs text-muted-foreground">{tableUrl}</code>
                        <CopyButton value={tableUrl} />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-5">
                <p className="text-sm font-medium text-foreground">Instructions</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Print this QR and place it on each table. Guests scan to open the menu, ask the AI
                  assistant questions, order, and leave a review — all of it feeding your QR Insights
                  dashboard.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
