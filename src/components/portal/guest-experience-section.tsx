"use client";

import { useMemo } from "react";
import { BadgePercent, MessageCircleQuestion, QrCode, ShieldAlert, Sparkles, Star, ThumbsUp, Wallet } from "lucide-react";
import { useQRData } from "@/lib/use-qr-data";
import { calculateQRMetrics } from "@/lib/qr-insights";
import { LiveTablesPreview } from "@/components/portal/live/live-tables-preview";

function StatTile({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-4" />
      </span>
      <p className="mt-2.5 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-lg font-medium tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function isToday(timestamp: string): boolean {
  const date = new Date(timestamp);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function GuestExperienceSection({ restaurantSlug }: { restaurantSlug: string }) {
  const { interactions, orders, reviews, loading } = useQRData(restaurantSlug);
  const metrics = useMemo(() => calculateQRMetrics(interactions, orders, reviews), [interactions, orders, reviews]);

  const ordersToday = useMemo(
    () => orders.filter((order) => order.status !== "cancelled" && isToday(order.timestamp)),
    [orders]
  );
  const averageBasketToday =
    ordersToday.length > 0
      ? Math.round(ordersToday.reduce((sum, order) => sum + order.subtotal, 0) / ordersToday.length)
      : null;

  const topPreference = metrics.topPreferences[0];
  const topAllergy = metrics.topAllergyConcern;
  const topAddOn = metrics.itemsAddedAfterRecommendation[0];

  return (
    <div className="mt-8">
      <h2 className="text-sm font-medium text-foreground">Guest Experience</h2>
      <p className="mt-1 text-xs text-muted-foreground">How guests are using the QR menu and AI assistant today</p>

      {loading ? (
        <div className="mt-3 h-32 w-full animate-pulse rounded-2xl bg-secondary" />
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="QR orders today" value={String(ordersToday.length)} icon={QrCode} />
          <StatTile
            label="Average QR basket"
            value={averageBasketToday !== null ? `AED ${averageBasketToday.toLocaleString()}` : "—"}
            icon={Wallet}
          />
          <StatTile label="AI questions asked" value={String(metrics.aiQuestionsAsked)} icon={MessageCircleQuestion} />
          <StatTile
            label="Recommendation acceptance"
            value={metrics.recommendationAcceptanceRate !== null ? `${metrics.recommendationAcceptanceRate}%` : "—"}
            icon={BadgePercent}
          />
          <StatTile label="Most requested preference" value={topPreference?.label ?? "—"} icon={Sparkles} />
          <StatTile label="Most common allergy concern" value={topAllergy?.label ?? "—"} icon={ShieldAlert} />
          <StatTile label="Top item added after AI recommendation" value={topAddOn?.dish ?? "—"} icon={ThumbsUp} />
          <StatTile
            label="Guest satisfaction (QR reviews)"
            value={metrics.averageReviewScore !== null ? `${metrics.averageReviewScore}★` : "—"}
            icon={Star}
          />
        </div>
      )}

      <LiveTablesPreview restaurantSlug={restaurantSlug} />
    </div>
  );
}
