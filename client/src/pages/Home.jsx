import React from 'react';

export default function Home({ setActiveTab }) {
  return (
    <div>
      {/* Project Introduction */}
      <div className="panel">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1b4332', marginBottom: 14 }}>
          Air Quality Prediction
        </h2>

        <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 18 }}>
          Air pollution is a serious public health concern in urban India. This project uses supervised
          machine learning models — trained on actual historical CPCB air quality data — to predict the
          Air Quality Index (AQI) from atmospheric pollutant measurements.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setActiveTab('predict')}>
            Predict Air Quality →
          </button>
          <button className="btn btn-secondary" onClick={() => setActiveTab('historical')}>
            Historical Records
          </button>
          <button className="btn btn-secondary" onClick={() => setActiveTab('results')}>
            ML Results
          </button>
        </div>
      </div>

      {/* Problem Statement & Objectives side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 18 }}>
        <div className="panel" style={{ marginBottom: 0 }}>
          <h3 className="panel-title">Problem Statement</h3>
          <p style={{ fontSize: 13.5, color: '#4b5563', lineHeight: 1.65 }}>
            High concentrations of pollutants like PM2.5, PM10, NO₂, SO₂, CO and O₃ degrade air quality
            and cause respiratory illness. Traditional monitoring methods are slow. An ML-based system
            can estimate the Air Quality Index (AQI) instantly from sensor readings.
          </p>
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <h3 className="panel-title"> Objectives</h3>
          <div className="objective-grid" style={{ gridTemplateColumns: '1fr', margin: 0 }}>
            {[
              'Preprocess the CPCB dataset — handle missing values, duplicates, and feature engineering.',
              'Train multiple Regression models to predict continuous AQI values.',
              'Train Classification models to categorize air quality into CPCB buckets.',
              'Compare models using MAE, RMSE, R², Accuracy, Precision, Recall and F1-Score.',
              'Deploy the best models for real-time manual prediction.',
            ].map((text, i) => (
              <div key={i} className="objective-card">
                <div className="objective-card-num">Objective {i + 1}</div>
                <div className="objective-card-text">{text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CPCB AQI Scale */}
      <div className="panel">
        <h3 className="panel-title">CPCB Air Quality Index (AQI) Standard Scale</h3>
        <p className="panel-subtitle">Standard categories defined by the Central Pollution Control Board of India.</p>

        <div className="table-responsive">
          <table className="academic-table">
            <thead>
              <tr>
                <th>AQI Range</th>
                <th>Category</th>
                <th>Associated Health Impact</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['0 – 50', 'Good', 'cat-good', 'Minimal impact on health.'],
                ['51 – 100', 'Satisfactory', 'cat-satisfactory', 'Minor breathing discomfort to sensitive individuals.'],
                ['101 – 200', 'Moderate', 'cat-moderate', 'Breathing discomfort to people with lung disease, asthma, or heart conditions.'],
                ['201 – 300', 'Poor', 'cat-poor', 'Breathing discomfort to most people on prolonged exposure.'],
                ['301 – 400', 'Very Poor', 'cat-very-poor', 'Respiratory illness on prolonged exposure; significant effect on vulnerable groups.'],
                ['401 – 500+', 'Severe', 'cat-severe', 'Affects healthy people and seriously impacts those with existing conditions.'],
              ].map(([range, label, cls, impact]) => (
                <tr key={range}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{range}</td>
                  <td><span className={`category-badge ${cls}`}>{label}</span></td>
                  <td style={{ color: '#4b5563' }}>{impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
