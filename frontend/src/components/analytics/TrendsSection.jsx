import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  MapPin,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Card, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md text-xs">
        <p className="font-semibold text-slate-700">Year {label}</p>
        <div className="mt-1 flex items-center gap-1.5 text-brand-700 font-bold text-sm">
          <span>{Number(val).toLocaleString()}</span>
          <span className="font-normal text-slate-500 text-xs">recorded incidents</span>
        </div>
      </div>
    );
  }
  return null;
}

export function TrendsSection({ trendsData, isLoading, error, onRetry }) {
  if (isLoading) {
    return (
      <Card className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center border-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600 mb-3" />
        <h3 className="text-sm font-semibold text-slate-800">Compiling Historical Crime Trends</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Aggregating year-by-year observations from district-level historical records...
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
        <h3 className="text-base font-semibold text-slate-900">Trend Data Unavailable</h3>
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

  const dataPoints = trendsData?.data || [];
  const summary = trendsData?.summary || {};

  if (!trendsData || dataPoints.length === 0) {
    return (
      <Card className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center border-slate-200">
        <Info className="h-8 w-8 text-slate-400 mb-2" />
        <h3 className="text-sm font-semibold text-slate-800">No Recorded Data Found</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md">
          No historical crime records matched the selected combination of years, location, and crime category. Try broadening the year range or selecting a different category.
        </p>
      </Card>
    );
  }

  // Calculate descriptive data-driven metrics
  const sortedPoints = [...dataPoints].sort((a, b) => a.year - b.year);
  const firstPoint = sortedPoints[0];
  const lastPoint = sortedPoints[sortedPoints.length - 1];
  const absoluteChange = lastPoint.count - firstPoint.count;
  const pctChange = firstPoint.count > 0 ? ((absoluteChange / firstPoint.count) * 100).toFixed(1) : null;

  let peakPoint = sortedPoints[0];
  let troughPoint = sortedPoints[0];
  sortedPoints.forEach((p) => {
    if (p.count > peakPoint.count) peakPoint = p;
    if (p.count < troughPoint.count) troughPoint = p;
  });

  // Geographic aggregation label
  const locationScope =
    trendsData.location_type === 'district'
      ? `${trendsData.district}, ${trendsData.state}`
      : trendsData.location_type === 'state'
      ? `${trendsData.state} (State Aggregate)`
      : 'All India (National Aggregate)';

  return (
    <div className="space-y-6">
      {/* Overview Header Card */}
      <Card className="border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">Historical Crime Trend: {trendsData.category}</CardTitle>
            </div>
            <CardDescription className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1 font-medium text-slate-700">
                <MapPin className="h-3.5 w-3.5 text-brand-600" />
                {locationScope}
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1 text-slate-500">
                <Calendar className="h-3.5 w-3.5" />
                {trendsData.start_year}–{trendsData.end_year} ({dataPoints.length} observation years)
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1 text-slate-500">
                <Layers className="h-3.5 w-3.5" />
                Aggregated by: {trendsData.location_type} level
              </span>
            </CardDescription>
          </div>
        </div>

        {/* Data-Driven Summary Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-6">
          {/* Initial Value */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {firstPoint.year} Count
            </span>
            <span className="mt-1 block text-base font-bold text-slate-900">
              {firstPoint.count.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">Period baseline</span>
          </div>

          {/* Final Value */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {lastPoint.year} Count
            </span>
            <span className="mt-1 block text-base font-bold text-slate-900">
              {lastPoint.count.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">Latest observation</span>
          </div>

          {/* Absolute Change */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Net Change
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span
                className={`text-base font-bold ${
                  absoluteChange > 0
                    ? 'text-rose-700'
                    : absoluteChange < 0
                    ? 'text-emerald-700'
                    : 'text-slate-800'
                }`}
              >
                {absoluteChange > 0 ? `+${absoluteChange.toLocaleString()}` : absoluteChange.toLocaleString()}
              </span>
              {pctChange !== null && (
                <span className="text-[11px] font-medium text-slate-600">
                  ({absoluteChange > 0 ? `+${pctChange}%` : `${pctChange}%`})
                </span>
              )}
            </div>
            <span className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
              {absoluteChange > 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-rose-600" />
                  Increased registration
                </>
              ) : absoluteChange < 0 ? (
                <>
                  <TrendingDown className="h-3 w-3 text-emerald-600" />
                  Decreased registration
                </>
              ) : (
                <>
                  <Minus className="h-3 w-3 text-slate-500" />
                  No net change
                </>
              )}
            </span>
          </div>

          {/* Peak Observation */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Peak Count
            </span>
            <span className="mt-1 block text-base font-bold text-slate-900">
              {peakPoint.count.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">Recorded in {peakPoint.year}</span>
          </div>

          {/* Lowest Observation */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Lowest Count
            </span>
            <span className="mt-1 block text-base font-bold text-slate-900">
              {troughPoint.count.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">Recorded in {troughPoint.year}</span>
          </div>

          {/* Period Average */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Annual Average
            </span>
            <span className="mt-1 block text-base font-bold text-slate-900">
              {Math.round(summary.avg_count || 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">
              Total: {(summary.total_count || 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Recharts Line Chart */}
        <div className="mt-4 pt-2">
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sortedPoints}
                margin={{ top: 15, right: 30, left: 15, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="year"
                  stroke="#64748b"
                  tickLine={false}
                  fontSize={12}
                  tickMargin={8}
                />
                <YAxis
                  stroke="#64748b"
                  tickLine={false}
                  fontSize={12}
                  tickFormatter={(val) => {
                    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                    return val;
                  }}
                  domain={['dataMin - 10', 'dataMax + 10']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name={trendsData.category}
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#0284c7', strokeWidth: 1, stroke: '#fff' }}
                  activeDot={{ r: 6, fill: '#0369a1', stroke: '#fff', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ethical Interpretation Notice */}
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-xs text-slate-600 flex items-start gap-2.5">
          <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-800">
              Data Interpretation & Registration Context
            </p>
            <p className="leading-relaxed text-slate-600">
              Recorded figures represent police incident registrations from official district records. They do not constitute an absolute census of all actual crime occurrences. Multi-year changes may reflect shifting police registration practices, public reporting willingness, district reorganizations, or legal amendments rather than true variations in underlying incidence.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
