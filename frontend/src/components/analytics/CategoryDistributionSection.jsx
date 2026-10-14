import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import {
  MapPin,
  AlertTriangle,
  Info,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Card, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';

const BAR_COLORS = [
  '#0284c7', // brand blue
  '#0ea5e9',
  '#38bdf8',
  '#0d9488', // teal
  '#14b8a6',
  '#059669', // emerald
  '#10b981',
  '#d97706', // amber
  '#f59e0b',
  '#e11d48', // rose
  '#6366f1', // indigo
  '#8b5cf6', // purple
];

function DistributionTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md text-xs">
        <p className="font-semibold text-slate-800">{data.category}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-sm font-bold text-brand-700">
            {Number(data.count).toLocaleString()}
          </span>
          <span className="text-xs font-medium text-slate-600">
            ({Number(data.percentage).toFixed(2)}% of recorded)
          </span>
        </div>
      </div>
    );
  }
  return null;
}

export function CategoryDistributionSection({
  distData,
  isLoading,
  error,
  onRetry,
  availableYears = [],
  selectedYear,
  onYearChange,
  includeSummaries,
  onToggleSummaries,
}) {
  const [displayCount, setDisplayCount] = useState(12);

  if (isLoading) {
    return (
      <Card className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center border-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600 mb-3" />
        <h3 className="text-sm font-semibold text-slate-800">Analyzing Category Distribution</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Computing proportional breakdown across recorded crime classes for year {selectedYear}...
        </p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="flex min-h-[380px] flex-col items-center justify-center p-8 text-center border-rose-200 bg-rose-50/20">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-4">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">Distribution Data Unavailable</h3>
        <p className="mt-1 text-sm text-slate-600 max-w-md">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry Query
          </Button>
        )}
      </Card>
    );
  }

  const rawCategories = distData?.categories || [];

  if (!distData || rawCategories.length === 0) {
    return (
      <Card className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center border-slate-200">
        <Info className="h-8 w-8 text-slate-400 mb-2" />
        <h3 className="text-sm font-semibold text-slate-800">No Category Data Recorded</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md">
          No breakdown is available for the selected parameters. Try selecting a different year or geography.
        </p>
      </Card>
    );
  }

  // Sorted categories by count descending
  const sortedCategories = [...rawCategories].sort((a, b) => b.count - a.count);
  const chartCategories = sortedCategories.slice(0, displayCount);
  const topThree = sortedCategories.slice(0, 3);

  // Geographic aggregation label
  const locationScope =
    distData.location_type === 'district'
      ? `${distData.district}, ${distData.state}`
      : distData.location_type === 'state'
      ? `${distData.state} (State Aggregate)`
      : 'All India (National Aggregate)';

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 bg-white p-6 shadow-sm">
        {/* Section Header with In-Place Year & Summary Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">Crime Category Composition ({distData.year})</CardTitle>
            </div>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1 font-medium text-slate-700">
                <MapPin className="h-3.5 w-3.5 text-brand-600" />
                {locationScope}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">
                Total Recorded: <strong className="text-slate-800 font-semibold">{distData.total_recorded_crimes.toLocaleString()}</strong> crimes
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">
                {rawCategories.length} distinct crime categories
              </span>
            </CardDescription>
          </div>

          {/* Quick Year Selector & Summary Toggle Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="category-year-select" className="font-semibold text-slate-700">
                Observation Year:
              </label>
              <select
                id="category-year-select"
                value={selectedYear || distData.year}
                onChange={(e) => onYearChange?.(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 font-medium focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={includeSummaries}
                onChange={(e) => onToggleSummaries?.(e.target.checked)}
                className="h-3.5 w-3.5 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
              />
              <span>Include Summary Columns</span>
            </label>
          </div>
        </div>

        {/* Top 3 Share Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {topThree.map((cat, idx) => (
            <div
              key={cat.category}
              className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center rounded bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-800">
                  RANK #{idx + 1}
                </span>
                <span className="text-xs font-semibold text-brand-700">
                  {cat.percentage.toFixed(1)}% share
                </span>
              </div>
              <div className="mt-2">
                <h4 className="text-xs font-semibold text-slate-900 truncate" title={cat.category}>
                  {cat.category}
                </h4>
                <p className="mt-0.5 text-base font-bold text-slate-900">
                  {cat.count.toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500">recorded instances</p>
              </div>
            </div>
          ))}
        </div>

        {/* Horizontal Bar Chart for Category Comparison */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">
              Comparative Category Volumes (Top {chartCategories.length} Categories)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Display:</span>
              <button
                type="button"
                onClick={() => setDisplayCount(12)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  displayCount === 12 ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Top 12
              </button>
              <button
                type="button"
                onClick={() => setDisplayCount(sortedCategories.length)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  displayCount === sortedCategories.length
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All ({sortedCategories.length})
              </button>
            </div>
          </div>

          <div style={{ height: Math.max(340, chartCategories.length * 28) }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartCategories}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#64748b"
                  tickLine={false}
                  fontSize={11}
                  tickFormatter={(val) => {
                    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                    return val;
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  stroke="#64748b"
                  tickLine={false}
                  fontSize={11}
                  width={150}
                  tickFormatter={(str) => (str.length > 20 ? `${str.substring(0, 18)}...` : str)}
                />
                <Tooltip content={<DistributionTooltip />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {chartCategories.map((entry, index) => (
                    <Cell key={`cell-${entry.category}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Category Table */}
        <div className="mt-8 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">
            Full Proportional Breakdown
          </h4>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-12">#</th>
                  <th className="py-2.5 px-3">Crime Category</th>
                  <th className="py-2.5 px-3 text-right">Recorded Count</th>
                  <th className="py-2.5 px-3 text-right">Share of Total</th>
                  <th className="py-2.5 px-3 w-40">Proportion Bar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedCategories.map((item, index) => (
                  <tr key={item.category} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 font-mono text-slate-400">{index + 1}</td>
                    <td className="py-2 px-3 font-medium text-slate-800">{item.category}</td>
                    <td className="py-2 px-3 text-right font-mono font-medium text-slate-900">
                      {item.count.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      {item.percentage.toFixed(2)}%
                    </td>
                    <td className="py-2 px-3">
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${Math.min(100, Math.max(item.percentage, 1))}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
