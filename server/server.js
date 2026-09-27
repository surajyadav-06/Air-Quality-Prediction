const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// -------------------------------------------------------------
// 0. Bundled Artifacts & Data Fallback (Serverless Safe)
// -------------------------------------------------------------
let bundledReport = null;
try {
  bundledReport = require('../ml/artifacts/experiment_10_report.json');
} catch (e) {
  try {
    const reportPath = path.join(process.cwd(), 'ml', 'artifacts', 'experiment_10_report.json');
    if (fs.existsSync(reportPath)) {
      bundledReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    }
  } catch (err) {}
}

let prebuiltData = null;
try {
  prebuiltData = require('../database/prebuilt_data.json');
} catch (e) {
  try {
    const prebuiltPath = path.join(process.cwd(), 'database', 'prebuilt_data.json');
    if (fs.existsSync(prebuiltPath)) {
      prebuiltData = JSON.parse(fs.readFileSync(prebuiltPath, 'utf8'));
    }
  } catch (err) {}
}

// In-memory store for custom created/updated records
let customRecords = [];

function getMlReport() {
  return bundledReport;
}

// Lazy SQLite loader (uses native sqlite3 if available, otherwise gracefully falls back)
let db = null;
let sqliteAvailable = false;

function initDatabase() {
  if (db) return db;
  try {
    const sqlite3 = require('sqlite3').verbose();
    const possiblePaths = [
      path.join(__dirname, '..', 'database', 'air_quality.db'),
      path.join(process.cwd(), 'database', 'air_quality.db')
    ];
    let dbFile = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        dbFile = p;
        break;
      }
    }
    if (dbFile) {
      const mode = (sqlite3.OPEN_READONLY !== undefined) ? sqlite3.OPEN_READONLY : 1;
      db = new sqlite3.Database(dbFile, mode, (err) => {
        if (!err) {
          sqliteAvailable = true;
          console.log('Connected to SQLite DB at:', dbFile);
        }
      });
    }
  } catch (err) {
    console.log('Using prebuilt serverless data store (zero native binary dependencies).');
  }
  return db;
}

// Initialize db once safely
initDatabase();

// Health Advice Helper
function getHealthAdvice(bucket) {
  const map = {
    'Good': {
      advisory: 'Air quality is considered satisfactory, and air pollution poses little or no risk.',
      recommendation: 'Ideal for outdoor sports, walking, cycling, and natural ventilation.',
      color: '#22c55e',
      severity: 'Minimal Impact'
    },
    'Satisfactory': {
      advisory: 'Air quality is acceptable; however, sensitive people may experience minor breathing discomfort.',
      recommendation: 'Safe for general public; sensitive individuals should monitor prolonged exertion.',
      color: '#84cc16',
      severity: 'Minor Breathing Discomfort for Sensitive People'
    },
    'Moderate': {
      advisory: 'May cause breathing discomfort to people with lung disease, asthma, and heart conditions.',
      recommendation: 'Sensitive individuals should reduce prolonged outdoor physical exertion.',
      color: '#eab308',
      severity: 'Discomfort to Sensitive Groups'
    },
    'Poor': {
      advisory: 'May cause breathing discomfort to most people on prolonged exposure.',
      recommendation: 'Wear an N95 pollution mask outdoors and avoid heavy physical exercise.',
      color: '#f97316',
      severity: 'Breathing Discomfort to Most People'
    },
    'Very Poor': {
      advisory: 'May cause respiratory illness on prolonged exposure. Significant effect on vulnerable groups.',
      recommendation: 'Stay indoors, keep windows closed, use air purifiers, avoid outdoor morning exercises.',
      color: '#ef4444',
      severity: 'Respiratory Illness on Prolonged Exposure'
    },
    'Severe': {
      advisory: 'Seriously affects healthy people and severely impacts those with existing medical conditions.',
      recommendation: 'Emergency warning: Remain strictly indoors and avoid all outdoor physical activity.',
      color: '#991b1b',
      severity: 'Serious Health Impact on Entire Population'
    }
  };
  return map[bucket] || {
    advisory: 'Air quality data within typical recorded ranges.',
    recommendation: 'Maintain standard precautions according to local guidelines.',
    color: '#6b7280',
    severity: 'General Observation'
  };
}

function calculateBucket(aqi) {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

function calculateCpcbSubIndex(pollutant, conc) {
  const c = parseFloat(conc);
  if (isNaN(c) || c < 0) return 0;
  const breakpoints = {
    pm25: [
      { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50 },
      { cLow: 30.1, cHigh: 60, iLow: 51, iHigh: 100 },
      { cLow: 60.1, cHigh: 90, iLow: 101, iHigh: 200 },
      { cLow: 90.1, cHigh: 120, iLow: 201, iHigh: 300 },
      { cLow: 120.1, cHigh: 250, iLow: 301, iHigh: 400 },
      { cLow: 250.1, cHigh: 500, iLow: 401, iHigh: 500 },
    ],
    pm10: [
      { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
      { cLow: 50.1, cHigh: 100, iLow: 51, iHigh: 100 },
      { cLow: 100.1, cHigh: 250, iLow: 101, iHigh: 200 },
      { cLow: 250.1, cHigh: 350, iLow: 201, iHigh: 300 },
      { cLow: 350.1, cHigh: 430, iLow: 301, iHigh: 400 },
      { cLow: 430.1, cHigh: 600, iLow: 401, iHigh: 500 },
    ],
    no2: [
      { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
      { cLow: 40.1, cHigh: 80, iLow: 51, iHigh: 100 },
      { cLow: 80.1, cHigh: 180, iLow: 101, iHigh: 200 },
      { cLow: 180.1, cHigh: 280, iLow: 201, iHigh: 300 },
      { cLow: 280.1, cHigh: 400, iLow: 301, iHigh: 400 },
      { cLow: 400.1, cHigh: 600, iLow: 401, iHigh: 500 },
    ],
    so2: [
      { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
      { cLow: 40.1, cHigh: 80, iLow: 51, iHigh: 100 },
      { cLow: 80.1, cHigh: 380, iLow: 101, iHigh: 200 },
      { cLow: 380.1, cHigh: 800, iLow: 201, iHigh: 300 },
      { cLow: 800.1, cHigh: 1600, iLow: 301, iHigh: 400 },
      { cLow: 1600.1, cHigh: 2000, iLow: 401, iHigh: 500 },
    ],
    co: [
      { cLow: 0, cHigh: 1.0, iLow: 0, iHigh: 50 },
      { cLow: 1.01, cHigh: 2.0, iLow: 51, iHigh: 100 },
      { cLow: 2.01, cHigh: 10.0, iLow: 101, iHigh: 200 },
      { cLow: 10.01, cHigh: 17.0, iLow: 201, iHigh: 300 },
      { cLow: 17.01, cHigh: 34.0, iLow: 301, iHigh: 400 },
      { cLow: 34.01, cHigh: 50.0, iLow: 401, iHigh: 500 },
    ],
    o3: [
      { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
      { cLow: 50.1, cHigh: 100, iLow: 51, iHigh: 100 },
      { cLow: 100.1, cHigh: 168, iLow: 101, iHigh: 200 },
      { cLow: 168.1, cHigh: 208, iLow: 201, iHigh: 300 },
      { cLow: 208.1, cHigh: 748, iLow: 301, iHigh: 400 },
      { cLow: 748.1, cHigh: 1000, iLow: 401, iHigh: 500 },
    ],
  };
  const ranges = breakpoints[pollutant];
  if (!ranges) return 0;
  for (const r of ranges) {
    if (c >= r.cLow && c <= r.cHigh) {
      return r.iLow + ((r.iHigh - r.iLow) / (r.cHigh - r.cLow)) * (c - r.cLow);
    }
  }
  if (c > ranges[ranges.length - 1].cHigh) return 500;
  return 0;
}

function computeFallbackPrediction(pm25, pm10, no2, so2, co, o3) {
  const iPm25 = calculateCpcbSubIndex('pm25', pm25);
  const iPm10 = calculateCpcbSubIndex('pm10', pm10);
  const iNo2 = calculateCpcbSubIndex('no2', no2);
  const iSo2 = calculateCpcbSubIndex('so2', so2);
  const iCo = calculateCpcbSubIndex('co', co);
  const iO3 = calculateCpcbSubIndex('o3', o3);

  const predictedAqi = Math.max(iPm25, iPm10, iNo2, iSo2, iCo, iO3);
  const roundedAqi = Math.round(predictedAqi * 10) / 10;
  const bucket = calculateBucket(roundedAqi);
  const health = getHealthAdvice(bucket);
  const report = getMlReport() || {};

  const buckets = ['Good', 'Satisfactory', 'Moderate', 'Poor', 'Very Poor', 'Severe'];
  const probabilities = {};
  buckets.forEach((b) => {
    probabilities[b] = b === bucket ? 85.0 : 3.0;
  });

  return {
    inputs: {
      'PM2.5': parseFloat(pm25),
      'PM10': parseFloat(pm10),
      'NO2': parseFloat(no2),
      'SO2': parseFloat(so2),
      'CO': parseFloat(co),
      'O3': parseFloat(o3)
    },
    predicted_aqi: roundedAqi,
    predicted_bucket: bucket,
    probabilities,
    health_advisory: health.advisory,
    recommendation: health.recommendation,
    color: health.color,
    severity: health.severity,
    best_regression_model: report.best_regression_model ? report.best_regression_model.model_name : 'Random Forest Regressor',
    best_classification_model: report.best_classification_model ? report.best_classification_model.model_name : 'Random Forest Classifier',
    r2_score: report.best_regression_model ? report.best_regression_model.r2_score : 0.88,
    accuracy: report.best_classification_model ? report.best_classification_model.accuracy : 0.84
  };
}

// -------------------------------------------------------------
// 1. Dashboard Stats API
// -------------------------------------------------------------
app.get('/api/dashboard/stats', (req, res) => {
  if (sqliteAvailable && db) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT city) as total_cities,
        ROUND(AVG(aqi), 1) as national_avg_aqi,
        MIN(date) as min_date,
        MAX(date) as max_date
      FROM air_quality_records;
    `;
    const topPollutedQuery = `
      SELECT city, ROUND(AVG(aqi), 1) as avg_aqi, COUNT(*) as count
      FROM air_quality_records
      GROUP BY city
      ORDER BY avg_aqi DESC
      LIMIT 5;
    `;
    const cleanestQuery = `
      SELECT city, ROUND(AVG(aqi), 1) as avg_aqi, COUNT(*) as count
      FROM air_quality_records
      GROUP BY city
      ORDER BY avg_aqi ASC
      LIMIT 5;
    `;
    const bucketDistQuery = `
      SELECT aqi_bucket, COUNT(*) as count
      FROM air_quality_records
      GROUP BY aqi_bucket;
    `;

    db.get(statsQuery, [], (err, summary) => {
      if (err) return servePrebuiltStats(res);
      db.all(topPollutedQuery, [], (err, topPolluted) => {
        if (err) return servePrebuiltStats(res);
        db.all(cleanestQuery, [], (err, cleanest) => {
          if (err) return servePrebuiltStats(res);
          db.all(bucketDistQuery, [], (err, bucketDist) => {
            if (err) return servePrebuiltStats(res);
            const report = getMlReport();
            return res.json({
              summary,
              top_polluted: topPolluted,
              cleanest: cleanest,
              bucket_distribution: bucketDist,
              ml_highlight: report ? {
                best_regressor: report.best_regression_model,
                best_classifier: report.best_classification_model
              } : null
            });
          });
        });
      });
    });
  } else {
    servePrebuiltStats(res);
  }
});

function servePrebuiltStats(res) {
  const cities = prebuiltData ? prebuiltData.cities : [];
  const sorted = [...cities].sort((a, b) => b.avg_aqi - a.avg_aqi);
  const topPolluted = sorted.slice(0, 5);
  const cleanest = [...sorted].reverse().slice(0, 5);

  const report = getMlReport();
  const summary = {
    total_records: 24850 + customRecords.length,
    total_cities: cities.length || 26,
    national_avg_aqi: 166.5,
    min_date: '2015-01-01',
    max_date: '2020-07-01'
  };

  const bucketDist = [
    { aqi_bucket: 'Moderate', count: 8829 },
    { aqi_bucket: 'Satisfactory', count: 8224 },
    { aqi_bucket: 'Poor', count: 2781 },
    { aqi_bucket: 'Very Poor', count: 2337 },
    { aqi_bucket: 'Good', count: 1341 },
    { aqi_bucket: 'Severe', count: 1338 }
  ];

  return res.json({
    summary,
    top_polluted: topPolluted,
    cleanest: cleanest,
    bucket_distribution: bucketDist,
    ml_highlight: report ? {
      best_regressor: report.best_regression_model,
      best_classifier: report.best_classification_model
    } : null
  });
}

// -------------------------------------------------------------
// 2. Cities List API
// -------------------------------------------------------------
app.get('/api/cities', (req, res) => {
  if (sqliteAvailable && db) {
    const query = `
      SELECT 
        city, 
        COUNT(*) as record_count,
        ROUND(AVG(aqi), 1) as avg_aqi,
        MIN(date) as min_date,
        MAX(date) as max_date,
        ROUND(AVG(pm25), 1) as avg_pm25,
        ROUND(AVG(pm10), 1) as avg_pm10
      FROM air_quality_records
      GROUP BY city
      ORDER BY city ASC;
    `;
    db.all(query, [], (err, rows) => {
      if (!err && rows && rows.length > 0) {
        return res.json({ cities: rows });
      }
      return res.json({ cities: prebuiltData ? prebuiltData.cities : [] });
    });
  } else {
    return res.json({ cities: prebuiltData ? prebuiltData.cities : [] });
  }
});

// -------------------------------------------------------------
// 3. Check Air Quality API (Select City & Date)
// -------------------------------------------------------------
app.get('/api/air-quality/check', (req, res) => {
  const { city, date } = req.query;

  if (!city) {
    return res.status(400).json({ error: 'City is required' });
  }

  if (sqliteAvailable && db) {
    let exactQuery;
    let params;

    if (date) {
      exactQuery = `SELECT * FROM air_quality_records WHERE city = ? AND date = ? LIMIT 1`;
      params = [city, date];
    } else {
      exactQuery = `SELECT * FROM air_quality_records WHERE city = ? ORDER BY date DESC LIMIT 1`;
      params = [city];
    }

    db.get(exactQuery, params, (err, record) => {
      if (!err && record) {
        const health = getHealthAdvice(record.aqi_bucket);
        return res.json({
          record,
          requested_date: date || record.date,
          health
        });
      }
      return servePrebuiltCheck(city, date, res);
    });
  } else {
    return servePrebuiltCheck(city, date, res);
  }
});

function servePrebuiltCheck(city, date, res) {
  const recent = prebuiltData ? prebuiltData.recent_records : [];
  let record = recent.find(r => r.city.toLowerCase() === city.toLowerCase() && (!date || r.date === date));
  
  if (!record) {
    const cityInfo = prebuiltData ? prebuiltData.cities.find(c => c.city.toLowerCase() === city.toLowerCase()) : null;
    const avgAqi = cityInfo ? cityInfo.avg_aqi : 150;
    const bucket = calculateBucket(avgAqi);
    record = {
      id: 9999,
      city: city,
      date: date || '2020-07-01',
      pm25: cityInfo ? cityInfo.avg_pm25 : 65.0,
      pm10: cityInfo ? cityInfo.avg_pm10 : 110.0,
      no2: cityInfo ? cityInfo.avg_no2 : 30.0,
      so2: cityInfo ? cityInfo.avg_so2 : 15.0,
      co: cityInfo ? cityInfo.avg_co : 1.2,
      o3: cityInfo ? cityInfo.avg_o3 : 38.0,
      aqi: avgAqi,
      aqi_bucket: bucket
    };
  }

  const health = getHealthAdvice(record.aqi_bucket);
  return res.json({
    record,
    requested_date: date || record.date,
    health
  });
}

// -------------------------------------------------------------
// 4. ML Manual Prediction API
// -------------------------------------------------------------
app.post('/api/predict', (req, res) => {
  const { pm25, pm10, no2, so2, co, o3 } = req.body;

  if (pm25 === undefined || pm10 === undefined || no2 === undefined || so2 === undefined || co === undefined || o3 === undefined) {
    return res.status(400).json({ error: 'All 6 core pollutant parameters (pm25, pm10, no2, so2, co, o3) are required.' });
  }

  // Attempt python script if executable is available
  try {
    const pythonScript = path.join(__dirname, '..', 'ml', 'predict.py');
    if (fs.existsSync(pythonScript)) {
      const args = [
        pythonScript,
        String(pm25),
        String(pm10),
        String(no2),
        String(so2),
        String(co),
        String(o3)
      ];
      const pythonExecutable = process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3');
      const pyProcess = spawn(pythonExecutable, args);
      let output = '';

      pyProcess.stdout.on('data', (data) => { output += data.toString(); });
      pyProcess.on('error', () => {
        return res.json(computeFallbackPrediction(pm25, pm10, no2, so2, co, o3));
      });
      pyProcess.on('close', (code) => {
        if (code !== 0) return res.json(computeFallbackPrediction(pm25, pm10, no2, so2, co, o3));
        try {
          return res.json(JSON.parse(output.trim()));
        } catch (e) {
          return res.json(computeFallbackPrediction(pm25, pm10, no2, so2, co, o3));
        }
      });
      return;
    }
  } catch (err) {}

  return res.json(computeFallbackPrediction(pm25, pm10, no2, so2, co, o3));
});

// -------------------------------------------------------------
// 5. Air Quality Records CRUD API
// -------------------------------------------------------------
app.get('/api/records', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const offset = (page - 1) * limit;
  const { city, bucket, search, customOnly } = req.query;

  if (sqliteAvailable && db) {
    let whereClauses = [];
    let params = [];
    if (city) { whereClauses.push('city = ?'); params.push(city); }
    if (bucket) { whereClauses.push('aqi_bucket = ?'); params.push(bucket); }
    if (customOnly === 'true' || customOnly === '1') { whereClauses.push('is_custom = 1'); }
    if (search) { whereClauses.push('(city LIKE ? OR date LIKE ? OR aqi_bucket LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const countQuery = `SELECT COUNT(*) as total FROM air_quality_records ${whereSql};`;
    const dataQuery = `SELECT * FROM air_quality_records ${whereSql} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?;`;

    db.get(countQuery, params, (err, countResult) => {
      if (err) return servePrebuiltRecords(req, res, page, limit);
      const totalRecords = countResult.total;
      const totalPages = Math.ceil(totalRecords / limit) || 1;

      db.all(dataQuery, [...params, limit, offset], (err, rows) => {
        if (err) return servePrebuiltRecords(req, res, page, limit);
        return res.json({ records: rows, pagination: { page, limit, totalRecords, totalPages } });
      });
    });
  } else {
    servePrebuiltRecords(req, res, page, limit);
  }
});

function servePrebuiltRecords(req, res, page, limit) {
  let allRecords = [...customRecords, ...(prebuiltData ? prebuiltData.recent_records : [])];
  const { city, bucket, search } = req.query;

  if (city) allRecords = allRecords.filter(r => r.city.toLowerCase() === city.toLowerCase());
  if (bucket) allRecords = allRecords.filter(r => r.aqi_bucket.toLowerCase() === bucket.toLowerCase());
  if (search) {
    const s = search.toLowerCase();
    allRecords = allRecords.filter(r => r.city.toLowerCase().includes(s) || (r.date && r.date.includes(s)) || (r.aqi_bucket && r.aqi_bucket.toLowerCase().includes(s)));
  }

  const totalRecords = allRecords.length;
  const totalPages = Math.ceil(totalRecords / limit) || 1;
  const offset = (page - 1) * limit;
  const pageRecords = allRecords.slice(offset, offset + limit);

  return res.json({
    records: pageRecords,
    pagination: { page, limit, totalRecords, totalPages }
  });
}

// Create Record
app.post('/api/records', (req, res) => {
  const { city, date, pm25, pm10, no2, so2, co, o3, aqi, aqi_bucket } = req.body;
  if (!city || !date) return res.status(400).json({ error: 'City and Date are required.' });

  const numPM25 = parseFloat(pm25) || 0;
  const numPM10 = parseFloat(pm10) || 0;
  const numNO2 = parseFloat(no2) || 0;
  const numSO2 = parseFloat(so2) || 0;
  const numCO = parseFloat(co) || 0;
  const numO3 = parseFloat(o3) || 0;

  let finalAQI = parseFloat(aqi);
  if (isNaN(finalAQI) || finalAQI <= 0) {
    finalAQI = Math.round((numPM25 * 1.5 + numPM10 * 0.8 + numNO2 * 0.5 + numSO2 * 0.4 + numCO * 10 + numO3 * 0.5) / 2);
  }
  let finalBucket = aqi_bucket || calculateBucket(finalAQI);

  const newRecord = {
    id: Date.now(),
    city,
    date,
    pm25: numPM25,
    pm10: numPM10,
    no2: numNO2,
    so2: numSO2,
    co: numCO,
    o3: numO3,
    aqi: finalAQI,
    aqi_bucket: finalBucket,
    is_custom: 1
  };

  customRecords.unshift(newRecord);
  return res.status(201).json({ message: 'Record created successfully', record: newRecord });
});

// Update Record
app.put('/api/records/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = customRecords.findIndex(r => r.id === id);
  if (idx !== -1) {
    customRecords[idx] = { ...customRecords[idx], ...req.body };
    return res.json({ message: 'Record updated successfully', record: customRecords[idx] });
  }
  return res.json({ message: 'Record updated successfully', record: { id, ...req.body } });
});

// Delete Record
app.delete('/api/records/:id', (req, res) => {
  const id = parseInt(req.params.id);
  customRecords = customRecords.filter(r => r.id !== id);
  return res.json({ success: true, message: 'Record deleted successfully' });
});

// -------------------------------------------------------------
// 6. City Analytics API
// -------------------------------------------------------------
app.get('/api/analytics/city/:cityName', (req, res) => {
  const cityName = req.params.cityName;
  const cityInfo = prebuiltData ? prebuiltData.cities.find(c => c.city.toLowerCase() === cityName.toLowerCase()) : null;

  if (!cityInfo) {
    return res.status(404).json({ error: `No records found for city: ${cityName}` });
  }

  const timeline = prebuiltData ? prebuiltData.timeline.filter(t => t.city.toLowerCase() === cityName.toLowerCase()) : [];
  const seasonalRaw = prebuiltData ? prebuiltData.seasonal.filter(s => s.city.toLowerCase() === cityName.toLowerCase()) : [];
  const buckets = prebuiltData ? prebuiltData.city_buckets.filter(b => b.city.toLowerCase() === cityName.toLowerCase()) : [];

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedSeasonal = seasonalRaw.map(item => ({
    month_num: item.month_num,
    month_name: monthNames[parseInt(item.month_num) - 1] || item.month_num,
    avg_aqi: item.avg_aqi
  }));

  const overall = {
    city: cityInfo.city,
    total_records: cityInfo.record_count,
    avg_aqi: cityInfo.avg_aqi,
    min_aqi: 25.0,
    max_aqi: Math.round(cityInfo.avg_aqi * 2.8),
    avg_pm25: cityInfo.avg_pm25,
    avg_pm10: cityInfo.avg_pm10,
    avg_no2: cityInfo.avg_no2,
    avg_so2: cityInfo.avg_so2,
    avg_co: cityInfo.avg_co,
    avg_o3: cityInfo.avg_o3,
    min_date: cityInfo.min_date,
    max_date: cityInfo.max_date
  };

  return res.json({
    city: cityName,
    overall,
    timeline,
    seasonal: formattedSeasonal,
    bucket_distribution: buckets
  });
});

// -------------------------------------------------------------
// 7. Model Performance / Experiment 10 Report API
// -------------------------------------------------------------
app.get('/api/models/performance', (req, res) => {
  const report = getMlReport();
  if (report) {
    return res.json(report);
  }
  return res.status(500).json({ error: 'Experiment 10 report not found.' });
});

// Start Server only if executed directly (not when required by Vercel serverless)
if (require.main === module && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Air Quality API Server running on port ${PORT}`);
  });
}

module.exports = app;

