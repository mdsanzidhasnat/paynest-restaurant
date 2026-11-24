import React, { useState } from 'react';
import { Category } from '../../types/pos';
import { formatBDT } from '../../utils/format';

interface CategoryDonutChartProps {
  categories: Category[];
  totalSales: number;
}

export const CategoryDonutChart: React.FC<CategoryDonutChartProps> = ({ categories, totalSales }) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const size = 184;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;
  const segments = categories.map((cat) => {
    const startPercent = cumulativePercent;
    cumulativePercent += cat.revenueShare;
    const dashLength = (cat.revenueShare / 100) * circumference;
    const dashOffset = -((startPercent / 100) * circumference);
    return {
      ...cat,
      dashLength,
      dashOffset,
    };
  });

  const activeCategory = categories.find((c) => c.id === activeId);

  return (
    <div className="pos-card p-6 flex flex-col justify-between h-full">
      <div>
        <h2 className="text-[16px] font-semibold text-[#111827]">Sales by Category</h2>
        <p className="text-[13px] text-[#9CA3AF] mt-0.5">Revenue share across departments</p>
      </div>

      {/* Donut SVG + Center Label */}
      <div className="flex items-center justify-center my-4">
        <div className="relative w-[184px] h-[184px]">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-full h-full -rotate-90"
            role="img"
            aria-label="Sales by category donut chart"
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#F3F5F9"
              strokeWidth={strokeWidth}
            />
            {segments.map((seg) => {
              const isHighlighted = activeId === null || activeId === seg.id;
              return (
                <circle
                  key={seg.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={activeId === seg.id ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={`${Math.max(seg.dashLength - 2, 0)} ${circumference}`}
                  strokeDashoffset={seg.dashOffset}
                  strokeLinecap="butt"
                  className="cursor-pointer transition-all duration-150"
                  style={{ opacity: isHighlighted ? 1 : 0.35 }}
                  onMouseEnter={() => setActiveId(seg.id)}
                  onMouseLeave={() => setActiveId(null)}
                />
              );
            })}
          </svg>

          {/* Center Summary */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
            <span className="text-[11.5px] font-medium text-[#9CA3AF] truncate max-w-[115px]">
              {activeCategory ? activeCategory.name : "Today's Total"}
            </span>
            <span className="text-[18px] font-bold text-[#111827] tabular-nums mt-0.5">
              {activeCategory ? formatBDT(activeCategory.revenueAmount) : formatBDT(totalSales)}
            </span>
            {activeCategory && (
              <span className="text-[11.5px] font-semibold text-[#4F46E5] tabular-nums">
                {activeCategory.revenueShare}% share
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Category Breakdown Legend */}
      <div className="space-y-2.5">
        {categories.map((cat) => (
          <div
            key={cat.id}
            onMouseEnter={() => setActiveId(cat.id)}
            onMouseLeave={() => setActiveId(null)}
            className={`flex items-center justify-between text-[13px] px-2 py-1 rounded-[8px] cursor-pointer transition-colors ${
              activeId === cat.id ? 'bg-[#F6F8FB]' : ''
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="text-[#4B5563] font-medium truncate">{cat.name}</span>
            </span>
            <span className="flex items-center gap-3 shrink-0 tabular-nums">
              <span className="text-[#9CA3AF] text-[12px]">{formatBDT(cat.revenueAmount)}</span>
              <span className="font-semibold text-[#111827] w-9 text-right">{cat.revenueShare}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
