"use client";

import { motion } from "framer-motion";

const chartValues = [38, 46, 42, 58, 52, 66, 60, 74, 70, 84];

export function RevenueChart() {
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
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id="revenueFillLight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1f6b42" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#1f6b42" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={areaPath}
        fill="url(#revenueFillLight)"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke="#1f6b42"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}
