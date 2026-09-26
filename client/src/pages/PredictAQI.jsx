import React, { useState } from 'react';

export default function PredictAQI({ setActiveTab }) {
  const [inputs, setInputs] = useState({
    pm25: 55,
    pm10: 95,
    no2: 24,
    so2: 12,
    co: 1.0,
    o3: 30
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setInputs(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs)
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to generate prediction.');
        }
        return data;
      })
      .then(data => {
        setResult(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  const getCategoryClass = (bucket) => {
    switch (bucket) {
      case 'Good':        return 'cat-good';
      case 'Satisfactory':return 'cat-satisfactory';
      case 'Moderate':    return 'cat-moderate';
      case 'Poor':        return 'cat-poor';
      case 'Very Poor':   return 'cat-very-poor';
      case 'Severe':      return 'cat-severe';
      default:            return 'cat-moderate';
    }
  };

  return (
    <div>
      {/* Option A: Use Historical Data */}
      <div className="panel" style={{ borderLeft: '3px solid #2e7d32' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1b4332', marginBottom: 5 }}>
          Want to check air quality without entering pollutant values?
        </h3>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
          Check the historical air quality for a city and date using the available dataset.
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setActiveTab && setActiveTab('historical')}
        >
          Check Historical Air Quality →
        </button>
      </div>

      {/* Option B: Manual Prediction */}
      <div className="panel">
        <h2 className="panel-title">Manual AQI Prediction</h2>
        <p className="panel-subtitle">
          Enter pollutant measurements if you already have them.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            {[
              { name: 'pm25', label: 'PM2.5', unit: 'µg/m³' },
              { name: 'pm10', label: 'PM10',  unit: 'µg/m³' },
              { name: 'no2',  label: 'NO2',   unit: 'µg/m³' },
              { name: 'so2',  label: 'SO2',   unit: 'µg/m³' },
              { name: 'co',   label: 'CO',    unit: 'mg/m³' },
              { name: 'o3',   label: 'O3',    unit: 'µg/m³' },
            ].map(({ name, label, unit }) => (
              <div key={name} className="form-group">
                <label className="form-label">
                  {label} <span className="unit">({unit})</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="form-control"
                  name={name}
                  value={inputs[name]}
                  onChange={handleChange}
                  required
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Running ML Models...' : 'Predict AQI'}
            </button>
          </div>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="alert-box alert-danger">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Prediction Result */}
      {result && (
        <div className="panel">
          <div className="result-header">
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1b4332' }}>Prediction Output</h3>
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                Generated using saved Scikit-Learn Regression and Classification models.
              </p>
            </div>
            <span className={`category-badge ${getCategoryClass(result.predicted_bucket)}`}>
              {result.predicted_bucket}
            </span>
          </div>

          <div className="table-responsive" style={{ marginTop: 10 }}>
            <table className="academic-table">
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600, width: '40%' }}>Predicted Numerical AQI</td>
                  <td>
                    <span className="aqi-number">{result.predicted_aqi}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>
                      Model: <strong>{result.best_regression_model}</strong>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Predicted AQI Category</td>
                  <td>
                    <span className={`category-badge ${getCategoryClass(result.predicted_bucket)}`}>
                      {result.predicted_bucket}
                    </span>
                    <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>
                      Model: <strong>{result.best_classification_model}</strong>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Health Interpretation</td>
                  <td style={{ color: '#374151' }}>{result.health_advisory}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Recommended Action</td>
                  <td style={{ color: '#374151' }}>{result.recommendation}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
