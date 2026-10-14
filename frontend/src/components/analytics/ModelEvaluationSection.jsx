import {
  ShieldCheck,
  Cpu,
  Target,
  Database,
  Calendar,
  AlertTriangle,
  Info,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Card, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';

export function ModelEvaluationSection({
  evalData,
  isLoading,
  error,
  onRetry,
}) {
  if (isLoading) {
    return (
      <Card className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center border-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600 mb-3" />
        <h3 className="text-sm font-semibold text-slate-800">Retrieving Model Evaluation Metrics</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Fetching validated classification test scores, confusion matrix, and performance metrics...
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
        <h3 className="text-base font-semibold text-slate-900">Evaluation Metrics Unavailable</h3>
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

  if (!evalData) return null;

  const classes = evalData.classes || [];
  const classReport = evalData.class_report || {};
  const confusionMatrix = evalData.confusion_matrix || [];
  const accuracyPct = (evalData.test_accuracy * 100).toFixed(2);

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 bg-white p-6 shadow-sm">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">Random Forest Classifier Evaluation & Diagnostics</CardTitle>
            </div>
            <CardDescription className="mt-1 text-xs">
              Empirical verification results evaluated against held-out historical classification test data.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200 shadow-2xs">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Held-Out Accuracy: {accuracyPct}%</span>
            </span>
          </div>
        </div>

        {/* Specifications & Partition Overview Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <Cpu className="h-3.5 w-3.5 text-brand-600" />
              Model Architecture
            </span>
            <span className="mt-1 block text-base font-bold text-slate-900">
              Random Forest
            </span>
            <span className="text-[10px] text-slate-500">
              {evalData.n_estimators} Estimators • 6 Classes
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <Calendar className="h-3.5 w-3.5 text-brand-600" />
              Dataset Partition
            </span>
            <span className="mt-1 block text-base font-bold text-slate-900">
              {evalData.train_years?.[0]}–{evalData.train_years?.[evalData.train_years.length - 1]} vs {evalData.test_years?.[0]}–{evalData.test_years?.[evalData.test_years.length - 1]}
            </span>
            <span className="text-[10px] text-slate-500">
              Train years vs Test evaluation years
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <Database className="h-3.5 w-3.5 text-brand-600" />
              Sample Volume
            </span>
            <span className="mt-1 block text-base font-bold text-slate-900">
              {evalData.train_samples?.toLocaleString()} / {evalData.test_samples?.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500">
              Training samples / Test samples
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <Target className="h-3.5 w-3.5 text-brand-600" />
              Overall Test Accuracy
            </span>
            <span className="mt-1 block text-base font-bold text-emerald-700">
              {accuracyPct}%
            </span>
            <span className="text-[10px] text-slate-500">
              Exact class match across test set
            </span>
          </div>
        </div>

        {/* Per-Class Classification Report Table */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Per-Class Classification Metrics (Held-Out Test Set)
            </h4>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Target Crime Class</th>
                  <th className="py-2.5 px-3 text-right">Precision</th>
                  <th className="py-2.5 px-3 text-right">Recall</th>
                  <th className="py-2.5 px-3 text-right">F1-Score</th>
                  <th className="py-2.5 px-3 text-right">Support (Samples)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {classes.map((cls) => {
                  const metrics = classReport[cls] || {};
                  return (
                    <tr key={cls} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{cls}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {metrics.precision !== undefined ? metrics.precision.toFixed(4) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {metrics.recall !== undefined ? metrics.recall.toFixed(4) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-brand-800">
                        {metrics['f1-score'] !== undefined ? metrics['f1-score'].toFixed(4) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        {metrics.support !== undefined ? metrics.support.toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })}

                {/* Macro Avg Row */}
                {classReport['macro avg'] && (
                  <tr className="bg-slate-50/80 font-medium">
                    <td className="py-2 px-3 text-slate-700 font-semibold">Macro Average</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      {classReport['macro avg'].precision?.toFixed(4)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      {classReport['macro avg'].recall?.toFixed(4)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      {classReport['macro avg']['f1-score']?.toFixed(4)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600">
                      {classReport['macro avg'].support?.toLocaleString()}
                    </td>
                  </tr>
                )}

                {/* Weighted Avg Row */}
                {classReport['weighted avg'] && (
                  <tr className="bg-slate-50/80 font-medium">
                    <td className="py-2 px-3 text-slate-700 font-semibold">Weighted Average</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      {classReport['weighted avg'].precision?.toFixed(4)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      {classReport['weighted avg'].recall?.toFixed(4)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">
                      {classReport['weighted avg']['f1-score']?.toFixed(4)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600">
                      {classReport['weighted avg'].support?.toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confusion Matrix Heatmap Table */}
        {confusionMatrix.length > 0 && (
          <div className="space-y-3 mb-6">
            <div>
              <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                Confusion Matrix (True vs Predicted Class)
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Rows represent true ground-truth categories; columns represent predicted categories. Diagonal cells indicate accurate classifications.
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 bg-slate-200 whitespace-nowrap">TRUE \ PREDICTED</th>
                    {classes.map((cls) => (
                      <th key={cls} className="py-2.5 px-3 text-right whitespace-nowrap text-[11px]">
                        {cls}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {confusionMatrix.map((row, rowIdx) => {
                    const rowLabel = classes[rowIdx] || `Class ${rowIdx}`;
                    return (
                      <tr key={rowLabel} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 font-semibold text-slate-800 bg-slate-50/80 whitespace-nowrap text-[11px]">
                          {rowLabel}
                        </td>
                        {row.map((val, colIdx) => {
                          const isDiagonal = rowIdx === colIdx;
                          return (
                            <td
                              key={colIdx}
                              className={`py-2 px-3 text-right font-mono text-xs ${
                                isDiagonal
                                  ? 'bg-emerald-50/80 font-bold text-emerald-900 border border-emerald-100'
                                  : val > 0
                                  ? 'text-slate-700'
                                  : 'text-slate-300'
                              }`}
                            >
                              {val.toLocaleString()}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Feature Importance Note (Explains why uncalculated or verified) */}
        {evalData.feature_importances_note && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 mb-6 text-xs text-slate-600 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800">Feature Importance Diagnostic Note: </span>
              <span className="text-slate-600">{evalData.feature_importances_note}</span>
            </div>
          </div>
        )}

        {/* Mandatory Responsible Use & Disclaimers */}
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-950 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>Ethical Interpretation & Model Usage Advisory</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-700 leading-relaxed">
            <li>
              <strong>Relative Classification, Not Real-World Certainty:</strong> This model predicts the dominant category strictly among its 6 trained crime classes. It does not forecast future crime certainty or guarantee live incident outcomes.
            </li>
            <li>
              <strong>Confidence Interpretation:</strong> Classification confidence percentages reflect decision-leaf agreement across the 300 decision trees for a feature vector, not the real-world probability of crime occurrence.
            </li>
            <li>
              <strong>Evaluation Metric vs Safety:</strong> Test accuracy (82.73%) is a historical validation metric on archival district data, not a direct index of community safety or enforcement performance.
            </li>
            <li>
              <strong>Non-Discriminatory Research Application:</strong> Predictions are engineered exclusively for academic research, spatial trend study, and pattern evaluation. They must never be applied for demographic profiling or punitive automated decision-making.
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
