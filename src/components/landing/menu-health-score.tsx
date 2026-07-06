const breakdown = [
  { label: "Margin", value: 78 },
  { label: "Velocity", value: 88 },
  { label: "Waste", value: 74 },
];

export function MenuHealthScore() {
  return (
    <div className="flex h-full flex-col justify-between rounded-2xl glass-tile p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Menu health</p>
        <p className="font-serif text-2xl font-medium text-foreground">
          82<span className="text-sm text-muted-foreground">/100</span>
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {breakdown.map((row) => (
          <div key={row.label} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium text-foreground">{row.value}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${row.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
