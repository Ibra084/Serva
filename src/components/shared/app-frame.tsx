import { cn } from "@/lib/utils";

export function AppFrame({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("surface-raised overflow-hidden rounded-[1.75rem]", className)}>
      <div className="flex items-center border-b border-white/40 bg-white/20 px-5 py-3 backdrop-blur-md">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}
