"use client";

import { Loader2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { MENU_TEMPLATE_OPTIONS, type MenuTemplateId } from "@/lib/menu-templates";
import { useState } from "react";

export function TemplatePickerSheet({
  open,
  onOpenChange,
  applying,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applying: boolean;
  onApply: (templateId: MenuTemplateId) => void;
}) {
  const [selected, setSelected] = useState<MenuTemplateId>("blank");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Start from a template" description="Populate your menu instantly, then customize freely.">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {MENU_TEMPLATE_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelected(option.id)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors",
                  selected === option.id ? "border-primary bg-accent/40" : "border-border hover:bg-secondary"
                )}
              >
                <span className="text-sm font-medium text-foreground">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => onApply(selected)}
            disabled={applying}
            className="flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--accent-hover)] disabled:pointer-events-none disabled:opacity-50"
          >
            {applying && <Loader2 className="size-4 animate-spin" />}
            Use this template
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
