import React, { useState, useEffect } from 'react';

export default function MLResults() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedModelForCm, setSelectedModelForCm] = useState('Random Forest Classifier');

  useEffect(() => {
    fetch('/api/models/performance')
      .then(res => {
        if (!res.ok) throw new Error('Could not load ML results.');
        return res.json();
      })
      .then(data => {
        setReport(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280' }}>
        Loading ML experiment results...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="alert-box alert-danger">
        {error || 'No results available. Please run the training script first.'}
      </div>
    );
  }

  const {
    dataset_info,
    regression_comparison,
    best_regression_model,
    classification_comparison,
    best_classification_model,
    confusion_matrices,
    bucket_labels
  } = report;

  const maxR2  = Math.max(...regression_comparison.map(m => m.r2_score), 1.0);
  const maxAcc = Math.max(...classification_comparison.map(m => m.accuracy), 1.0);
  const cmData = confusion_matrices ? confusion_matrices[selectedModelForCm] : null;

  return (
    <div>
      {/* Section 0: Experiment Overview */}
      <div className="panel">
        <h2 className="panel-title">Machine Learning Experiment Results</h2>
        <p className="panel-subtitle">
          Actual metrics computed on the CPCB dataset using an 80/20 train/test split.
        </p>

        <div className="table-responsive">
          <table className="academic-table">
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, width: '32%' }}>Dataset Source</td>
                <td>{dataset_info.source}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Total Records (cleaned)</td>
                <td>{dataset_info.total_cleaned_rows?.toLocaleString()} daily observations — 26 Indian cities</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Train / Test Split</td>
                <td>
                  80% Training ({dataset_info.train_rows?.toLocaleString()} rows) &nbsp;/&nbsp;
                  20% Testing ({dataset_info.test_rows?.toLocaleString()} rows)
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Input Features Used</td>
                <td>PM2.5, PM10, NO2, SO2, CO, O3</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Regression Target</td>
                <td>Numerical AQI (continuous value)</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Classification Target</td>
                <td>AQI_Bucket (Good / Satisfactory / Moderate / Poor / Very Poor / Severe)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 1: Algorithms Used */}
      <div className="panel">
        <h3 className="panel-title">Algorithms Used</h3>

        <div className="algo-grid">
          <div className="algo-card">
            <div className="algo-card-title">Regression Models</div>
            <ul>
              <li>Linear Regression</li>
              <li>Ridge Regression</li>
              <li>Decision Tree Regressor</li>
              <li>Random Forest Regressor</li>
              <li>Gradient Boosting Regressor</li>
            </ul>
          </div>
          <div className="algo-card">
            <div className="algo-card-title">Classification Models</div>
            <ul>
              <li>Logistic Regression</li>
              <li>Decision Tree Classifier</li>
              <li>Random Forest Classifier</li>
              <li>Gradient Boosting Classifier</li>
            </ul>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          <div className="best-model-banner">
            ★ Best Regression: {best_regression_model.model_name}
            &nbsp;(R² = {best_regression_model.r2_score})
          </div>
          <div className="best-model-banner">
            ★ Best Classification: {best_classification_model.model_name}
            &nbsp;(Accuracy = {(best_classification_model.accuracy * 100).toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Section 2: Regression Comparison */}
      <div className="panel">
        <h3 className="panel-title">1. Regression Models — Comparison</h3>
        <p className="panel-subtitle">
          Target: Numerical AQI value. Metrics: MAE, MSE, RMSE, R² Score.
        </p>

        <div className="table-responsive">
          <table className="academic-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Model</th>
                <th>MAE</th>
                <th>MSE</th>
                <th>RMSE</th>
                <th>R² Score</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {regression_comparison.map((m, idx) => {
                const isBest = m.model_name === best_regression_model.model_name;
                return (
                  <tr key={idx} className={isBest ? 'highlight' : ''}>
                    <td style={{ color: '#9ca3af', fontFamily: 'monospace' }}>{idx + 1}</td>
                    <td><strong>{m.model_name}</strong></td>
                    <td>{m.mae}</td>
                    <td>{m.mse}</td>
                    <td>{m.rmse}</td>
                    <td><strong>{m.r2_score}</strong></td>
                    <td style={{ color: isBest ? '#15803d' : '#6b7280' }}>
                      {isBest ? '★ Best Selected' : 'Baseline'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* R² Bar Chart */}
        <div style={{ marginTop: 16 }}>
          <div className="section-label">R² Score Comparison (Higher is Better)</div>
          {regression_comparison.map((m, idx) => {
            const pct = (m.r2_score / maxR2) * 100;
            const isBest = m.model_name === best_regression_model.model_name;
            return (
              <div key={idx} className="bar-row">
                <span style={{ fontWeight: isBest ? 700 : 400, color: isBest ? '#1b4332' : '#374151' }}>
                  {m.model_name}
                </span>
                <div className="bar-track">
                  <div className={`bar-fill ${isBest ? 'best' : 'other'}`} style={{ width: `${pct}%` }} />
                </div>
                <span style={{ fontFamily: 'monospace', fontWeight: isBest ? 700 : 400 }}>{m.r2_score}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Classification Comparison */}
      <div className="panel">
        <h3 className="panel-title">2. Classification Models — Comparison</h3>
        <p className="panel-subtitle">
          Target: AQI_Bucket (6 categories). Metrics: Accuracy, Precision, Recall, F1-Score.
        </p>

        <div className="table-responsive">
          <table className="academic-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Model</th>
                <th>Accuracy</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1-Score</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {classification_comparison.map((m, idx) => {
                const isBest = m.model_name === best_classification_model.model_name;
                return (
                  <tr key={idx} className={isBest ? 'highlight' : ''}>
                    <td style={{ color: '#9ca3af', fontFamily: 'monospace' }}>{idx + 1}</td>
                    <td><strong>{m.model_name}</strong></td>
                    <td><strong>{(m.accuracy * 100).toFixed(2)}%</strong></td>
                    <td>{(m.precision * 100).toFixed(2)}%</td>
                    <td>{(m.recall * 100).toFixed(2)}%</td>
                    <td><strong>{(m.f1_score * 100).toFixed(2)}%</strong></td>
                    <td style={{ color: isBest ? '#15803d' : '#6b7280' }}>
                      {isBest ? '★ Best Selected' : 'Baseline'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Accuracy Bar Chart */}
        <div style={{ marginTop: 16 }}>
          <div className="section-label">Accuracy Comparison (Higher is Better)</div>
          {classification_comparison.map((m, idx) => {
            const pct = (m.accuracy / maxAcc) * 100;
            const isBest = m.model_name === best_classification_model.model_name;
            return (
              <div key={idx} className="bar-row">
                <span style={{ fontWeight: isBest ? 700 : 400, color: isBest ? '#1b4332' : '#374151' }}>
                  {m.model_name}
                </span>
                <div className="bar-track">
                  <div className={`bar-fill ${isBest ? 'best' : 'other'}`} style={{ width: `${pct}%` }} />
                </div>
                <span style={{ fontFamily: 'monospace', fontWeight: isBest ? 700 : 400 }}>
                  {(m.accuracy * 100).toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 4: Confusion Matrix */}
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid #e7f3e8', paddingBottom: 9, marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1b4332', margin: 0 }}>
            3. Confusion Matrix
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Select Classifier:</span>
            <select
              className="form-control"
              style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
              value={selectedModelForCm}
              onChange={(e) => setSelectedModelForCm(e.target.value)}
            >
              {Object.keys(confusion_matrices || {}).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="panel-subtitle">
          Rows = actual class labels. Columns = predicted labels. Diagonal cells (green) = correct predictions.
        </p>

        {cmData && (
          <div className="table-responsive">
            <table className="cm-grid">
              <thead>
                <tr>
                  <th style={{ background: '#e2e8f0', textAlign: 'left', padding: '6px 8px' }}>Actual \ Predicted</th>
                  {(cmData.labels || bucket_labels).map((lbl, idx) => (
                    <th key={idx}>{lbl}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(cmData.labels || bucket_labels).map((actualLbl, rowIdx) => (
                  <tr key={rowIdx}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', background: '#f8fafc' }}>{actualLbl}</th>
                    {(cmData.labels || bucket_labels).map((_, colIdx) => {
                      const count = cmData.matrix[rowIdx] ? cmData.matrix[rowIdx][colIdx] : 0;
                      const isDiag = rowIdx === colIdx;
                      return (
                        <td key={colIdx} className={isDiag ? 'cm-diag' : ''}>
                          {count}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
