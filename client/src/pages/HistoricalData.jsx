import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

export default function HistoricalData() {
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState('Delhi');
  const [selectedDate, setSelectedDate] = useState('2020-03-15');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load cities on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/cities`)
      .then(res => res.json())
      .then(data => {
        if (data.cities && data.cities.length > 0) {
          setCities(data.cities);
          if (!selectedCity) {
            setSelectedCity(data.cities[0].city);
          }
        }
      })
      .catch(err => console.error(err));
  }, []);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (!selectedCity) return;

    setLoading(true);
    setError(null);
    setResult(null);

    let url = `${API_BASE_URL}/api/air-quality/check?city=${encodeURIComponent(selectedCity)}`;
    if (selectedDate) {
      url += `&date=${encodeURIComponent(selectedDate)}`;
    }

    fetch(url)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'No historical record found for the selected date.');
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
      case 'Good':         return 'cat-good';
      case 'Satisfactory': return 'cat-satisfactory';
      case 'Moderate':     return 'cat-moderate';
      case 'Poor':         return 'cat-poor';
      case 'Very Poor':    return 'cat-very-poor';
      case 'Severe':       return 'cat-severe';
      default:             return 'cat-moderate';
    }
  };

  const fmt = (val) =>
    val !== null && val !== undefined ? val : 'N/A';

  return (
    <div>
      {/* Search Form */}
      <div className="panel">
        <h2 className="panel-title">Historical Air Quality Lookup</h2>
        <p className="panel-subtitle">
          Query actual air quality observations from the CPCB dataset (2015–2020).
        </p>

        <form onSubmit={handleSearch}>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="form-group">
              <label className="form-label">Select City</label>
              <select
                className="form-control"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
              >
                {cities.map(c => (
                  <option key={c.city} value={c.city}>{c.city}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Select Date <span className="unit">(2015-01-01 to 2020-07-01)</span>
              </label>
              <input
                type="date"
                className="form-control"
                value={selectedDate}
                min="2015-01-01"
                max="2020-07-01"
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Searching Dataset...' : 'Find Historical Record'}
            </button>
          </div>
        </form>
      </div>

      {/* Error / Notice */}
      {error && (
        <div className="alert-box alert-warning">
          <strong>Notice:</strong> {error}
        </div>
      )}

      {/* Result */}
      {result && result.record && (
        <div className="panel">
          <div className="result-header">
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1b4332' }}>
                {result.record.city} — {result.record.date}
              </h3>
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                Source: CPCB Ambient Air Quality Dataset (city_day.csv)
              </p>
            </div>
            <span className={`category-badge ${getCategoryClass(result.record.aqi_bucket)}`}>
              {result.record.aqi_bucket}
            </span>
          </div>

          {/* AQI Summary */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '12px 0 16px' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>Recorded AQI:</span>
            <span className="aqi-number">{Math.round(result.record.aqi)}</span>
          </div>

          {/* Pollutants Table */}
          <div className="table-responsive">
            <table className="academic-table">
              <thead>
                <tr>
                  <th>Pollutant</th>
                  <th>Full Name</th>
                  <th>Recorded Value</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'pm25', label: 'PM2.5',  name: 'Fine Particulate Matter (≤ 2.5 µm)', unit: 'µg/m³' },
                  { key: 'pm10', label: 'PM10',   name: 'Coarse Particulate Matter (≤ 10 µm)', unit: 'µg/m³' },
                  { key: 'no2',  label: 'NO₂',    name: 'Nitrogen Dioxide',                    unit: 'µg/m³' },
                  { key: 'so2',  label: 'SO₂',    name: 'Sulfur Dioxide',                      unit: 'µg/m³' },
                  { key: 'co',   label: 'CO',     name: 'Carbon Monoxide',                     unit: 'mg/m³' },
                  { key: 'o3',   label: 'O₃',     name: 'Ground-level Ozone',                  unit: 'µg/m³' },
                ].map(({ key, label, name, unit }) => (
                  <tr key={key}>
                    <td><strong>{label}</strong></td>
                    <td style={{ color: '#6b7280' }}>{name}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {fmt(result.record[key])}
                    </td>
                    <td style={{ color: '#9ca3af' }}>{unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Health Advisory */}
          {result.health && (
            <div className="alert-box alert-info" style={{ marginTop: 14 }}>
              <strong>Health Advisory:</strong> {result.health.advisory}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
