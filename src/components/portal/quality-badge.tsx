import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function DataQualityBadge({ score, className }: { score: number; className?: string }) {
  const variant = score >= 85 ? "default" : score >= 60 ? "secondary" : "destructive";
  return (
    <Badge variant={variant} className={cn(className)}>
      {score}% quality
    </Badge>
  );
}

const STATUS_LABEL: Record<string, string> = {
  processed: "Processed",
  needs_review: "Needs review",
  failed: "Failed",
};

export function UploadStatusBadge({ status, className }: { status: string; className?: string }) {
  const variant = status === "processed" ? "default" : status === "needs_review" ? "secondary" : "destructive";
  return (
    <Badge variant={variant} className={cn(className)}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
