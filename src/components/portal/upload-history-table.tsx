"use client";

import { Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataQualityBadge, UploadStatusBadge } from "@/components/portal/quality-badge";
import type { UploadBatch } from "@/lib/types";

export function UploadHistoryTable({
  batches,
  onDelete,
}: {
  batches: UploadBatch[];
  onDelete?: (id: string) => void;
}) {
  if (batches.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
        No uploads yet. Once you confirm an import, it will appear here.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Upload name</TableHead>
          <TableHead>Date &amp; time</TableHead>
          <TableHead>File types</TableHead>
          <TableHead>Rows imported</TableHead>
          <TableHead>Detected columns</TableHead>
          <TableHead>Quality</TableHead>
          <TableHead>Warnings/Errors</TableHead>
          <TableHead>Status</TableHead>
          {onDelete && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {batches.map((batch) => {
          const rowCount = batch.files.reduce((sum, file) => sum + file.rowCount, 0);
          const columnCount = new Set(batch.files.flatMap((file) => file.detectedColumns)).size;
          const issueCount = batch.quality.warnings.length + batch.quality.errors.length;
          return (
            <TableRow key={batch.id}>
              <TableCell className="font-medium text-foreground">{batch.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(batch.importedAt).toLocaleString()}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {batch.files.map((file) => file.kind).join(", ")}
              </TableCell>
              <TableCell>{rowCount}</TableCell>
              <TableCell>{columnCount}</TableCell>
              <TableCell>
                <DataQualityBadge score={batch.quality.score} />
              </TableCell>
              <TableCell className="text-muted-foreground">{issueCount}</TableCell>
              <TableCell>
                <UploadStatusBadge status={batch.status} />
              </TableCell>
              {onDelete && (
                <TableCell className="text-right">
                  <button
                    onClick={() => onDelete(batch.id)}
                    aria-label={`Delete ${batch.name}`}
                    className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
