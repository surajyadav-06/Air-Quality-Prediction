import React from 'react';

export default function About() {
  return (
    <div>
      <div className="panel">
        <h2 className="panel-title">About This Project</h2>

        <div className="info-row">
          <span className="info-key">Project Title</span>
          <span className="info-val">Air Quality Prediction Using Machine Learning</span>
        </div>
        <div className="info-row">
          <span className="info-key">Experiment</span>
          <span className="info-val">ML Experiment 10 — Supervised Learning (Regression &amp; Classification)</span>
        </div>
        <div className="info-row">
          <span className="info-key">Course</span>
          <span className="info-val">B.Tech — Machine Learning Lab</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 18 }}>
        {/* Problem */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <h3 className="panel-title">Problem</h3>
          <p style={{ fontSize: 13.5, color: '#4b5563', lineHeight: 1.65 }}>
            Air pollution in Indian cities is a significant public health hazard. High concentrations of
            pollutants such as PM2.5, PM10, NO₂, SO₂, CO and O₃ cause respiratory and cardiovascular
            diseases. Manual and delayed monitoring systems cannot provide timely AQI estimates, making
            automated, data-driven prediction essential.
          </p>
        </div>

        {/* Objective */}
        <div className="panel" style={{ marginBottom: 0 }}>
          <h3 className="panel-title">Objective</h3>
          <p style={{ fontSize: 13.5, color: '#4b5563', lineHeight: 1.65 }}>
            To build a machine learning system that can: (1) predict a numerical AQI value from six key
            pollutant readings using regression, and (2) classify the air quality into a standard CPCB
            category using multi-class classification. The system compares multiple algorithms and selects
            the best-performing model based on evaluation metrics.
          </p>
        </div>
      </div>

      {/* Dataset */}
      <div className="panel">
        <h3 className="panel-title">Dataset</h3>
        <div className="table-responsive">
          <table className="academic-table">
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, width: '28%' }}>Name</td>
                <td>city_day.csv — CPCB Daily Air Quality Data</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Source</td>
                <td>Central Pollution Control Board (CPCB), India</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Size</td>
                <td>29,531 records, 26 major Indian cities</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Date Range</td>
                <td>January 2015 – July 2020</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Key Columns</td>
                <td>City, Date, PM2.5, PM10, NO2, SO2, CO, O3, AQI, AQI_Bucket</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Preprocessing Applied</td>
                <td>
                  Removed duplicates, filled missing values (city-wise forward-fill + median imputation),
                  extracted temporal features (Year, Month, DayOfWeek), encoded categorical columns.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* What the Application Does */}
      <div className="panel">
        <h3 className="panel-title">What This Application Does</h3>
        <ul style={{ fontSize: 13.5, color: '#4b5563', paddingLeft: 20, lineHeight: 1.8 }}>
          <li>
            <strong>Historical Air Quality Lookup</strong> — Find actual recorded AQI and pollutant
            values for any city and date available in the dataset.
          </li>
          <li>
            <strong>Manual AQI Prediction</strong> — Enter your own pollutant readings (PM2.5, PM10,
            NO2, SO2, CO, O3) and get an instant AQI prediction from the trained ML models.
          </li>
          <li>
            <strong>ML Experiment Results</strong> — View the actual evaluation metrics for all
            trained regression and classification models, with the best model highlighted.
          </li>
        </ul>
      </div>

      {/* Methodology Note */}
      <div className="panel">
        <h3 className="panel-title">Methodology Summary</h3>
        <ol style={{ fontSize: 13.5, color: '#4b5563', paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Load and inspect the raw dataset (city_day.csv).</li>
          <li>Remove duplicate records and handle missing values.</li>
          <li>Engineer temporal features from the Date column.</li>
          <li>Split data: 80% training / 20% testing.</li>
          <li>Standardize features for scale-sensitive models (Linear, Ridge, Logistic).</li>
          <li>Train 5 regression models and 4 classification models.</li>
          <li>Evaluate all models using standard performance metrics.</li>
          <li>Select and save the best models using Joblib.</li>
          <li>Serve predictions through a REST API (Node.js + Python subprocess).</li>
        </ol>
      </div>
    </div>
  );
}
