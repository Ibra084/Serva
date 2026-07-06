const days = ["M", "T", "W", "T", "F", "S", "S"];
const hours = ["12p", "2p", "5p", "7p", "9p"];

const intensity = [
  [0.2, 0.3, 0.2, 0.5, 0.3],
  [0.2, 0.3, 0.2, 0.5, 0.3],
  [0.25, 0.35, 0.25, 0.55, 0.35],
  [0.3, 0.4, 0.3, 0.65, 0.45],
  [0.4, 0.45, 0.4, 0.8, 0.7],
  [0.5, 0.5, 0.55, 0.95, 0.9],
  [0.45, 0.4, 0.5, 0.85, 0.6],
];

export function PeakHourHeatmap() {
  return (
    <div className="rounded-2xl glass-tile p-5">
      <p className="text-sm font-medium text-foreground">Peak hours</p>

      <div className="mt-4 flex gap-2">
        <div className="flex flex-col justify-between gap-1 pt-4">
          {hours.map((h) => (
            <span key={h} className="h-3.5 text-[9px] leading-none text-muted-foreground">
              {h}
            </span>
          ))}
        </div>

        <div className="grid flex-1 grid-cols-7 gap-1">
          {days.map((day, dayIndex) => (
            <div key={day} className="flex flex-col items-center gap-1">
              <span className="text-[9px] text-muted-foreground">{day}</span>
              <div className="flex flex-col gap-1">
                {hours.map((_, hourIndex) => {
                  const v = intensity[dayIndex][hourIndex];
                  return (
                    <div
                      key={hourIndex}
                      className="size-3.5 rounded-sm"
                      style={{
                        backgroundColor: `rgba(31, 107, 66, ${v})`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
