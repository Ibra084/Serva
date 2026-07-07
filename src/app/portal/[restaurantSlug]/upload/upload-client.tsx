"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { PortalTopbar } from "@/components/portal/topbar";
import { UploadHistoryTable } from "@/components/portal/upload-history-table";
import { useUploadBatches } from "@/lib/use-restaurant-data";
import {
  aggregateQuality,
  confirmUploadBatch,
  detectFileKind,
  loadSampleData,
  normalizeMenuRows,
  normalizeOrderRows,
  normalizeReviewRows,
  normalizeTableRows,
  removeUploadBatchAndRecombine,
} from "@/lib/data-store";
import { computeDataQuality, previewRows } from "@/lib/data-quality";
import { parseCsv } from "@/lib/csv-parser";
import type { MenuItem, Order, Review, TableSession, UploadBatch, UploadFileKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ReviewStep } from "./review-step";
import type { StagedFile } from "./staged-file";

const EXPECTED_FILES: { kind: UploadFileKind; label: string; filename: string }[] = [
  { kind: "orders", label: "Orders", filename: "orders.csv" },
  { kind: "menu", label: "Menu", filename: "menu.csv" },
  { kind: "reviews", label: "Reviews", filename: "reviews.csv" },
  { kind: "tables", label: "Tables", filename: "tables.csv" },
];

function normalizeByKind(kind: UploadFileKind, rows: ReturnType<typeof parseCsv>) {
  switch (kind) {
    case "orders":
      return normalizeOrderRows(rows);
    case "menu":
      return normalizeMenuRows(rows);
    case "reviews":
      return normalizeReviewRows(rows);
    case "tables":
      return normalizeTableRows(rows);
    case "restaurant":
      return [];
  }
}

type Step = "select" | "review" | "summary";

export function UploadClient({ restaurantSlug }: { restaurantSlug: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { batches, refresh } = useUploadBatches(restaurantSlug);

  const [step, setStep] = useState<Step>("select");
  const [isDragging, setIsDragging] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [batchName, setBatchName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [confirmedBatch, setConfirmedBatch] = useState<UploadBatch | null>(null);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    setError(null);
    const files = Array.from(fileList);

    for (const file of files) {
      try {
        const text = await file.text();
        const rows = parseCsv(text);
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
        const detected = detectFileKind(file.name, headers);

        if (detected === "unknown") {
          setError(`Could not detect the file type for ${file.name}. Rename it to include "orders", "menu", "reviews", or "tables".`);
          continue;
        }

        const kind = detected;
        const normalized = normalizeByKind(kind, rows);
        const staged: StagedFile = {
          file,
          kind,
          rows,
          normalized,
          meta: {
            filename: file.name,
            kind,
            fileType: file.name.toLowerCase().endsWith(".json") ? "json" : "csv",
            rowCount: rows.length,
            detectedColumns: headers,
            preview: previewRows(rows),
            quality: computeDataQuality(rows, kind),
          },
        };

        setStagedFiles((prev) => [...prev.filter((existing) => existing.kind !== kind), staged]);
        setBatchName((prev) => prev || `POS Import — ${new Date().toLocaleDateString()}`);
      } catch {
        setError(`Could not parse ${file.name}. Check the file format and try again.`);
      }
    }
  }, []);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files.length > 0) {
      handleFiles(event.dataTransfer.files);
    }
  }

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files.length > 0) {
      handleFiles(event.target.files);
    }
  }

  const hasAnyData = stagedFiles.length > 0;

  function handleConfirmImport() {
    setImporting(true);

    const files = stagedFiles.map((staged) => staged.meta);
    const hasErrors = files.some((file) => file.quality.errors.length > 0);
    const hasWarnings = files.some((file) => file.quality.warnings.length > 0);

    const batch: UploadBatch = {
      id: `batch-${Date.now()}`,
      name: batchName || `Import — ${new Date().toLocaleString()}`,
      importedAt: new Date().toISOString(),
      files,
      status: hasErrors ? "failed" : hasWarnings ? "needs_review" : "processed",
      quality: aggregateQuality(files),
      data: {
        orders: (stagedFiles.find((s) => s.kind === "orders")?.normalized as Order[] | undefined) ?? [],
        menu: (stagedFiles.find((s) => s.kind === "menu")?.normalized as MenuItem[] | undefined) ?? [],
        reviews: (stagedFiles.find((s) => s.kind === "reviews")?.normalized as Review[] | undefined) ?? [],
        tables: (stagedFiles.find((s) => s.kind === "tables")?.normalized as TableSession[] | undefined) ?? [],
      },
    };

    confirmUploadBatch(restaurantSlug, batch);
    refresh();
    setConfirmedBatch(batch);
    setStep("summary");
    setImporting(false);
  }

  function handleCancelReview() {
    setStagedFiles([]);
    setBatchName("");
    setStep("select");
  }

  function handleDeleteBatch(id: string) {
    removeUploadBatchAndRecombine(restaurantSlug, id);
    refresh();
  }

  async function handleUseSampleData() {
    setLoadingSample(true);
    setError(null);
    try {
      await loadSampleData(restaurantSlug);
      router.push(`/portal/${restaurantSlug}/dashboard`);
      router.refresh();
    } catch {
      setError("Could not load sample data. Please try again.");
      setLoadingSample(false);
    }
  }

  function handleStartNewImport() {
    setStagedFiles([]);
    setBatchName("");
    setConfirmedBatch(null);
    setStep("select");
  }

  const revenueDetected = confirmedBatch
    ? Math.round(confirmedBatch.data.orders.reduce((sum, order) => sum + order.total, 0))
    : 0;

  return (
    <>
      <PortalTopbar restaurantSlug={restaurantSlug} />

      <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
            Upload your restaurant data
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Serva needs order, menu, and review data to generate your morning brief and
            dashboard insights.
          </p>

          {step === "select" && (
            <>
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  "mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card px-6 py-12 text-center transition-colors",
                  isDragging && "border-primary bg-accent/40"
                )}
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <UploadCloud className="size-6" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Drag and drop your CSV or JSON files here
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    orders.csv &middot; menu.csv &middot; reviews.csv &middot; tables.csv
                  </p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  Browse files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".csv,.json"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>

              {error && (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {EXPECTED_FILES.map((item) => {
                  const staged = stagedFiles.find((file) => file.kind === item.kind);
                  return (
                    <div
                      key={item.kind}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors",
                        staged && "border-primary/30 bg-accent/30"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground",
                          staged && "bg-accent text-accent-foreground"
                        )}
                      >
                        {staged ? (
                          <CheckCircle2 className="size-4" />
                        ) : (
                          <FileSpreadsheet className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {staged ? staged.file.name : `Expecting ${item.filename}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setStep("review")}
                  disabled={!hasAnyData}
                  className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)] disabled:pointer-events-none disabled:opacity-50"
                >
                  <ArrowRight className="size-4" />
                  Continue to review
                </button>

                <button
                  onClick={handleUseSampleData}
                  disabled={loadingSample}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
                >
                  {loadingSample ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Use sample data
                </button>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Sample data loads a realistic dataset for Marco&rsquo;s Kitchen in Dubai so you can
                explore Serva before connecting your own reports.
              </p>
            </>
          )}

          {step === "review" && (
            <ReviewStep
              stagedFiles={stagedFiles}
              batchName={batchName}
              onBatchNameChange={setBatchName}
              onConfirm={handleConfirmImport}
              onCancel={handleCancelReview}
            />
          )}

          {step === "summary" && confirmedBatch && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-6">
              <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <CheckCircle2 className="size-5" />
              </span>
              <p className="mt-3 font-serif text-lg font-medium text-foreground">Import confirmed</p>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm text-foreground">
                <li>Imported {confirmedBatch.data.orders.length} orders</li>
                <li>Detected AED {revenueDetected.toLocaleString()} in revenue</li>
                <li>Detected {confirmedBatch.data.menu.length} menu items</li>
                <li>Detected {confirmedBatch.data.reviews.length} reviews</li>
                <li>Detected {confirmedBatch.data.tables.length} tables</li>
                <li>Found {confirmedBatch.quality.missingValues} missing values</li>
                <li>Found {confirmedBatch.quality.duplicateRows} duplicate rows</li>
              </ul>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    router.push(`/portal/${restaurantSlug}/dashboard`);
                    router.refresh();
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
                >
                  <ArrowRight className="size-4" />
                  View Dashboard
                </button>
                <button
                  onClick={handleStartNewImport}
                  className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  Upload another file
                </button>
              </div>
            </div>
          )}

          <div className="mt-10">
            <h2 className="text-sm font-medium text-foreground">Upload History</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Every confirmed import is stored separately — nothing gets overwritten.
            </p>
            <div className="mt-3">
              <UploadHistoryTable batches={batches} onDelete={handleDeleteBatch} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
