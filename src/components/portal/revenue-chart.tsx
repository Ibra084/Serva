"use client";

const chartValues = [58, 54, 50, 47, 49, 46, 52, 60, 63, 61, 68, 74];
const axisLabels = ["6am", "10am", "2pm", "6pm", "10pm"];

export function PortalRevenueChart() {
  const width = 100;
  const height = 100;
  const max = Math.max(...chartValues);
  const min = Math.min(...chartValues);
  const step = width / (chartValues.length - 1);

  const coords = chartValues.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / (max - min)) * height;
    return [x, y] as const;
  });

  const linePath = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`)
    .join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <div className="flex h-full w-full flex-col">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id="portalRevenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f6b42" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1f6b42" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#portalRevenueFill)" />
        <path
          d={linePath}
          fill="none"
          stroke="#1f6b42"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        {axisLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}
