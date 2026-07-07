import type { CsvRow } from "@/lib/csv-parser";
import type { MenuItem, Order, Review, TableSession, UploadedFileMeta, UploadFileKind } from "@/lib/types";

export interface StagedFile {
  file: File;
  kind: UploadFileKind;
  rows: CsvRow[];
  meta: UploadedFileMeta;
  normalized: Order[] | MenuItem[] | Review[] | TableSession[];
}
