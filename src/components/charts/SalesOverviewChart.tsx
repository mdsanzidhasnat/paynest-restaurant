import React, { useState } from 'react';
import { DailySalesPoint } from '../../types/pos';
import { formatBDT } from '../../utils/format';

interface SalesOverviewChartProps {
  data: DailySalesPoint[];
}

export const SalesOverviewChart: React.FC<SalesOverviewChartProps> = ({ data }) => {
  const [metric, setMetric] = useState<'sales' | 'profit'>('sales');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 680;
  const height = 248;
  const padLeft = 56;
  const padRight = 22;
  const padTop = 20;
  const padBottom = 34;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const values = data.map((d) => (metric === 'sales' ? d.sales : d.profit));
  const rawMax = Math.max(...values, 1000);
  const niceMax = Math.ceil((rawMax * 1.15) / 5000) * 5000;
  const ticks = 4;

  const points = data.map((d, idx) => {
    const x = padLeft + (idx / Math.max(data.length - 1, 1)) * chartW;
    const val = metric === 'sales' ? d.sales : d.profit;
    const y = padTop + chartH - (val / niceMax) * chartH;
    return { x, y, val, item: d };
  });

  // Smooth Catmull-Rom / cubic Bezier curve generator
  const buildSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? i : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d;
  };

  const linePath = buildSmoothPath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(padTop + chartH).toFixed(2)} L ${points[0].x.toFixed(2)} ${(padTop + chartH).toFixed(2)} Z`
      : '';

  const total7Days = values.reduce((acc, v) => acc + v, 0);
  const strokeColor = metric === 'sales' ? '#4F46E5' : '#10B981';

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  return (
    <div className="pos-card p-6 flex flex-col justify-between h-full">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[#111827]">Sales Overview</h2>
          <p className="text-[13px] text-[#9CA3AF] mt-0.5">
            Last 7 days · Total{' '}
            <span className="font-semibold text-[#111827] tabular-nums">{formatBDT(total7Days)}</span>
          </p>
        </div>

        {/* Interactive Metric Switcher */}
        <div className="flex items-center gap-1 p-1 bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px]">
          <button
            type="button"
            onClick={() => setMetric('sales')}
            className={`px-3 py-1.5 text-[12.5px] font-medium rounded-[8px] transition-colors whitespace-nowrap ${
              metric === 'sales'
                ? 'bg-white text-[#111827] shadow-xs border border-[#E6EAF0]'
                : 'text-[#4B5563] hover:text-[#111827]'
            }`}
          >
            Sales
          </button>
          <button
            type="button"
            onClick={() => setMetric('profit')}
            className={`px-3 py-1.5 text-[12.5px] font-medium rounded-[8px] transition-colors whitespace-nowrap ${
              metric === 'profit'
                ? 'bg-white text-[#111827] shadow-xs border border-[#E6EAF0]'
                : 'text-[#4B5563] hover:text-[#111827]'
            }`}
          >
            Profit
          </button>
        </div>
      </div>

      {/* Responsive SVG Area Chart */}
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
          role="img"
          aria-label="Sales Overview last 7 days chart"
        >
          <defs>
            <linearGradient id="salesAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.18" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Labels */}
          {Array.from({ length: ticks + 1 }).map((_, idx) => {
            const ratio = idx / ticks;
            const y = padTop + chartH - ratio * chartH;
            const labelVal = Math.round(niceMax * ratio);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#E6EAF0"
                  strokeDasharray={idx === 0 ? undefined : '4 4'}
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[#9CA3AF] text-[11px] tabular-nums"
                >
                  {labelVal === 0 ? '৳0' : `৳${Math.round(labelVal / 1000)}k`}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          <path d={areaPath} fill="url(#salesAreaGrad)" />

          {/* Smooth Line */}
          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Vertical Hover Guideline */}
          {activePoint && (
            <line
              x1={activePoint.x}
              y1={padTop}
              x2={activePoint.x}
              y2={padTop + chartH}
              stroke="#CBD5E1"
              strokeDasharray="3 3"
              strokeWidth="1.25"
            />
          )}

          {/* Data Points & X-Axis Labels */}
          {points.map((pt, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <g key={pt.item.day}>
                <text
                  x={pt.x}
                  y={height - 8}
                  textAnchor="middle"
                  className={`text-[11.5px] font-medium ${
                    isHovered ? 'fill-[#111827] font-semibold' : 'fill-[#9CA3AF]'
                  }`}
                >
                  {pt.item.day}
                </text>

                {/* Visible Dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 5.5 : 3.5}
                  fill="#FFFFFF"
                  stroke={strokeColor}
                  strokeWidth={isHovered ? 3 : 2.25}
                />

                {/* Wide Invisible Hover Target */}
                <rect
                  x={pt.x - chartW / (data.length * 2)}
                  y={padTop}
                  width={chartW / data.length}
                  height={chartH + 24}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {activePoint && (
          <div
            className="pointer-events-none absolute top-2 bg-[#111827] text-white px-3 py-2 rounded-[10px] shadow-md text-[12px] z-10 whitespace-nowrap"
            style={{
              left: `${Math.min(Math.max((activePoint.x / width) * 100, 12), 78)}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <p className="font-semibold text-white/90">
              {activePoint.item.day}, {activePoint.item.dateLabel}
            </p>
            <p className="tabular-nums mt-0.5">
              {metric === 'sales' ? 'Sales: ' : 'Profit: '}
              <span className="font-bold">{formatBDT(activePoint.val)}</span>
              <span className="text-white/60 ml-2">· {activePoint.item.orders} orders</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
