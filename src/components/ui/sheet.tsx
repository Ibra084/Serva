"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Sheet = Dialog.Root;
const SheetTrigger = Dialog.Trigger;

function SheetContent({
  className,
  children,
  title,
  description,
  onClose,
}: {
  className?: string;
  children: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <Dialog.Popup
        className={cn(
          "fixed top-0 right-0 z-50 flex h-full w-[min(28rem,100vw)] flex-col overflow-hidden border-l border-border bg-card shadow-[0_24px_48px_-24px_rgba(33,31,26,0.4)] transition-transform duration-200 ease-out data-ending-style:translate-x-full data-starting-style:translate-x-full",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <Dialog.Title className="font-serif text-lg font-medium tracking-tight text-foreground">
              {title}
            </Dialog.Title>
            {description && (
              <Dialog.Description className="text-xs text-muted-foreground">{description}</Dialog.Description>
            )}
          </div>
          <Dialog.Close
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </Dialog.Close>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </Dialog.Popup>
    </Dialog.Portal>
  );
}

export { Sheet, SheetTrigger, SheetContent };
