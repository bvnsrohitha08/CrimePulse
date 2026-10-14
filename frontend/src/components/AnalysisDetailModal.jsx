import React, { useEffect, useState } from 'react';
import {
  X,
  BrainCircuit,
  MapPin,
  Calendar,
  Clock,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { getAnalysisById, ApiError } from '../services/apiService';

export function AnalysisDetailModal({ isOpen, onClose, analysisId, onAuthError }) {
  const [record, setRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !analysisId) {
      return;
    }

    let isMounted = true;

    getAnalysisById(analysisId)
      .then((data) => {
        if (isMounted) {
          setRecord(data.analysis || data);
          setError(null);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err instanceof ApiError) {
          if (err.status === 401) {
            onAuthError?.();
            return;
          }
          if (err.status === 404 || err.code === 'RECORD_NOT_FOUND') {
            setError('This analysis record was not found or is not accessible by your account.');
          } else {
            setError(err.message || 'Failed to retrieve analysis details.');
          }
        } else {
          setError('An unexpected error occurred while loading record details.');
        }
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, analysisId, onAuthError]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDateTime = (isoString) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success">COMPLETED</Badge>;
      case 'FAILED':
        return <Badge variant="danger">FAILED</Badge>;
      case 'PENDING':
        return <Badge variant="warning">PENDING</Badge>;
      default:
        return <Badge variant="default">{status || 'UNKNOWN'}</Badge>;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Analysis Inspection
              </span>
              {record && getStatusBadge(record.status)}
            </div>
            <h2 id="detail-modal-title" className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-brand-600 shrink-0" />
              <span>Prediction Analysis Details</span>
            </h2>
            <div className="text-xs font-mono text-slate-400">
              ID: {analysisId}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
            <p className="text-xs font-medium">Fetching record from database...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 space-y-1"
          >
            <div className="flex items-center gap-2 font-semibold text-rose-900">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>Inspection Error</span>
            </div>
            <p className="leading-relaxed pl-6">{error}</p>
          </div>
        )}

        {/* Record Content */}
        {!isLoading && record && (
          <div className="space-y-6 text-xs">
            {/* Geotag & Timeframe Summary Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-slate-400 flex items-center gap-1 font-medium mb-0.5">
                  <MapPin className="h-3 w-3" /> State / UT
                </span>
                <span className="font-semibold text-slate-800">{record.state || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 flex items-center gap-1 font-medium mb-0.5">
                  <MapPin className="h-3 w-3" /> District
                </span>
                <span className="font-semibold text-slate-800">{record.district || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 flex items-center gap-1 font-medium mb-0.5">
                  <Calendar className="h-3 w-3" /> Base Year (N)
                </span>
                <span className="font-semibold text-slate-800">{record.inputYear ?? '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 flex items-center gap-1 font-medium mb-0.5">
                  <Calendar className="h-3 w-3" /> Target Year (N+1)
                </span>
                <span className="font-semibold text-slate-800">{record.targetYear ?? '-'}</span>
              </div>
            </div>

            {/* Status-Specific Content */}
            {record.status === 'COMPLETED' && (
              <>
                {/* Dominant Prediction Highlight */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 rounded-xl border border-brand-200 bg-brand-50/70 p-4 space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand-700 block">
                      Predicted Dominant Crime Category
                    </span>
                    <div className="text-xl sm:text-2xl font-extrabold text-brand-900 tracking-tight">
                      {record.predictedCrime || 'Unavailable'}
                    </div>
                    <p className="text-[11px] text-brand-700/80 pt-0.5">
                      Classified for Target Year {record.targetYear} from {record.inputYear} historical data.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                      Classification Confidence
                    </span>
                    <div className="text-xl sm:text-2xl font-extrabold text-slate-900">
                      {typeof record.confidencePercentage === 'number'
                        ? `${record.confidencePercentage.toFixed(2)}%`
                        : record.confidencePercentage ? `${record.confidencePercentage}%` : '-'}
                    </div>
                    <p className="text-[11px] text-slate-500 pt-0.5">
                      Model leaf agreement.
                    </p>
                  </div>
                </div>

                {/* Probability Distribution Breakdown */}
                {Array.isArray(record.probabilities) && record.probabilities.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900">
                        Class Probability Distribution ({record.probabilities.length} Target Classes)
                      </h4>
                      <span className="text-[11px] text-slate-400">Class Percentage</span>
                    </div>

                    <div className="space-y-2">
                      {record.probabilities.map((item) => {
                        const isDominant = item.crimeCategory === record.predictedCrime;
                        const pct =
                          typeof item.probabilityPercentage === 'number'
                            ? item.probabilityPercentage
                            : parseFloat(item.probabilityPercentage) || 0;

                        return (
                          <div
                            key={item.crimeCategory}
                            className={`p-2.5 rounded-lg border transition-all ${
                              isDominant
                                ? 'border-brand-300 bg-brand-50/50'
                                : 'border-slate-100 bg-slate-50/40'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-medium mb-1">
                              <span className="flex items-center gap-1.5 text-slate-800">
                                {isDominant && (
                                  <CheckCircle2 className="h-3 w-3 text-brand-600 shrink-0" />
                                )}
                                <span className={isDominant ? 'font-bold text-brand-900' : ''}>
                                  {item.crimeCategory}
                                </span>
                              </span>
                              <span
                                className={`font-mono text-xs ${
                                  isDominant ? 'font-bold text-brand-800' : 'text-slate-600'
                                }`}
                              >
                                {pct.toFixed(2)}%
                              </span>
                            </div>

                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isDominant ? 'bg-brand-600' : 'bg-slate-400'
                                }`}
                                style={{ width: `${Math.max(pct, 0.5)}%` }}
                                role="progressbar"
                                aria-valuenow={pct}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`${item.crimeCategory}: ${pct.toFixed(2)}%`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Responsible Interpretation Disclaimer */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-amber-950 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                    <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Responsible Interpretation Notice</span>
                  </div>
                  <ul className="space-y-1 text-amber-800/90 list-disc list-inside leading-relaxed text-[11px]">
                    <li>
                      <strong>Historical Model Classification:</strong> Output is a statistical classification
                      from historical district-wise crime data, not a guarantee or live report of future crime events.
                    </li>
                    <li>
                      <strong>Model Confidence Metric:</strong> Describes the Random Forest classifier&apos;s
                      decision leaf certainty, not the likelihood or probability of real-world crime occurring.
                    </li>
                    <li>
                      <strong>Non-Discriminatory Use:</strong> Must not be used as the sole basis for decisions
                      regarding individuals, communities, or policy enforcement.
                    </li>
                  </ul>
                </div>
              </>
            )}

            {/* FAILED Status Presentation */}
            {record.status === 'FAILED' && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-2 text-rose-900">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>Execution Failed</span>
                </div>
                <p className="text-rose-800 text-xs leading-relaxed">
                  This prediction request encountered an error during machine learning processing.
                </p>
                {record.errorCode && (
                  <div className="text-[11px] font-mono text-rose-700 bg-rose-100/70 p-2 rounded">
                    Error Code: {record.errorCode}
                    {record.errorMessage ? ` • ${record.errorMessage}` : ''}
                  </div>
                )}
              </div>
            )}

            {/* PENDING Status Presentation */}
            {record.status === 'PENDING' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-1 text-amber-900">
                <div className="flex items-center gap-2 font-semibold">
                  <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Analysis In-Flight</span>
                </div>
                <p className="text-amber-800 text-xs leading-relaxed">
                  This analysis is currently queued or in process. Check back shortly for updated results.
                </p>
              </div>
            )}

            {/* Metadata Timestamps Footer */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 gap-1">
              <span>Created: {formatDateTime(record.createdAt)}</span>
              <span>Last Updated: {formatDateTime(record.updatedAt)}</span>
            </div>
          </div>
        )}

        {/* Modal Action Footer */}
        <div className="border-t border-slate-100 pt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Close Inspection
          </Button>
        </div>
      </div>
    </div>
  );
}
