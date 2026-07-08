"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UploadCloud, CheckCircle2, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { useRestaurantData } from "@/lib/use-restaurant-data";
import { usePortalData } from "@/lib/portal-cache";
import { clearAllUploadBatches, clearRestaurantData, loadSampleData } from "@/lib/data-store";
import { clearDemoData } from "@/lib/workspace-store";

export function SettingsClient({ restaurantSlug }: { restaurantSlug: string }) {
  const router = useRouter();
  const { data, hasData } = useRestaurantData(restaurantSlug);
  const { updateOptimistic, refresh } = usePortalData();
  const [cleared, setCleared] = useState(false);
  const [clearError, setClearError] = useState(false);
  const [reimporting, setReimporting] = useState(false);
  const [demoCleared, setDemoCleared] = useState(false);

  async function handleClearData() {
    setClearError(false);
    updateOptimistic((prev) => ({
      ...prev,
      restaurant: prev.restaurant
        ? { ...prev.restaurant, menu: [], orders: [], reviews: [], tables: [] }
        : prev.restaurant,
      uploadBatches: [],
    }));
    setCleared(true);
    try {
      await Promise.all([clearRestaurantData(restaurantSlug), clearAllUploadBatches(restaurantSlug)]);
    } catch {
      setCleared(false);
      setClearError(true);
      await refresh();
    }
  }

  async function handleClearDemoData() {
    // Deleting the restaurant row cascades to all of its data in Postgres —
    // menu/order/review/table/upload/opportunity/QR rows all FK to restaurant_id.
    const removedSlugs = await clearDemoData();
    setDemoCleared(true);
    if (removedSlugs.includes(restaurantSlug)) {
      router.push("/portal");
    }
  }

  async function handleReimportSampleData() {
    setReimporting(true);
    setCleared(false);
    try {
      await loadSampleData(restaurantSlug);
      await refresh();
    } finally {
      setReimporting(false);
    }
  }

  return (
    <>
      <PortalTopbar restaurantSlug={restaurantSlug} />
      <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
            Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your restaurant&rsquo;s uploaded data.
          </p>

          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-medium text-foreground">Data status</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasData
                ? `Data imported on ${data?.importedAt ? new Date(data.importedAt).toLocaleString() : "unknown date"}.`
                : "No restaurant data has been uploaded yet."}
            </p>
            {hasData && data && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-secondary/60 p-3">
                  <p className="text-xs text-muted-foreground">Orders</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{data.orders.length}</p>
                </div>
                <div className="rounded-xl bg-secondary/60 p-3">
                  <p className="text-xs text-muted-foreground">Menu Items</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{data.menu.length}</p>
                </div>
                <div className="rounded-xl bg-secondary/60 p-3">
                  <p className="text-xs text-muted-foreground">Reviews</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{data.reviews.length}</p>
                </div>
                <div className="rounded-xl bg-secondary/60 p-3">
                  <p className="text-xs text-muted-foreground">Table Sessions</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{data.tables.length}</p>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={() => router.push(`/portal/${restaurantSlug}/upload`)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <UploadCloud className="size-4" />
                Upload new data
              </button>
              <button
                onClick={handleClearData}
                disabled={!hasData}
                className="flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:pointer-events-none disabled:opacity-50"
              >
                <Trash2 className="size-4" />
                Clear All Imported Data
              </button>
              <button
                onClick={handleReimportSampleData}
                disabled={reimporting}
                className="flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
              >
                {reimporting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Reimport Sample Data
              </button>
            </div>

            {cleared && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-primary">
                <CheckCircle2 className="size-4" />
                All imported data and upload history cleared.
              </p>
            )}
            {clearError && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
                <AlertTriangle className="size-4" />
                Couldn&rsquo;t clear your data. Please try again.
              </p>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-medium text-foreground">Developer</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Remove the demo restaurant workspace (if any) and all of its uploaded data, QR orders,
              reviews, and insights. Real restaurants you created are not affected.
            </p>

            <div className="mt-5">
              <button
                onClick={handleClearDemoData}
                className="flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
              >
                <Trash2 className="size-4" />
                Clear demo data
              </button>
            </div>

            {demoCleared && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-primary">
                <CheckCircle2 className="size-4" />
                Demo data cleared.
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
