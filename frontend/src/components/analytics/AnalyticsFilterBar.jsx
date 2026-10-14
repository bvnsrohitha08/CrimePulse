import React from 'react';
import { Filter, RotateCcw, MapPin, Calendar, Layers, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export function AnalyticsFilterBar({
  metadata,
  filters,
  districts,
  isLoadingDistricts,
  onFilterChange,
  onApply,
  onReset,
  isApplying = false,
}) {
  const years = metadata?.year_range?.years || [];
  const states = metadata?.states || [];
  const individualCategories = metadata?.crime_categories || [];
  const summaryCategories = metadata?.summary_categories || [];

  const isYearRangeInvalid = Number(filters.startYear) > Number(filters.endYear);

  return (
    <Card className="border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        {/* Filter Title & Active Scope Badge */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Filter className="h-4 w-4 text-brand-600" />
            <span>Dataset Query & Exploration Filters</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-medium text-slate-500">Active Scope:</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-800 border border-slate-200">
              <MapPin className="h-3 w-3 text-brand-600" />
              {filters.district ? (
                <span>
                  {filters.district}, {filters.state}
                </span>
              ) : filters.state ? (
                <span>State: {filters.state}</span>
              ) : (
                <span>All India (National Aggregate)</span>
              )}
              <span className="text-slate-300">•</span>
              <Calendar className="h-3 w-3 text-slate-500" />
              <span>
                {filters.startYear}–{filters.endYear}
              </span>
              <span className="text-slate-300">•</span>
              <Layers className="h-3 w-3 text-slate-500" />
              <span className="truncate max-w-[140px] sm:max-w-[200px]" title={filters.category}>
                {filters.category}
              </span>
            </span>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
          {/* Start Year */}
          <div>
            <label htmlFor="analytics-filter-start-year" className="block text-xs font-semibold text-slate-700 mb-1">
              Start Year
            </label>
            <select
              id="analytics-filter-start-year"
              value={filters.startYear}
              onChange={(e) => onFilterChange('startYear', Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* End Year */}
          <div>
            <label htmlFor="analytics-filter-end-year" className="block text-xs font-semibold text-slate-700 mb-1">
              End Year
            </label>
            <select
              id="analytics-filter-end-year"
              value={filters.endYear}
              onChange={(e) => onFilterChange('endYear', Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* State / UT */}
          <div>
            <label htmlFor="analytics-filter-state" className="block text-xs font-semibold text-slate-700 mb-1">
              State / Union Territory
            </label>
            <select
              id="analytics-filter-state"
              value={filters.state}
              onChange={(e) => onFilterChange('state', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All India (National Aggregate)</option>
              {states.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* District */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="analytics-filter-district" className="block text-xs font-semibold text-slate-700">
                District
              </label>
              {isLoadingDistricts && (
                <span className="flex items-center gap-1 text-[11px] text-brand-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </span>
              )}
            </div>
            <select
              id="analytics-filter-district"
              value={filters.district}
              disabled={!filters.state || isLoadingDistricts}
              onChange={(e) => onFilterChange('district', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <option value="">
                {filters.state ? 'All Districts in State' : 'Select state first'}
              </option>
              {districts.map((dst) => (
                <option key={dst} value={dst}>
                  {dst}
                </option>
              ))}
            </select>
          </div>

          {/* Crime Category */}
          <div>
            <label htmlFor="analytics-filter-category" className="block text-xs font-semibold text-slate-700 mb-1">
              Crime Category
            </label>
            <select
              id="analytics-filter-category"
              value={filters.category}
              onChange={(e) => onFilterChange('category', e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {summaryCategories.length > 0 && (
                <optgroup label="Summary Totals">
                  {summaryCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </optgroup>
              )}
              {individualCategories.length > 0 && (
                <optgroup label="Individual Crime Classes">
                  {individualCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {/* Validation Warning & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <div>
            {isYearRangeInvalid && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Start year ({filters.startYear}) cannot exceed end year ({filters.endYear}).</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="text-slate-600 hover:text-slate-900"
              title="Reset to default filters"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              <span>Reset</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={onApply}
              disabled={isYearRangeInvalid || isApplying}
              className="min-w-[120px]"
            >
              {isApplying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  <span>Applying...</span>
                </>
              ) : (
                <>
                  <Filter className="h-3.5 w-3.5 mr-1.5" />
                  <span>Apply Filters</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
