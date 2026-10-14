import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  GitCompare,
  X,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
} from 'lucide-react';
import { Card, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { getAnalyticsMetadata } from '../../services/apiService.js';

const LOCATION_COLORS = [
  '#0284c7', // Sky blue
  '#e11d48', // Rose
  '#059669', // Emerald
  '#d97706', // Amber
  '#7c3aed', // Violet
  '#0891b2', // Cyan
  '#db2777', // Pink
  '#ea580c', // Orange
  '#4f46e5', // Indigo
  '#65a30d', // Lime
];

function ComparisonTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md text-xs min-w-[160px]">
        <p className="font-semibold text-slate-800 border-b border-slate-100 pb-1 mb-1.5">
          Year {label}
        </p>
        <div className="space-y-1">
          {payload.map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate max-w-[120px]">{item.name}</span>
              </span>
              <span className="font-mono font-bold text-slate-900">
                {Number(item.value).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export function ComparisonSection({
  metadata,
  scopeState,
  onExecuteComparison,
  comparisonData,
  isLoading,
  error,
}) {
  const [comparisonType, setComparisonType] = useState('state'); // 'state' | 'district'
  const [districtState, setDistrictState] = useState(scopeState || 'MAHARASHTRA');
  const [selectedLocations, setSelectedLocations] = useState([
    'MAHARASHTRA',
    'UTTAR PRADESH',
    'TAMIL NADU',
  ]);
  const [category, setCategory] = useState('TOTAL IPC CRIMES');
  const [startYear, setStartYear] = useState(2001);
  const [endYear, setEndYear] = useState(2012);
  const [districtsForComparison, setDistrictsForComparison] = useState([]);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false);
  const [addLocationSelect, setAddLocationSelect] = useState('');

  const years = metadata?.year_range?.years || [];
  const states = metadata?.states || [];
  const allCategories = [
    ...(metadata?.summary_categories || []),
    ...(metadata?.crime_categories || []),
  ];

  // Fetch districts when districtState changes
  useEffect(() => {
    if (comparisonType === 'district' && districtState) {
      let isMounted = true;
      setIsLoadingDistricts(true);
      getAnalyticsMetadata({ state: districtState })
        .then((res) => {
          if (isMounted) {
            const dsts = res?.districts || [];
            setDistrictsForComparison(dsts);
            // Default 3 districts
            setSelectedLocations(dsts.slice(0, 3));
            setIsLoadingDistricts(false);
          }
        })
        .catch(() => {
          if (isMounted) setIsLoadingDistricts(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [comparisonType, districtState]);

  const handleAddLocation = (loc) => {
    if (!loc) return;
    setSelectedLocations((prev) => {
      if (prev.includes(loc)) return prev;
      if (prev.length >= 10) return prev;
      return [...prev, loc];
    });
    setAddLocationSelect('');
  };

  const handleRemoveLocation = (loc) => {
    setSelectedLocations((prev) => prev.filter((item) => item !== loc));
  };

  const handleComparisonTypeToggle = (type) => {
    setComparisonType(type);
    setSelectedLocations([]);
    if (type === 'state') {
      const defaults = ['MAHARASHTRA', 'UTTAR PRADESH', 'TAMIL NADU'].filter((s) => states.includes(s));
      setSelectedLocations(defaults);
    }
  };

  const handleTriggerCompare = () => {
    if (selectedLocations.length < 2) return;
    onExecuteComparison({
      comparison_type: comparisonType,
      locations: selectedLocations,
      state: comparisonType === 'district' ? districtState : undefined,
      start_year: startYear,
      end_year: endYear,
      category,
    });
  };

  // Run initial comparison on mount when locations are available
  useEffect(() => {
    if (selectedLocations.length >= 2 && !comparisonData && !isLoading) {
      handleTriggerCompare();
    }
  }, [selectedLocations.length]);

  const isInvalidCount = selectedLocations.length < 2 || selectedLocations.length > 10;
  const isYearInvalid = Number(startYear) > Number(endYear);

  const availableOptions =
    comparisonType === 'state'
      ? states.filter((s) => !selectedLocations.includes(s))
      : districtsForComparison.filter((d) => !selectedLocations.includes(d));

  // Transform series data for multi-line chart
  const seriesList = comparisonData?.series || [];
  const chartPoints = (comparisonData?.yearly_comparison || []).map((yc) => {
    const point = { year: yc.year };
    seriesList.forEach((s) => {
      point[s.location] = yc.counts?.[s.location] ?? 0;
    });
    return point;
  });

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 bg-white p-6 shadow-sm">
        <div className="border-b border-slate-100 pb-4 mb-6">
          <CardTitle className="text-xl">Multi-Location Comparative Analysis</CardTitle>
          <CardDescription className="mt-1 text-xs">
            Compare historical recorded trends across up to 10 states or districts within a selected state.
          </CardDescription>
        </div>

        {/* Configuration Controls Bar */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 mb-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Mode Toggle */}
            <div className="flex items-center rounded-lg border border-slate-300 bg-white p-1">
              <button
                type="button"
                onClick={() => handleComparisonTypeToggle('state')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  comparisonType === 'state'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Compare States (National Level)
              </button>
              <button
                type="button"
                onClick={() => handleComparisonTypeToggle('district')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  comparisonType === 'district'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Compare Districts (Within State)
              </button>
            </div>

            {/* Scope State Selector (if district mode) */}
            {comparisonType === 'district' && (
              <div className="flex items-center gap-2 text-xs">
                <label htmlFor="comp-state-scope" className="font-semibold text-slate-700">
                  Target State:
                </label>
                <select
                  id="comp-state-scope"
                  value={districtState}
                  onChange={(e) => setDistrictState(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 font-medium focus:border-brand-500 focus:outline-none"
                >
                  {states.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Crime Category & Year Range */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:border-brand-500 focus:outline-none"
                title="Metric Crime Category"
              >
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={startYear}
                onChange={(e) => setStartYear(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 font-medium focus:border-brand-500 focus:outline-none"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-400">to</span>
              <select
                value={endYear}
                onChange={(e) => setEndYear(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 font-medium focus:border-brand-500 focus:outline-none"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location Multi-Select Tags & Adder */}
          <div>
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="font-semibold text-slate-700">
                Selected Locations ({selectedLocations.length}/10 max):
              </span>
              {selectedLocations.length < 2 && (
                <span className="text-amber-600 font-medium flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Select at least 2 locations to run comparison
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedLocations.map((loc, idx) => (
                <span
                  key={loc}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow-2xs"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: LOCATION_COLORS[idx % LOCATION_COLORS.length] }}
                  />
                  <span>{loc}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLocation(loc)}
                    className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title={`Remove ${loc}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}

              {/* Add Location Dropdown */}
              {selectedLocations.length < 10 && (
                <div className="flex items-center gap-1">
                  <select
                    value={addLocationSelect}
                    onChange={(e) => handleAddLocation(e.target.value)}
                    disabled={isLoadingDistricts}
                    className="rounded-full border border-dashed border-slate-300 bg-white px-3 py-1 text-xs text-slate-600 font-medium hover:border-slate-400 focus:border-brand-500 focus:outline-none"
                  >
                    <option value="">+ Add {comparisonType === 'state' ? 'State' : 'District'}...</option>
                    {availableOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Execute Button */}
          <div className="flex items-center justify-end pt-2 border-t border-slate-200/60">
            <Button
              variant="primary"
              size="sm"
              onClick={handleTriggerCompare}
              disabled={isInvalidCount || isYearInvalid || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  <span>Comparing...</span>
                </>
              ) : (
                <>
                  <GitCompare className="h-3.5 w-3.5 mr-1.5" />
                  <span>Update Comparison Chart</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Chart View */}
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50/20 p-6 text-center text-sm text-rose-700">
            <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-rose-500" />
            <p className="font-semibold">Comparison Query Failed</p>
            <p className="text-xs text-slate-600 mt-1">{error}</p>
          </div>
        ) : chartPoints.length > 0 ? (
          <div className="space-y-6">
            <div className="h-[380px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartPoints}
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
                  />
                  <Tooltip content={<ComparisonTooltip />} />
                  <Legend />
                  {seriesList.map((series, idx) => (
                    <Line
                      key={series.location}
                      type="monotone"
                      dataKey={series.location}
                      stroke={LOCATION_COLORS[idx % LOCATION_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3.5, fill: LOCATION_COLORS[idx % LOCATION_COLORS.length] }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Comparison Aggregate Summary Table */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">
                Location Summary Totals ({startYear}–{endYear})
              </h4>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Location</th>
                      <th className="py-2.5 px-3 text-right">Cumulative Recorded</th>
                      <th className="py-2.5 px-3 text-right">Annual Average</th>
                      <th className="py-2.5 px-3 text-right">Lowest Year</th>
                      <th className="py-2.5 px-3 text-right">Peak Year</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {seriesList.map((s, idx) => {
                      const counts = s.data.map((d) => d.count);
                      const minCount = Math.min(...counts);
                      const maxCount = Math.max(...counts);
                      const minPoint = s.data.find((d) => d.count === minCount);
                      const maxPoint = s.data.find((d) => d.count === maxCount);
                      const avg = s.data.length > 0 ? Math.round(s.total / s.data.length) : 0;

                      return (
                        <tr key={s.location} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-800 flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: LOCATION_COLORS[idx % LOCATION_COLORS.length] }}
                            />
                            <span>{s.location}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {s.total.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                            {avg.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {minCount.toLocaleString()} ({minPoint?.year})
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {maxCount.toLocaleString()} ({maxPoint?.year})
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-slate-500">
            <Info className="h-6 w-6 mx-auto mb-2 text-slate-400" />
            <span>Select at least two locations and click Update Comparison Chart to compare.</span>
          </div>
        )}
      </Card>
    </div>
  );
}
