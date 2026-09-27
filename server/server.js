const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Database Connection
const dbPath = path.join(__dirname, '..', 'database', 'air_quality.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Load ML Report Artifact Helper
function getMlReport() {
  try {
    const mlReportPath = path.join(__dirname, '..', 'ml', 'artifacts', 'experiment_10_report.json');
    if (fs.existsSync(mlReportPath)) {
      return JSON.parse(fs.readFileSync(mlReportPath, 'utf8'));
    }
  } catch (e) {
    console.warn('Could not load ML report:', e.message);
  }
  return null;
}

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

// -------------------------------------------------------------
// 1. Dashboard Stats API
// -------------------------------------------------------------
app.get('/api/dashboard/stats', (req, res) => {
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
    if (err) return res.status(500).json({ error: err.message });

    db.all(topPollutedQuery, [], (err, topPolluted) => {
      if (err) return res.status(500).json({ error: err.message });

      db.all(cleanestQuery, [], (err, cleanest) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all(bucketDistQuery, [], (err, bucketDist) => {
          if (err) return res.status(500).json({ error: err.message });

          const report = getMlReport();
          res.json({
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
});

// -------------------------------------------------------------
// 2. Cities List API
// -------------------------------------------------------------
app.get('/api/cities', (req, res) => {
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
    if (err) return res.status(500).json({ error: err.message });
    res.json({ cities: rows });
  });
});

// -------------------------------------------------------------
// 3. Check Air Quality API (Select City & Date)
// -------------------------------------------------------------
app.get('/api/air-quality/check', (req, res) => {
  const { city, date } = req.query;

  if (!city) {
    return res.status(400).json({ error: 'City is required' });
  }

  let exactQuery;
  let params;

  if (date) {
    exactQuery = `SELECT * FROM air_quality_records WHERE city = ? AND date = ? LIMIT 1`;
    params = [city, date];
  } else {
    // Default to latest available date
    exactQuery = `SELECT * FROM air_quality_records WHERE city = ? ORDER BY date DESC LIMIT 1`;
    params = [city];
  }

  db.get(exactQuery, params, (err, record) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!record) {
      if (date) {
        return res.status(404).json({ error: `No historical record found for ${city} on ${date}.` });
      } else {
        return res.status(404).json({ error: `No historical records found for ${city}.` });
      }
    }

    const health = getHealthAdvice(record.aqi_bucket);
    res.json({
      record,
      requested_date: date || record.date,
      health
    });
  });
});

// -------------------------------------------------------------
// 4. ML Manual Prediction API
// -------------------------------------------------------------
app.post('/api/predict', (req, res) => {
  const { pm25, pm10, no2, so2, co, o3 } = req.body;

  if (pm25 === undefined || pm10 === undefined || no2 === undefined || so2 === undefined || co === undefined || o3 === undefined) {
    return res.status(400).json({ error: 'All 6 core pollutant parameters (pm25, pm10, no2, so2, co, o3) are required.' });
  }

  const pythonScript = path.join(__dirname, '..', 'ml', 'predict.py');
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
  let errorOutput = '';

  pyProcess.stdout.on('data', (data) => {
    output += data.toString();
  });

  pyProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  pyProcess.on('close', (code) => {
    if (code !== 0) {
      console.error('Python predict error:', errorOutput);
      return res.status(500).json({ error: 'Prediction script failed', details: errorOutput });
    }

    try {
      const result = JSON.parse(output.trim());
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse ML output', raw: output });
    }
  });
});

// -------------------------------------------------------------
// 5. Air Quality Records CRUD API
// -------------------------------------------------------------
// Read (List with pagination, search, filter)
app.get('/api/records', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 15;
  const offset = (page - 1) * limit;

  const { city, bucket, search, startDate, endDate, customOnly } = req.query;

  let whereClauses = [];
  let params = [];

  if (city) {
    whereClauses.push('city = ?');
    params.push(city);
  }

  if (bucket) {
    whereClauses.push('aqi_bucket = ?');
    params.push(bucket);
  }

  if (startDate) {
    whereClauses.push('date >= ?');
    params.push(startDate);
  }

  if (endDate) {
    whereClauses.push('date <= ?');
    params.push(endDate);
  }

  if (customOnly === 'true' || customOnly === '1') {
    whereClauses.push('is_custom = 1');
  }

  if (search) {
    whereClauses.push('(city LIKE ? OR date LIKE ? OR aqi_bucket LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*) as total FROM air_quality_records ${whereSql};`;
  const dataQuery = `
    SELECT * FROM air_quality_records 
    ${whereSql} 
    ORDER BY date DESC, id DESC 
    LIMIT ? OFFSET ?;
  `;

  db.get(countQuery, params, (err, countResult) => {
    if (err) return res.status(500).json({ error: err.message });

    const totalRecords = countResult.total;
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    db.all(dataQuery, [...params, limit, offset], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        records: rows,
        pagination: {
          page,
          limit,
          totalRecords,
          totalPages
        }
      });
    });
  });
});

// Create Record
app.post('/api/records', (req, res) => {
  const { city, date, pm25, pm10, no2, so2, co, o3, aqi, aqi_bucket } = req.body;

  if (!city || !date) {
    return res.status(400).json({ error: 'City and Date are required.' });
  }

  const numPM25 = parseFloat(pm25) || 0;
  const numPM10 = parseFloat(pm10) || 0;
  const numNO2 = parseFloat(no2) || 0;
  const numSO2 = parseFloat(so2) || 0;
  const numCO = parseFloat(co) || 0;
  const numO3 = parseFloat(o3) || 0;

  let finalAQI = parseFloat(aqi);
  let finalBucket = aqi_bucket;

  // Auto calculate AQI if not supplied
  if (isNaN(finalAQI) || finalAQI <= 0) {
    finalAQI = Math.round((numPM25 * 1.5 + numPM10 * 0.8 + numNO2 * 0.5 + numSO2 * 0.4 + numCO * 10 + numO3 * 0.5) / 2);
  }

  if (!finalBucket) {
    finalBucket = calculateBucket(finalAQI);
  }

  const insertQuery = `
    INSERT INTO air_quality_records (city, date, pm25, pm10, no2, so2, co, o3, aqi, aqi_bucket, is_custom)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1);
  `;

  db.run(insertQuery, [city, date, numPM25, numPM10, numNO2, numSO2, numCO, numO3, finalAQI, finalBucket], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    db.get('SELECT * FROM air_quality_records WHERE id = ?', [this.lastID], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Record created successfully', record: row });
    });
  });
});

// Update Record
app.put('/api/records/:id', (req, res) => {
  const { id } = req.params;
  const { city, date, pm25, pm10, no2, so2, co, o3, aqi, aqi_bucket } = req.body;

  if (!city || !date) {
    return res.status(400).json({ error: 'City and Date are required.' });
  }

  const numPM25 = parseFloat(pm25) || 0;
  const numPM10 = parseFloat(pm10) || 0;
  const numNO2 = parseFloat(no2) || 0;
  const numSO2 = parseFloat(so2) || 0;
  const numCO = parseFloat(co) || 0;
  const numO3 = parseFloat(o3) || 0;

  let finalAQI = parseFloat(aqi);
  let finalBucket = aqi_bucket;

  if (isNaN(finalAQI) || finalAQI <= 0) {
    finalAQI = Math.round((numPM25 * 1.5 + numPM10 * 0.8 + numNO2 * 0.5 + numSO2 * 0.4 + numCO * 10 + numO3 * 0.5) / 2);
  }

  if (!finalBucket) {
    finalBucket = calculateBucket(finalAQI);
  }

  const updateQuery = `
    UPDATE air_quality_records 
    SET city = ?, date = ?, pm25 = ?, pm10 = ?, no2 = ?, so2 = ?, co = ?, o3 = ?, aqi = ?, aqi_bucket = ?
    WHERE id = ?;
  `;

  db.run(updateQuery, [city, date, numPM25, numPM10, numNO2, numSO2, numCO, numO3, finalAQI, finalBucket, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    db.get('SELECT * FROM air_quality_records WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Record updated successfully', record: row });
    });
  });
});

// Delete Record
app.delete('/api/records/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM air_quality_records WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    res.json({ success: true, message: 'Record deleted successfully' });
  });
});

// -------------------------------------------------------------
// 6. City Analytics API
// -------------------------------------------------------------
app.get('/api/analytics/city/:cityName', (req, res) => {
  const cityName = req.params.cityName;

  const overallQuery = `
    SELECT 
      city,
      COUNT(*) as total_records,
      ROUND(AVG(aqi), 1) as avg_aqi,
      ROUND(MIN(aqi), 1) as min_aqi,
      ROUND(MAX(aqi), 1) as max_aqi,
      ROUND(AVG(pm25), 1) as avg_pm25,
      ROUND(AVG(pm10), 1) as avg_pm10,
      ROUND(AVG(no2), 1) as avg_no2,
      ROUND(AVG(so2), 1) as avg_so2,
      ROUND(AVG(co), 1) as avg_co,
      ROUND(AVG(o3), 1) as avg_o3,
      MIN(date) as min_date,
      MAX(date) as max_date
    FROM air_quality_records
    WHERE city = ?;
  `;

  // Monthly timeline trend (e.g. 2015-01, 2015-02, ...)
  const timelineQuery = `
    SELECT 
      substr(date, 1, 7) as month_year,
      ROUND(AVG(aqi), 1) as avg_aqi,
      ROUND(AVG(pm25), 1) as avg_pm25,
      ROUND(AVG(pm10), 1) as avg_pm10
    FROM air_quality_records
    WHERE city = ?
    GROUP BY substr(date, 1, 7)
    ORDER BY month_year ASC;
  `;

  // Seasonal Monthly pattern (Jan through Dec across all years)
  const seasonalQuery = `
    SELECT 
      substr(date, 6, 2) as month_num,
      ROUND(AVG(aqi), 1) as avg_aqi
    FROM air_quality_records
    WHERE city = ?
    GROUP BY substr(date, 6, 2)
    ORDER BY month_num ASC;
  `;

  // Bucket distribution for this city
  const bucketQuery = `
    SELECT aqi_bucket, COUNT(*) as count
    FROM air_quality_records
    WHERE city = ?
    GROUP BY aqi_bucket;
  `;

  db.get(overallQuery, [cityName], (err, overall) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!overall || overall.total_records === 0) {
      return res.status(404).json({ error: `No records found for city: ${cityName}` });
    }

    db.all(timelineQuery, [cityName], (err, timeline) => {
      if (err) return res.status(500).json({ error: err.message });

      db.all(seasonalQuery, [cityName], (err, seasonal) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all(bucketQuery, [cityName], (err, buckets) => {
          if (err) return res.status(500).json({ error: err.message });

          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const formattedSeasonal = seasonal.map(item => ({
            month_num: item.month_num,
            month_name: monthNames[parseInt(item.month_num) - 1] || item.month_num,
            avg_aqi: item.avg_aqi
          }));

          res.json({
            city: cityName,
            overall,
            timeline,
            seasonal: formattedSeasonal,
            bucket_distribution: buckets
          });
        });
      });
    });
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
  res.status(500).json({ error: 'Experiment 10 report not found. Run ml/train_models.py first.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Air Quality API Server running on port ${PORT}`);
});
