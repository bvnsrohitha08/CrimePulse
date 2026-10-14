import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  BarChart3,
  GitCompare,
  Boxes,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Database,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { AnalyticsFilterBar } from '../components/analytics/AnalyticsFilterBar';
import { TrendsSection } from '../components/analytics/TrendsSection';
import { CategoryDistributionSection } from '../components/analytics/CategoryDistributionSection';
import { ComparisonSection } from '../components/analytics/ComparisonSection';
import { OlapSection } from '../components/analytics/OlapSection';
import { ModelEvaluationSection } from '../components/analytics/ModelEvaluationSection';

import {
  getAnalyticsMetadata,
  getAnalyticsTrends,
  getAnalyticsCategoryDistribution,
  getAnalyticsComparison,
  getAnalyticsOlap,
  getAnalyticsModelEvaluation,
} from '../services/apiService';

const TABS = [
  { id: 'trends', label: 'Historical Trends', icon: TrendingUp },
  { id: 'distribution', label: 'Category Distribution', icon: BarChart3 },
  { id: 'comparison', label: 'State & District Comparison', icon: GitCompare },
  { id: 'olap', label: 'OLAP Explorer', icon: Boxes },
  { id: 'evaluation', label: 'Model Evaluation', icon: ShieldCheck },
];

export function Analytics() {
  const [activeTab, setActiveTab] = useState('trends');

  // Metadata state
  const [metadata, setMetadata] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false);
  const [metadataError, setMetadataError] = useState(null);

  // Filter Form State (staged inputs)
  const [filters, setFilters] = useState({
    startYear: 2001,
    endYear: 2012,
    state: '',
    district: '',
    category: 'TOTAL IPC CRIMES',
  });

  // Applied Filters State (active query parameters)
  const [appliedFilters, setAppliedFilters] = useState({
    startYear: 2001,
    endYear: 2012,
    state: '',
    district: '',
    category: 'TOTAL IPC CRIMES',
  });

  const [isApplyingFilters, setIsApplyingFilters] = useState(false);

  // Tab data states
  // 1. Trends
  const [trendsData, setTrendsData] = useState(null);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [trendsError, setTrendsError] = useState(null);

  // 2. Category Distribution
  const [distYear, setDistYear] = useState(2012);
  const [distIncludeSummaries, setDistIncludeSummaries] = useState(false);
  const [categoryDistData, setCategoryDistData] = useState(null);
  const [isLoadingDist, setIsLoadingDist] = useState(false);
  const [distError, setDistError] = useState(null);

  // 3. Comparison
  const [comparisonData, setComparisonData] = useState(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  const [comparisonError, setComparisonError] = useState(null);

  // 4. OLAP
  const [olapData, setOlapData] = useState(null);
  const [isLoadingOlap, setIsLoadingOlap] = useState(false);
  const [olapError, setOlapError] = useState(null);

  // 5. Model Evaluation
  const [modelEvalData, setModelEvalData] = useState(null);
  const [isLoadingModelEval, setIsLoadingModelEval] = useState(false);
  const [modelEvalError, setModelEvalError] = useState(null);

  // Load Metadata on initial mount
  const loadMetadata = useCallback(async () => {
    setIsLoadingMetadata(true);
    setMetadataError(null);
    try {
      const data = await getAnalyticsMetadata();
      setMetadata(data);

      const minYear = data.year_range?.min_year || 2001;
      const maxYear = data.year_range?.max_year || 2012;

      setFilters((prev) => ({
        ...prev,
        startYear: minYear,
        endYear: maxYear,
      }));
      setAppliedFilters((prev) => ({
        ...prev,
        startYear: minYear,
        endYear: maxYear,
      }));
      setDistYear(maxYear);
    } catch (err) {
      setMetadataError(err.message || 'Failed to load historical analytics metadata.');
    } finally {
      setIsLoadingMetadata(false);
    }
  }, []);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Load districts dynamically when staged state filter changes
  useEffect(() => {
    if (!filters.state) {
      setDistricts([]);
      setFilters((prev) => ({ ...prev, district: '' }));
      return;
    }

    let isMounted = true;
    setIsLoadingDistricts(true);
    getAnalyticsMetadata({ state: filters.state })
      .then((data) => {
        if (isMounted) {
          setDistricts(data.districts || []);
          setIsLoadingDistricts(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingDistricts(false);
      });

    return () => {
      isMounted = false;
    };
  }, [filters.state]);

  // Fetch Trends data
  const fetchTrends = useCallback(async (currentFilters) => {
    setIsLoadingTrends(true);
    setTrendsError(null);
    try {
      const data = await getAnalyticsTrends({
        start_year: currentFilters.startYear,
        end_year: currentFilters.endYear,
        state: currentFilters.state || undefined,
        district: currentFilters.district || undefined,
        category: currentFilters.category,
      });
      setTrendsData(data);
    } catch (err) {
      setTrendsError(err.message || 'Failed to fetch historical trends.');
    } finally {
      setIsLoadingTrends(false);
    }
  }, []);

  // Fetch Category Distribution data
  const fetchCategoryDistribution = useCallback(
    async (year, currentFilters, includeSummaries) => {
      setIsLoadingDist(true);
      setDistError(null);
      try {
        const data = await getAnalyticsCategoryDistribution({
          year,
          state: currentFilters.state || undefined,
          district: currentFilters.district || undefined,
          include_summaries: includeSummaries,
        });
        setCategoryDistData(data);
      } catch (err) {
        setDistError(err.message || 'Failed to fetch category distribution.');
      } finally {
        setIsLoadingDist(false);
      }
    },
    []
  );

  // Fetch Comparison data
  const handleExecuteComparison = useCallback(async (params) => {
    setIsLoadingComparison(true);
    setComparisonError(null);
    try {
      const data = await getAnalyticsComparison(params);
      setComparisonData(data);
    } catch (err) {
      setComparisonError(err.message || 'Failed to execute comparison query.');
    } finally {
      setIsLoadingComparison(false);
    }
  }, []);

  // Fetch OLAP data
  const handleExecuteOlap = useCallback(async (params) => {
    setIsLoadingOlap(true);
    setOlapError(null);
    try {
      const data = await getAnalyticsOlap(params);
      setOlapData(data);
    } catch (err) {
      setOlapError(err.message || 'Failed to execute OLAP query.');
    } finally {
      setIsLoadingOlap(false);
    }
  }, []);

  // Fetch Model Evaluation data
  const fetchModelEvaluation = useCallback(async () => {
    if (modelEvalData) return; // cache after first fetch
    setIsLoadingModelEval(true);
    setModelEvalError(null);
    try {
      const data = await getAnalyticsModelEvaluation();
      setModelEvalData(data);
    } catch (err) {
      setModelEvalError(err.message || 'Failed to load model evaluation data.');
    } finally {
      setIsLoadingModelEval(false);
    }
  }, [modelEvalData]);

  // Trigger initial trends fetch once metadata is ready
  useEffect(() => {
    if (metadata && !trendsData && !isLoadingTrends) {
      fetchTrends(appliedFilters);
    }
  }, [metadata, fetchTrends, appliedFilters, trendsData, isLoadingTrends]);

  // Tab switch effect to load data on demand
  useEffect(() => {
    if (!metadata) return;

    if (activeTab === 'trends' && !trendsData && !isLoadingTrends) {
      fetchTrends(appliedFilters);
    } else if (activeTab === 'distribution' && !categoryDistData && !isLoadingDist) {
      fetchCategoryDistribution(distYear, appliedFilters, distIncludeSummaries);
    } else if (activeTab === 'evaluation' && !modelEvalData && !isLoadingModelEval) {
      fetchModelEvaluation();
    }
  }, [
    activeTab,
    metadata,
    appliedFilters,
    distYear,
    distIncludeSummaries,
    trendsData,
    categoryDistData,
    modelEvalData,
    isLoadingTrends,
    isLoadingDist,
    isLoadingModelEval,
    fetchTrends,
    fetchCategoryDistribution,
    fetchModelEvaluation,
  ]);

  // Filter change handlers
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'state' ? { district: '' } : {}),
    }));
  };

  const handleApplyFilters = async () => {
    setIsApplyingFilters(true);
    setAppliedFilters(filters);

    try {
      // Re-fetch current active view
      if (activeTab === 'trends') {
        await fetchTrends(filters);
      } else if (activeTab === 'distribution') {
        await fetchCategoryDistribution(distYear, filters, distIncludeSummaries);
      }
    } finally {
      setIsApplyingFilters(false);
    }
  };

  const handleResetFilters = () => {
    const minYear = metadata?.year_range?.min_year || 2001;
    const maxYear = metadata?.year_range?.max_year || 2012;

    const resetDefaults = {
      startYear: minYear,
      endYear: maxYear,
      state: '',
      district: '',
      category: 'TOTAL IPC CRIMES',
    };

    setFilters(resetDefaults);
    setAppliedFilters(resetDefaults);
    setDistYear(maxYear);

    if (activeTab === 'trends') {
      fetchTrends(resetDefaults);
    } else if (activeTab === 'distribution') {
      fetchCategoryDistribution(maxYear, resetDefaults, distIncludeSummaries);
    }
  };

  const handleDistYearChange = (newYear) => {
    setDistYear(newYear);
    fetchCategoryDistribution(newYear, appliedFilters, distIncludeSummaries);
  };

  const handleToggleSummaries = (included) => {
    setDistIncludeSummaries(included);
    fetchCategoryDistribution(distYear, appliedFilters, included);
  };

  if (isLoadingMetadata) {
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center p-8 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-brand-600 mb-4" />
        <h2 className="text-lg font-bold text-slate-900">Loading CrimePulse Historical Analytics</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Connecting to Express API gateway and initializing historical dimensional metadata...
        </p>
      </div>
    );
  }

  if (metadataError) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-4">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Historical Analytics Unavailable</h2>
        <p className="mt-1 text-sm text-slate-600 max-w-md">{metadataError}</p>
        <Button variant="primary" size="md" onClick={loadMetadata} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Retry Connection
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Context Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Historical Crime Analytics & Visualizations
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
              Exploratory historical crime trend analytics, multi-category distributions, cross-location comparisons, OLAP data cube operations, and machine learning classifier diagnostics.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              <Database className="h-3.5 w-3.5 text-brand-600" />
              <span>{metadata?.total_records?.toLocaleString()} Records Archive</span>
            </span>
          </div>
        </div>
      </div>

      {/* Shared Filter Bar (Available across views) */}
      <AnalyticsFilterBar
        metadata={metadata}
        filters={filters}
        districts={districts}
        isLoadingDistricts={isLoadingDistricts}
        onFilterChange={handleFilterChange}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        isApplying={isApplyingFilters}
      />

      {/* Sub-Navigation Analytics Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto pb-px" aria-label="Analytics Views">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'trends' && (
          <TrendsSection
            trendsData={trendsData}
            isLoading={isLoadingTrends}
            error={trendsError}
            onRetry={() => fetchTrends(appliedFilters)}
          />
        )}

        {activeTab === 'distribution' && (
          <CategoryDistributionSection
            distData={categoryDistData}
            isLoading={isLoadingDist}
            error={distError}
            onRetry={() => fetchCategoryDistribution(distYear, appliedFilters, distIncludeSummaries)}
            availableYears={metadata?.year_range?.years || []}
            selectedYear={distYear}
            onYearChange={handleDistYearChange}
            includeSummaries={distIncludeSummaries}
            onToggleSummaries={handleToggleSummaries}
          />
        )}

        {activeTab === 'comparison' && (
          <ComparisonSection
            metadata={metadata}
            scopeState={appliedFilters.state}
            availableDistricts={districts}
            onExecuteComparison={handleExecuteComparison}
            comparisonData={comparisonData}
            isLoading={isLoadingComparison}
            error={comparisonError}
          />
        )}

        {activeTab === 'olap' && (
          <OlapSection
            metadata={metadata}
            onExecuteOlap={handleExecuteOlap}
            olapData={olapData}
            isLoading={isLoadingOlap}
            error={olapError}
          />
        )}

        {activeTab === 'evaluation' && (
          <ModelEvaluationSection
            evalData={modelEvalData}
            isLoading={isLoadingModelEval}
            error={modelEvalError}
            onRetry={fetchModelEvaluation}
          />
        )}
      </div>
    </div>
  );
}

export default Analytics;
