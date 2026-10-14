import React, { useState, useEffect } from 'react';
import {
  Boxes,
  ArrowDownCircle,
  ArrowUpCircle,
  Scissors,
  Grid,
  Info,
  AlertTriangle,
  Play,
  Loader2,
} from 'lucide-react';
import { Card, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';

const OLAP_DESCRIPTIONS = {
  rollup: {
    title: 'Roll-up (Aggregation)',
    icon: ArrowUpCircle,
    summary:
      'Aggregates detailed observations from lower granularity (individual districts) to a higher dimensional hierarchy (state-level totals or all-India national totals).',
  },
  drilldown: {
    title: 'Drill-down (De-aggregation)',
    icon: ArrowDownCircle,
    summary:
      'Steps down from higher-level summary data (a specific state) into granular, constituent observations (individual district crime numbers).',
  },
  slice: {
    title: 'Slice (Single-Dimension Cut)',
    icon: Scissors,
    summary:
      'Extracts a 2D cross-section of the crime data cube by pinning a single dimension to a specific constant value (e.g., pinning a specific Year or specific State).',
  },
  dice: {
    title: 'Dice (Multi-Dimensional Subcube)',
    icon: Boxes,
    summary:
      'Carves out an analytical subcube by simultaneously applying filtering criteria across multiple dimensions (specific subsets of Years, States, and Crime Categories).',
  },
  pivot: {
    title: 'Pivot (Matrix Cross-Tabulation)',
    icon: Grid,
    summary:
      'Rotates the analytical data axes to generate a two-dimensional contingency matrix (e.g., States along rows by Years along columns, or Districts by Years).',
  },
};

export function OlapSection({
  metadata,
  onExecuteOlap,
  olapData,
  isLoading,
  error,
}) {
  const [operation, setOperation] = useState('rollup');

  // Roll-up state
  const [rollupLevel, setRollupLevel] = useState('state');
  const [rollupYear, setRollupYear] = useState('');
  const [rollupCategory, setRollupCategory] = useState('TOTAL IPC CRIMES');

  // Drill-down state
  const [drilldownState, setDrilldownState] = useState('MAHARASHTRA');
  const [drilldownYear, setDrilldownYear] = useState('');
  const [drilldownCategory, setDrilldownCategory] = useState('TOTAL IPC CRIMES');

  // Slice state
  const [sliceDimension, setSliceDimension] = useState('year');
  const [sliceValue, setSliceValue] = useState('2011');
  const [sliceCategory, setSliceCategory] = useState('TOTAL IPC CRIMES');

  // Dice state
  const [diceYears, setDiceYears] = useState([2005, 2008, 2011]);
  const [diceStates, setDiceStates] = useState(['MAHARASHTRA', 'UTTAR PRADESH', 'TAMIL NADU']);
  const [diceCategories, setDiceCategories] = useState(['BURGLARY', 'THEFT', 'RIOTS']);

  // Pivot state
  const [pivotIndex, setPivotIndex] = useState('state');
  const [pivotColumns, setPivotColumns] = useState('year');
  const [pivotValues, setPivotValues] = useState('TOTAL IPC CRIMES');
  const [pivotState, setPivotState] = useState('MAHARASHTRA');

  const years = metadata?.year_range?.years || [];
  const states = metadata?.states || [];
  const allCategories = [
    ...(metadata?.summary_categories || []),
    ...(metadata?.crime_categories || []),
  ];

  const handleSubmit = (e) => {
    e?.preventDefault?.();

    if (operation === 'rollup') {
      onExecuteOlap({
        operation: 'rollup',
        level: rollupLevel,
        year: rollupYear || undefined,
        category: rollupCategory,
      });
    } else if (operation === 'drilldown') {
      onExecuteOlap({
        operation: 'drilldown',
        state: drilldownState,
        year: drilldownYear || undefined,
        category: drilldownCategory,
      });
    } else if (operation === 'slice') {
      onExecuteOlap({
        operation: 'slice',
        dimension: sliceDimension,
        value: sliceValue,
        category: sliceCategory,
      });
    } else if (operation === 'dice') {
      onExecuteOlap({
        operation: 'dice',
        years: diceYears,
        states: diceStates,
        categories: diceCategories,
      });
    } else if (operation === 'pivot') {
      onExecuteOlap({
        operation: 'pivot',
        index: pivotIndex,
        columns: pivotColumns,
        values: pivotValues,
        state: pivotIndex === 'district' || pivotColumns === 'district' ? pivotState : undefined,
      });
    }
  };

  // Run initial rollup on first render if no olapData exists
  useEffect(() => {
    if (!olapData && !isLoading && !error) {
      onExecuteOlap({
        operation: 'rollup',
        level: 'state',
        category: 'TOTAL IPC CRIMES',
      });
    }
  }, []);

  const currentOpMeta = OLAP_DESCRIPTIONS[operation] || OLAP_DESCRIPTIONS.rollup;
  const OpIcon = currentOpMeta.icon;

  const isPivotAxesSame = operation === 'pivot' && pivotIndex === pivotColumns;

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 bg-white p-6 shadow-sm">
        <div className="border-b border-slate-100 pb-4 mb-6">
          <CardTitle className="text-xl">Multi-Dimensional OLAP Analysis Explorer</CardTitle>
          <CardDescription className="mt-1 text-xs">
            Perform On-Line Analytical Processing queries across geographic hierarchies, temporal intervals, and crime dimensions.
          </CardDescription>
        </div>

        {/* Operation Selection Bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4 mb-5">
          {Object.entries(OLAP_DESCRIPTIONS).map(([key, item]) => {
            const Icon = item.icon;
            const isSelected = operation === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setOperation(key)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.title.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Operation Concept Explanation Banner */}
        <div className="rounded-lg border border-brand-100 bg-brand-50/60 p-3.5 text-xs text-brand-900 flex items-start gap-2.5 mb-6">
          <OpIcon className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-brand-950">{currentOpMeta.title}</span>
            <p className="leading-relaxed text-slate-700">{currentOpMeta.summary}</p>
          </div>
        </div>

        {/* Dynamic Parameter Form */}
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 mb-6 space-y-4">
          <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
            Operation Parameters
          </h4>

          {/* Roll-up Controls */}
          {operation === 'rollup' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Aggregation Level</label>
                <select
                  value={rollupLevel}
                  onChange={(e) => setRollupLevel(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:border-brand-500 focus:outline-none"
                >
                  <option value="state">State Level (Districts → States)</option>
                  <option value="national">National Aggregate (Districts → All India)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Crime Category</label>
                <select
                  value={rollupCategory}
                  onChange={(e) => setRollupCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:border-brand-500 focus:outline-none"
                >
                  {allCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observation Year (Optional)</label>
                <select
                  value={rollupYear}
                  onChange={(e) => setRollupYear(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:border-brand-500 focus:outline-none"
                >
                  <option value="">All Historical Years Combined</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Drill-down Controls */}
          {operation === 'drilldown' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Parent State (Required)</label>
                <select
                  value={drilldownState}
                  onChange={(e) => setDrilldownState(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:border-brand-500 focus:outline-none"
                >
                  {states.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Crime Category</label>
                <select
                  value={drilldownCategory}
                  onChange={(e) => setDrilldownCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:border-brand-500 focus:outline-none"
                >
                  {allCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Observation Year (Optional)</label>
                <select
                  value={drilldownYear}
                  onChange={(e) => setDrilldownYear(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:border-brand-500 focus:outline-none"
                >
                  <option value="">All Historical Years Combined</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Slice Controls */}
          {operation === 'slice' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Slice Dimension</label>
                <select
                  value={sliceDimension}
                  onChange={(e) => {
                    const nextDim = e.target.value;
                    setSliceDimension(nextDim);
                    if (nextDim === 'year') {
                      setSliceValue(years[years.length - 1] ? String(years[years.length - 1]) : '2011');
                    } else {
                      setSliceValue(states[0] || 'MAHARASHTRA');
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:border-brand-500 focus:outline-none"
                >
                  <option value="year">Dimension: Year (Pin single year, view all states)</option>
                  <option value="state">Dimension: State (Pin single state, view all years)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pinned Slice Value ({sliceDimension === 'year' ? 'Year' : 'State'})
                </label>
                {sliceDimension === 'year' ? (
                  <select
                    value={sliceValue}
                    onChange={(e) => setSliceValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:border-brand-500 focus:outline-none"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        Year {y}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={sliceValue}
                    onChange={(e) => setSliceValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:border-brand-500 focus:outline-none"
                  >
                    {states.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Crime Category</label>
                <select
                  value={sliceCategory}
                  onChange={(e) => setSliceCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:border-brand-500 focus:outline-none"
                >
                  {allCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Dice Controls */}
          {operation === 'dice' && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Years Selector */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subcube Years (Multiple)</label>
                  <div className="rounded-lg border border-slate-300 bg-white p-2 max-h-32 overflow-y-auto space-y-1">
                    {years.map((y) => (
                      <label key={y} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={diceYears.includes(y)}
                          onChange={(e) => {
                            if (e.target.checked) setDiceYears([...diceYears, y]);
                            else setDiceYears(diceYears.filter((item) => item !== y));
                          }}
                          className="rounded text-brand-600 focus:ring-brand-500"
                        />
                        <span>{y}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* States Selector */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subcube States (Multiple)</label>
                  <div className="rounded-lg border border-slate-300 bg-white p-2 max-h-32 overflow-y-auto space-y-1">
                    {states.map((s) => (
                      <label key={s} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={diceStates.includes(s)}
                          onChange={(e) => {
                            if (e.target.checked) setDiceStates([...diceStates, s]);
                            else setDiceStates(diceStates.filter((item) => item !== s));
                          }}
                          className="rounded text-brand-600 focus:ring-brand-500"
                        />
                        <span className="truncate">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Categories Selector */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subcube Categories (Multiple)</label>
                  <div className="rounded-lg border border-slate-300 bg-white p-2 max-h-32 overflow-y-auto space-y-1">
                    {allCategories.map((c) => (
                      <label key={c} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={diceCategories.includes(c)}
                          onChange={(e) => {
                            if (e.target.checked) setDiceCategories([...diceCategories, c]);
                            else setDiceCategories(diceCategories.filter((item) => item !== c));
                          }}
                          className="rounded text-brand-600 focus:ring-brand-500"
                        />
                        <span className="truncate">{c}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pivot Controls */}
          {operation === 'pivot' && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Row Axis (Index)</label>
                  <select
                    value={pivotIndex}
                    onChange={(e) => setPivotIndex(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:border-brand-500 focus:outline-none"
                  >
                    <option value="state">States</option>
                    <option value="year">Years</option>
                    <option value="district">Districts</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Column Axis</label>
                  <select
                    value={pivotColumns}
                    onChange={(e) => setPivotColumns(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:border-brand-500 focus:outline-none"
                  >
                    <option value="year">Years</option>
                    <option value="state">States</option>
                    <option value="district">Districts</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Metric Value</label>
                  <select
                    value={pivotValues}
                    onChange={(e) => setPivotValues(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:border-brand-500 focus:outline-none"
                  >
                    {allCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {(pivotIndex === 'district' || pivotColumns === 'district') && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">District Scope State</label>
                    <select
                      value={pivotState}
                      onChange={(e) => setPivotState(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:border-brand-500 focus:outline-none"
                    >
                      {states.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {isPivotAxesSame && (
                <div className="text-rose-600 font-medium">
                  Row axis and Column axis cannot be the same dimension.
                </div>
              )}
            </div>
          )}

          {/* Execute Submit Button */}
          <div className="flex items-center justify-end pt-2 border-t border-slate-200/60">
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isPivotAxesSame || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  <span>Executing OLAP...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  <span>Execute {currentOpMeta.title.split(' ')[0]}</span>
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Query Status & Results */}
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50/20 p-6 text-center text-sm text-rose-700">
            <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-rose-500" />
            <p className="font-semibold">OLAP Operation Failed</p>
            <p className="text-xs text-slate-600 mt-1">{error}</p>
          </div>
        ) : olapData ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <span className="text-xs font-semibold text-slate-800">
                {olapData.description}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {olapData.row_count} records returned
              </span>
            </div>

            {/* Pivot Matrix View */}
            {olapData.operation === 'pivot' && olapData.pivot_columns ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-[500px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 text-slate-800 font-semibold border-b border-slate-200 z-10">
                    <tr>
                      <th className="py-2.5 px-3 bg-slate-200 sticky left-0 z-20">
                        {olapData.dimensions_applied?.index?.toUpperCase() || 'AXIS'}
                      </th>
                      {olapData.pivot_columns.map((col) => (
                        <th key={col} className="py-2.5 px-3 text-right whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {olapData.data.map((row) => (
                      <tr key={row.row_key} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 font-semibold text-slate-800 bg-slate-50/90 sticky left-0 whitespace-nowrap">
                          {row.row_key}
                        </td>
                        {olapData.pivot_columns.map((col) => (
                          <td key={col} className="py-2 px-3 text-right font-mono text-slate-700">
                            {(row[col] ?? 0).toLocaleString()}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Standard Result Table */
              <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-[460px]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-12">#</th>
                      {olapData.data[0] &&
                        Object.keys(olapData.data[0]).map((k) => (
                          <th
                            key={k}
                            className={`py-2.5 px-3 ${
                              typeof olapData.data[0][k] === 'number' ? 'text-right' : ''
                            }`}
                          >
                            {k.replace(/_/g, ' ').toUpperCase()}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {olapData.data.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                        {Object.entries(row).map(([k, v]) => (
                          <td
                            key={k}
                            className={`py-2 px-3 font-medium ${
                              typeof v === 'number'
                                ? 'text-right font-mono font-bold text-slate-900'
                                : 'text-slate-800'
                            }`}
                          >
                            {typeof v === 'number' ? v.toLocaleString() : String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-slate-500">
            <Info className="h-6 w-6 mx-auto mb-2 text-slate-400" />
            <span>Select parameters and click Execute to run the multidimensional OLAP query.</span>
          </div>
        )}
      </Card>
    </div>
  );
}
