export function PortalPageSkeleton() {
  return (
    <main className="flex-1 overflow-y-auto bg-background px-6 py-8 sm:px-8">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-secondary" />
      <div className="mt-6 h-64 w-full animate-pulse rounded-2xl bg-secondary" />
    </main>
  );
}
