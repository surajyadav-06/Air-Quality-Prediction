import React, { useState } from 'react';
import Home from './pages/Home';
import HistoricalData from './pages/HistoricalData';
import PredictAQI from './pages/PredictAQI';
import MLResults from './pages/MLResults';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  const tabs = [
    { id: 'home',       label: 'Home' },
    { id: 'historical', label: 'Historical Air Quality' },
    { id: 'predict',    label: 'AQI Prediction' },
    { id: 'results',    label: 'ML Results' },
  ];

  const renderActivePage = () => {
    switch (activeTab) {
      case 'home':       return <Home setActiveTab={setActiveTab} />;
      case 'historical': return <HistoricalData />;
      case 'predict':    return <PredictAQI setActiveTab={setActiveTab} />;
      case 'results':    return <MLResults />;
      default:           return <Home setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-icon">🌿</span>
            <div>
              <div className="project-title">Air Quality Prediction</div>
            </div>
          </div>

          <nav className="nav-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {renderActivePage()}
      </main>

      {/* Footer */}
      <footer className="footer">
        <div style={{ maxWidth: 1020, margin: '0 auto', padding: '0 20px' }}>
          Air Quality Prediction &amp; Analytics Platform
        </div>
      </footer>
    </div>
  );
}
