"""
Initialize SQLite database and populate records from city_day.csv
Database: database/air_quality.db
"""

import os
import sqlite3
import pandas as pd
import numpy as np

def get_aqi_bucket(aqi):
    if pd.isna(aqi):
        return 'Moderate'
    if aqi <= 50:
        return 'Good'
    elif aqi <= 100:
        return 'Satisfactory'
    elif aqi <= 200:
        return 'Moderate'
    elif aqi <= 300:
        return 'Poor'
    elif aqi <= 400:
        return 'Very Poor'
    else:
        return 'Severe'

def init_database():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.join(base_dir, '..')
    db_dir = os.path.join(project_dir, 'database')
    os.makedirs(db_dir, exist_ok=True)
    
    db_path = os.path.join(db_dir, 'air_quality.db')
    csv_path = os.path.join(project_dir, 'city_day.csv')
    
    print(f"Connecting to database: {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS air_quality_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        city TEXT NOT NULL,
        date TEXT NOT NULL,
        pm25 REAL,
        pm10 REAL,
        no2 REAL,
        so2 REAL,
        co REAL,
        o3 REAL,
        aqi REAL NOT NULL,
        aqi_bucket TEXT NOT NULL,
        is_custom INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ''')
    
    # Create Indexes for fast querying
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_records_city ON air_quality_records(city);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_records_date ON air_quality_records(date);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_records_city_date ON air_quality_records(city, date);')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_records_bucket ON air_quality_records(aqi_bucket);')
    
    # Check if records already populated
    cursor.execute('SELECT COUNT(*) FROM air_quality_records WHERE is_custom = 0;')
    existing_count = cursor.fetchone()[0]
    
    if existing_count > 0:
        print(f"Database already contains {existing_count} records. Skipping CSV re-import.")
        conn.close()
        return
    
    print(f"Loading and processing {csv_path} for database seeding...")
    df = pd.read_csv(csv_path)
    
    # Drop rows without AQI
    df_clean = df.dropna(subset=['AQI']).copy()
    
    # Fill missing AQI_Bucket
    df_clean['AQI_Bucket'] = df_clean.apply(
        lambda r: r['AQI_Bucket'] if pd.notna(r['AQI_Bucket']) else get_aqi_bucket(r['AQI']), axis=1
    )
    
    # Impute missing feature values with city median / global median
    core_features = ['PM2.5', 'PM10', 'NO2', 'SO2', 'CO', 'O3']
    for col in core_features:
        global_med = float(df_clean[col].median())
        df_clean[col] = df_clean.groupby('City')[col].transform(lambda x: x.fillna(x.median()))
        df_clean[col] = df_clean[col].fillna(global_med)
    
    # Deduplicate
    df_clean = df_clean.drop_duplicates(subset=['City', 'Date'])
    
    print(f"Inserting {len(df_clean)} cleaned records into SQLite database...")
    
    records_to_insert = []
    for _, row in df_clean.iterrows():
        records_to_insert.append((
            str(row['City']),
            str(row['Date']),
            round(float(row['PM2.5']), 2),
            round(float(row['PM10']), 2),
            round(float(row['NO2']), 2),
            round(float(row['SO2']), 2),
            round(float(row['CO']), 2),
            round(float(row['O3']), 2),
            round(float(row['AQI']), 2),
            str(row['AQI_Bucket']),
            0
        ))
    
    cursor.executemany('''
    INSERT INTO air_quality_records (
        city, date, pm25, pm10, no2, so2, co, o3, aqi, aqi_bucket, is_custom
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    ''', records_to_insert)
    
    conn.commit()
    
    cursor.execute('SELECT COUNT(*) FROM air_quality_records;')
    total_in_db = cursor.fetchone()[0]
    print(f"Successfully seeded SQLite database. Total records: {total_in_db}")
    
    conn.close()

if __name__ == '__main__':
    init_database()
