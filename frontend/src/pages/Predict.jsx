import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BrainCircuit,
  Sparkles,
  MapPin,
  Calendar,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../hooks/useAuth';
import { predictCrime, ApiError } from '../services/apiService';
import { validatePredictionForm } from '../utils/validation';

export function Predict() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Form inputs state
  const [formData, setFormData] = useState({
    state: '',
    district: '',
    year: '',
  });

  // UI state
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [result, setResult] = useState(null);

  // Quick sample loader for evaluator convenience
  const handleLoadSample = () => {
    setFormData({
      state: 'ANDHRA PRADESH',
      district: 'ADILABAD',
      year: '2011',
    });
    setErrors({});
    setApiError(null);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field-specific validation error on edit
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (apiError) setApiError(null);
  };

  const handleReset = () => {
    setFormData({
      state: '',
      district: '',
      year: '',
    });
    setErrors({});
    setApiError(null);
    setResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return; // Prevent duplicate submissions

    // Validate form parameters
    const validation = validatePredictionForm(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setApiError(null);
    setIsLoading(true);

    try {
      const response = await predictCrime({
        state: formData.state.trim(),
        district: formData.district.trim(),
        year: Number(formData.year),
      });

      setResult(response);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          logout();
          navigate('/login', {
            state: {
              from: location,
              message: 'Your session has expired. Please sign in again to continue.',
            },
          });
          return;
        }

        // Contextual error explanation
        let friendlyMessage = err.message;
        if (err.code === 'RECORD_NOT_FOUND' || err.status === 404) {
          friendlyMessage = `No historical crime record was found for State "${formData.state}", District "${formData.district}", and Year ${formData.year}. The model requires an existing historical baseline to compute next-year forecasting.`;
        } else if (err.code === 'UNSEEN_STATE') {
          friendlyMessage = `The state "${formData.state}" was not present in the model's historical training data. Please check spelling or try another Indian State/UT.`;
        } else if (err.code === 'UNSEEN_DISTRICT') {
          friendlyMessage = `The district "${formData.district}" was not present in the model's historical training data. Please verify the historical district name.`;
        }

        setApiError({
          code: err.code,
          status: err.status,
          message: friendlyMessage,
        });
      } else {
        setApiError({
          code: 'UNEXPECTED_ERROR',
          status: 500,
          message: 'An unexpected error occurred while processing the prediction.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="primary">Prediction Console</Badge>
          <span className="text-xs text-slate-400">•</span>
          <span className="text-xs font-medium text-slate-500">Authenticated ML Pipeline</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Historical Crime Pattern Forecasting
        </h1>
        <p className="text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
          Analyze historical district-wise crime data and forecast the dominant next-year crime classification
          using our pre-trained Random Forest model.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Parameters Form Card */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle>Forecast Input Parameters</CardTitle>
                  <CardDescription>
                    Specify the State, District, and baseline observation year.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadSample}
                  type="button"
                  className="text-xs self-start sm:self-auto"
                >
                  <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                  <span>Load Sample (Andhra Pradesh, 2011)</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {/* State Input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="predict-state-input"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <MapPin className="h-3.5 w-3.5 text-slate-500" />
                    State / Union Territory
                  </label>
                  <Input
                    id="predict-state-input"
                    placeholder="e.g. ANDHRA PRADESH"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    disabled={isLoading}
                    aria-invalid={!!errors.state}
                    aria-describedby={errors.state ? 'state-error' : undefined}
                    className={errors.state ? 'border-rose-400 focus-visible:ring-rose-500' : ''}
                  />
                  {errors.state ? (
                    <p id="state-error" role="alert" className="text-xs text-rose-600 font-medium">
                      {errors.state}
                    </p>
                  ) : (
                    <span className="text-[11px] text-slate-400 block">
                      Indian State or Union Territory name as cataloged in historical crime records.
                    </span>
                  )}
                </div>

                {/* District Input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="predict-district-input"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <MapPin className="h-3.5 w-3.5 text-slate-500" />
                    District
                  </label>
                  <Input
                    id="predict-district-input"
                    placeholder="e.g. ADILABAD"
                    value={formData.district}
                    onChange={(e) => handleInputChange('district', e.target.value)}
                    disabled={isLoading}
                    aria-invalid={!!errors.district}
                    aria-describedby={errors.district ? 'district-error' : undefined}
                    className={errors.district ? 'border-rose-400 focus-visible:ring-rose-500' : ''}
                  />
                  {errors.district ? (
                    <p id="district-error" role="alert" className="text-xs text-rose-600 font-medium">
                      {errors.district}
                    </p>
                  ) : (
                    <span className="text-[11px] text-slate-400 block">
                      District within the specified State/UT.
                    </span>
                  )}
                </div>

                {/* Year Input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="predict-year-input"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    Historical Observation Year
                  </label>
                  <Input
                    id="predict-year-input"
                    type="number"
                    step="1"
                    placeholder="e.g. 2011"
                    value={formData.year}
                    onChange={(e) => handleInputChange('year', e.target.value)}
                    disabled={isLoading}
                    aria-invalid={!!errors.year}
                    aria-describedby={errors.year ? 'year-error' : undefined}
                    className={errors.year ? 'border-rose-400 focus-visible:ring-rose-500' : ''}
                  />
                  {errors.year ? (
                    <p id="year-error" role="alert" className="text-xs text-rose-600 font-medium">
                      {errors.year}
                    </p>
                  ) : (
                    <span className="text-[11px] text-slate-400 block">
                      Historical base year (integer). The model predicts next-year (Year + 1) dominant crime.
                    </span>
                  )}
                </div>

                {/* API Error Alert Area */}
                {apiError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 space-y-1"
                  >
                    <div className="flex items-center gap-2 font-semibold text-rose-900">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                      <span>
                        {apiError.code === 'RECORD_NOT_FOUND'
                          ? 'Historical Record Unavailable'
                          : 'Prediction Request Failed'}
                      </span>
                    </div>
                    <p className="leading-relaxed pl-6">{apiError.message}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    disabled={isLoading}
                    className="w-full sm:w-auto text-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Clear Form</span>
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isLoading}
                    className="w-full sm:w-auto text-sm"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processing Prediction...</span>
                      </>
                    ) : (
                      <>
                        <BrainCircuit className="h-4 w-4" />
                        <span>Execute Prediction</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Model Specs Card */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-brand-600" />
                Inference Engine Specs
              </CardTitle>
              <CardDescription>Architecture & configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Algorithm</span>
                <span className="font-semibold text-slate-800">Random Forest</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Estimators</span>
                <span className="font-semibold text-slate-800">300 Trees</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Max Tree Depth</span>
                <span className="font-semibold text-slate-800">15</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Input Feature Count</span>
                <span className="font-semibold text-slate-800">15 Features</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Target Categories</span>
                <span className="font-semibold text-slate-800">6 Major Crime Classes</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Historical Archive</span>
                <span className="font-semibold text-slate-800">Historical Crime Data</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Prediction Result Section */}
      {result && (
        <div className="space-y-6 pt-2">
          {/* Main Result Card */}
          <Card className="border-brand-200 bg-gradient-to-br from-white to-brand-50/30 shadow-md">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="success">Classification Successful</Badge>
                    {result.analysis_id && (
                      <Badge variant="default" className="font-mono text-[10px]">
                        ID: {result.analysis_id}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-xl sm:text-2xl text-slate-900">
                    Forecast Analysis Results
                  </CardTitle>
                </div>
                <div className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{result.state}</span> • {result.district}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Highlight Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Predicted Crime Category */}
                <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 space-y-1 sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand-700 block">
                    Predicted Dominant Crime Category
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold text-brand-900 tracking-tight">
                    {result.predicted_crime}
                  </div>
                  <p className="text-xs text-brand-700/80 pt-1">
                    Forecasted for Target Year{' '}
                    <span className="font-bold text-brand-900">{result.target_year}</span> based on{' '}
                    <span className="font-bold text-brand-900">{result.input_year}</span> historical baseline.
                  </p>
                </div>

                {/* Model Classification Confidence */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                    Model Classification Confidence
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                    {typeof result.confidence_percentage === 'number'
                      ? `${result.confidence_percentage.toFixed(2)}%`
                      : `${result.confidence_percentage}%`}
                  </div>
                  <p className="text-[11px] text-slate-500 pt-1">
                    Random Forest ensemble decision leaf agreement for dominant class.
                  </p>
                </div>
              </div>

              {/* Temporal & Spatial Parameters Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">State / UT</span>
                  <span className="font-semibold text-slate-800">{result.state}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">District</span>
                  <span className="font-semibold text-slate-800">{result.district}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Input Year (N)</span>
                  <span className="font-semibold text-slate-800">{result.input_year}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Target Forecast (N+1)</span>
                  <span className="font-semibold text-slate-800">{result.target_year}</span>
                </div>
              </div>

              {/* Multi-Class Probability Distribution */}
              {Array.isArray(result.probabilities) && result.probabilities.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Category Probability Distribution</span>
                      <span className="text-xs font-normal text-slate-500">
                        ({result.probabilities.length} Target Classes)
                      </span>
                    </h4>
                    <span className="text-[11px] text-slate-400">Class Percentage</span>
                  </div>

                  <div className="space-y-2.5">
                    {result.probabilities.map((item) => {
                      const isDominant = item.crime_category === result.predicted_crime;
                      const percentage =
                        typeof item.probability_percentage === 'number'
                          ? item.probability_percentage
                          : parseFloat(item.probability_percentage) || 0;

                      return (
                        <div
                          key={item.crime_category}
                          className={`p-3 rounded-lg border transition-all ${
                            isDominant
                              ? 'border-brand-300 bg-brand-50/50 shadow-sm'
                              : 'border-slate-100 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                            <span className="flex items-center gap-2 text-slate-800">
                              {isDominant && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                              )}
                              <span className={isDominant ? 'font-bold text-brand-900' : ''}>
                                {item.crime_category}
                              </span>
                              {isDominant && (
                                <Badge variant="primary" className="text-[10px] py-0 px-1.5">
                                  Dominant
                                </Badge>
                              )}
                            </span>
                            <span
                              className={`font-mono text-xs ${
                                isDominant ? 'font-bold text-brand-800' : 'text-slate-600'
                              }`}
                            >
                              {percentage.toFixed(2)}%
                            </span>
                          </div>

                          {/* CSS Accessible Horizontal Bar Chart */}
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isDominant ? 'bg-brand-600' : 'bg-slate-400'
                              }`}
                              style={{ width: `${Math.max(percentage, 0.5)}%` }}
                              role="progressbar"
                              aria-valuenow={percentage}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`${item.crime_category} probability: ${percentage.toFixed(2)}%`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Responsible Interpretation & Ethical Disclaimer */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 text-amber-950 text-xs space-y-2 mt-4">
                <div className="flex items-center gap-2 font-semibold text-amber-900 text-sm">
                  <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Responsible Interpretation & Model Advisory</span>
                </div>
                <ul className="space-y-1.5 text-amber-800/90 list-disc list-inside leading-relaxed text-[11px] sm:text-xs">
                  <li>
                    <strong className="text-amber-950">Historical Model Classification:</strong> The output
                    reflects a statistical classification derived from historical district-wise crime data and does not
                    constitute a guarantee, certainty, or live report of future real-world crime events.
                  </li>
                  <li>
                    <strong className="text-amber-950">Model Confidence Metric:</strong> The reported
                    confidence percentage describes the Random Forest classifier&apos;s decision leaf
                    certainty for this feature vector, not the real-world probability that a crime will occur.
                  </li>
                  <li>
                    <strong className="text-amber-950">Non-Discriminatory Use:</strong> This prediction is
                    designed strictly for academic research and spatial trend analytics. It must not be
                    used as the sole basis for decisions regarding individuals, communities, or law
                    enforcement profiling.
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
