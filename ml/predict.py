"""
Inference script for predicting AQI and AQI Bucket
Used by Express backend and command line
"""

import sys
import os
import json
import joblib
import pandas as pd
import numpy as np

def get_health_advice(bucket):
    advice_map = {
        'Good': {
            'advisory': 'Air quality is considered satisfactory, and air pollution poses little or no risk.',
            'recommendation': 'Ideal for outdoor activities, sports, and ventilation.',
            'color': '#22c55e',
            'severity': 'Minimal Impact'
        },
        'Satisfactory': {
            'advisory': 'Air quality is acceptable; however, there may be minor breathing discomfort to sensitive people.',
            'recommendation': 'Safe for general public; sensitive individuals should monitor symptoms.',
            'color': '#84cc16',
            'severity': 'Minor Breathing Discomfort to Sensitive People'
        },
        'Moderate': {
            'advisory': 'May cause breathing discomfort to people with lung, asthma, and heart diseases.',
            'recommendation': 'Reduce prolonged or heavy outdoor exertion if you experience symptoms.',
            'color': '#eab308',
            'severity': 'Discomfort to Sensitive Groups'
        },
        'Poor': {
            'advisory': 'May cause breathing discomfort to most people on prolonged exposure.',
            'recommendation': 'Wear a pollution mask (N95) outdoors and avoid heavy physical exercise.',
            'color': '#f97316',
            'severity': 'Breathing Discomfort to Most People'
        },
        'Very Poor': {
            'advisory': 'May cause respiratory illness on prolonged exposure. Severe effect on people with lung/heart diseases.',
            'recommendation': 'Stay indoors, close windows, use air purifiers, avoid morning jogs.',
            'color': '#ef4444',
            'severity': 'Respiratory Illness on Prolonged Exposure'
        },
        'Severe': {
            'advisory': 'Affects healthy people and seriously impacts those with existing diseases.',
            'recommendation': 'Emergency condition: Remain strictly indoors and avoid all outdoor physical exertion.',
            'color': '#991b1b',
            'severity': 'Serious Health Impact on Entire Population'
        }
    }
    return advice_map.get(bucket, {
        'advisory': 'Moderate air quality levels observed.',
        'recommendation': 'Follow standard air quality guidelines.',
        'color': '#6b7280',
        'severity': 'General Caution'
    })

def predict(pm25, pm10, no2, so2, co, o3):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    artifacts_dir = os.path.join(base_dir, 'artifacts')
    
    reg_path = os.path.join(artifacts_dir, 'best_regressor.pkl')
    clf_path = os.path.join(artifacts_dir, 'best_classifier.pkl')
    report_path = os.path.join(artifacts_dir, 'experiment_10_report.json')
    
    if not os.path.exists(reg_path) or not os.path.exists(clf_path):
        raise FileNotFoundError("Trained models not found. Please run ml/train_models.py first.")
    
    reg_model = joblib.load(reg_path)
    clf_model = joblib.load(clf_path)
    
    with open(report_path, 'r') as f:
        report = json.load(f)
    
    input_data = pd.DataFrame([{
        'PM2.5': float(pm25),
        'PM10': float(pm10),
        'NO2': float(no2),
        'SO2': float(so2),
        'CO': float(co),
        'O3': float(o3)
    }])
    
    predicted_aqi = float(reg_model.predict(input_data)[0])
    predicted_aqi = max(0.0, round(predicted_aqi, 1))
    
    predicted_bucket = str(clf_model.predict(input_data)[0])
    
    # Probabilities if available
    probabilities = {}
    if hasattr(clf_model, 'predict_proba'):
        probs = clf_model.predict_proba(input_data)[0]
        classes = clf_model.classes_
        probabilities = {cls_name: round(float(p) * 100, 1) for cls_name, p in zip(classes, probs)}
    
    health_info = get_health_advice(predicted_bucket)
    
    return {
        'inputs': {
            'PM2.5': float(pm25),
            'PM10': float(pm10),
            'NO2': float(no2),
            'SO2': float(so2),
            'CO': float(co),
            'O3': float(o3)
        },
        'predicted_aqi': predicted_aqi,
        'predicted_bucket': predicted_bucket,
        'probabilities': probabilities,
        'health_advisory': health_info['advisory'],
        'recommendation': health_info['recommendation'],
        'color': health_info['color'],
        'severity': health_info['severity'],
        'best_regression_model': report['best_regression_model']['model_name'],
        'best_classification_model': report['best_classification_model']['model_name'],
        'r2_score': report['best_regression_model']['r2_score'],
        'accuracy': report['best_classification_model']['accuracy']
    }

if __name__ == '__main__':
    if len(sys.argv) > 1:
        try:
            # argv[1] can be JSON string or 6 floats
            if sys.argv[1].startswith('{'):
                params = json.loads(sys.argv[1])
                res = predict(
                    params.get('pm25', 60),
                    params.get('pm10', 100),
                    params.get('no2', 25),
                    params.get('so2', 15),
                    params.get('co', 1.0),
                    params.get('o3', 30)
                )
            else:
                pm25 = float(sys.argv[1])
                pm10 = float(sys.argv[2])
                no2 = float(sys.argv[3])
                so2 = float(sys.argv[4])
                co = float(sys.argv[5])
                o3 = float(sys.argv[6])
                res = predict(pm25, pm10, no2, so2, co, o3)
            print(json.dumps(res))
        except Exception as e:
            print(json.dumps({'error': str(e)}))
            sys.exit(1)
    else:
        # Default test run
        res = predict(75.5, 120.0, 35.0, 18.2, 1.4, 42.0)
        print(json.dumps(res, indent=2))
