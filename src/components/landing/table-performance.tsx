const tables = [
  { name: "Table 4", turn: "48 min", status: "On pace" },
  { name: "Table 7", turn: "72 min", status: "Running long" },
  { name: "Table 12", turn: "41 min", status: "On pace" },
];

export function TablePerformance() {
  return (
    <div className="rounded-2xl glass-tile p-5">
      <p className="text-sm font-medium text-foreground">Table performance</p>

      <div className="mt-4 flex flex-col gap-3">
        {tables.map((table) => (
          <div key={table.name} className="flex items-center justify-between text-sm">
            <span className="text-foreground">{table.name}</span>
            <span className="text-muted-foreground">{table.turn}</span>
            <span
              className={
                table.status === "Running long"
                  ? "text-xs font-medium text-clay"
                  : "text-xs font-medium text-primary"
              }
            >
              {table.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
