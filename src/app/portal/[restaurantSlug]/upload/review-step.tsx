"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Wrench } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataQualityBadge } from "@/components/portal/quality-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { buildHeaderMapping, FIELD_DEFINITIONS } from "@/lib/field-mapping";
import type { UploadFileKind } from "@/lib/types";
import type { StagedFile } from "./staged-file";

/** Import Preview: shows how each CSV header was mapped to a canonical field, e.g. "unit_price → Unit Price ✓". */
function ImportPreviewMapping({ kind, detectedColumns }: { kind: UploadFileKind; detectedColumns: string[] }) {
  const mapping = buildHeaderMapping(detectedColumns, kind);
  const requiredCanonicals = new Set(FIELD_DEFINITIONS[kind].filter((def) => def.required).map((def) => def.canonical));
  const mappedCanonicals = new Set(mapping.filter((entry) => entry.mapped).map((entry) => entry.canonical));
  const missingRequired = FIELD_DEFINITIONS[kind].filter(
    (def) => def.required && !mappedCanonicals.has(def.canonical)
  );

  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>CSV Header</TableHead>
            <TableHead>Detected Field</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mapping.map((entry) => {
            const isRequired = entry.canonical ? requiredCanonicals.has(entry.canonical) : false;
            return (
              <TableRow key={entry.header}>
                <TableCell className="font-medium text-foreground">{entry.header}</TableCell>
                <TableCell className="text-muted-foreground">{entry.label ?? "—"}</TableCell>
                <TableCell>
                  {entry.mapped ? (
                    <span className="font-medium text-primary">✓</span>
                  ) : isRequired ? (
                    <span className="font-medium text-destructive">✗</span>
                  ) : (
                    <span className="font-medium text-muted-foreground">unmapped</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {missingRequired.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="size-3.5 shrink-0" />
          Missing required column{missingRequired.length === 1 ? "" : "s"}:{" "}
          {missingRequired.map((def) => def.label).join(", ")}
        </p>
      )}
    </div>
  );
}

function FixMappingPanel({ detectedColumns }: { detectedColumns: string[] }) {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-border bg-secondary/30 p-4">
      <p className="text-xs text-muted-foreground">
        Manual column remapping is coming soon. For now Serva auto-detects columns by name.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {detectedColumns.map((column) => (
          <div key={column} className="grid gap-1">
            <Label className="text-xs text-muted-foreground">{column}</Label>
            <Select disabled defaultValue={column}>
              <option value={column}>{column}</option>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileReviewCard({ staged }: { staged: StagedFile }) {
  const [expanded, setExpanded] = useState(true);
  const [fixMappingOpen, setFixMappingOpen] = useState(false);
  const { meta, normalized, kind } = staged;

  let aggregateLabel: string | null = null;
  if (kind === "orders") {
    const total = (normalized as { total: number }[]).reduce((sum, order) => sum + order.total, 0);
    aggregateLabel = `Total revenue detected: AED ${Math.round(total).toLocaleString()}`;
  } else if (kind === "menu") {
    aggregateLabel = `Total dishes detected: ${normalized.length}`;
  } else if (kind === "reviews") {
    aggregateLabel = `Total reviews detected: ${normalized.length}`;
  }

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          {meta.quality.errors.length > 0 ? (
            <AlertTriangle className="size-4 text-destructive" />
          ) : (
            <CheckCircle2 className="size-4 text-primary" />
          )}
          <div>
            <p className="text-sm font-medium text-foreground">{meta.filename}</p>
            <p className="text-xs text-muted-foreground">
              Detected as <span className="font-medium text-foreground">{kind}</span> &middot; {meta.rowCount} rows
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DataQualityBadge score={meta.quality.score} />
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-secondary/60 p-3">
              <p className="text-xs text-muted-foreground">Row count</p>
              <p className="mt-1 text-sm font-medium text-foreground">{meta.rowCount}</p>
            </div>
            <div className="rounded-xl bg-secondary/60 p-3">
              <p className="text-xs text-muted-foreground">Missing values</p>
              <p className="mt-1 text-sm font-medium text-foreground">{meta.quality.missingValues}</p>
            </div>
            <div className="rounded-xl bg-secondary/60 p-3">
              <p className="text-xs text-muted-foreground">Duplicate / invalid rows</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {meta.quality.duplicateRows} / {meta.quality.invalidRows}
              </p>
            </div>
          </div>

          {aggregateLabel && <p className="mt-3 text-sm font-medium text-foreground">{aggregateLabel}</p>}

          {(meta.quality.warnings.length > 0 || meta.quality.errors.length > 0) && (
            <div className="mt-3 flex flex-col gap-1">
              {meta.quality.errors.map((message) => (
                <p key={message} className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  {message}
                </p>
              ))}
              {meta.quality.warnings.map((message) => (
                <p key={message} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  {message}
                </p>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">Import preview</p>
          <div className="mt-1.5">
            <ImportPreviewMapping kind={kind} detectedColumns={meta.detectedColumns} />
          </div>
          <button
            onClick={() => setFixMappingOpen((value) => !value)}
            className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Wrench className="size-3.5" />
            Fix mapping
          </button>
          {fixMappingOpen && <FixMappingPanel detectedColumns={meta.detectedColumns} />}

          <p className="mt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Preview (first {meta.preview.length} rows)
          </p>
          <div className="mt-1.5">
            <Table>
              <TableHeader>
                <TableRow>
                  {meta.detectedColumns.map((column) => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {meta.preview.map((row, index) => (
                  <TableRow key={index}>
                    {meta.detectedColumns.map((column) => (
                      <TableCell key={column} className="whitespace-nowrap text-muted-foreground">
                        {row[column] || "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReviewStep({
  stagedFiles,
  batchName,
  onBatchNameChange,
  onConfirm,
  onCancel,
}: {
  stagedFiles: StagedFile[];
  batchName: string;
  onBatchNameChange: (name: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="batch-name">Upload name</Label>
        <Input
          id="batch-name"
          value={batchName}
          onChange={(event) => onBatchNameChange(event.target.value)}
          className="max-w-sm"
        />
      </div>

      {stagedFiles.map((staged) => (
        <FileReviewCard key={staged.file.name} staged={staged} />
      ))}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          onClick={onConfirm}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)]"
        >
          Confirm Import
        </button>
        <button
          onClick={onCancel}
          className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
