"""
Air Quality Prediction and Monitoring System
ML Experiment 10: Model Training and Comparative Evaluation
Dataset: city_day.csv (CPCB Air Quality Data)
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression, Ridge, LogisticRegression
from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, GradientBoostingRegressor, GradientBoostingClassifier
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix
)

def get_aqi_bucket(aqi):
    if pd.isna(aqi):
        return 'Unknown'
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

def train_and_evaluate():
    print("=== Starting ML Experiment 10 Pipeline ===")
    
    # Paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(base_dir, '..', 'city_day.csv')
    artifacts_dir = os.path.join(base_dir, 'artifacts')
    os.makedirs(artifacts_dir, exist_ok=True)
    
    # 1. Load Dataset
    print(f"1. Loading dataset from {dataset_path}...")
    df = pd.read_csv(dataset_path)
    total_raw_rows = len(df)
    print(f"   Raw dataset size: {total_raw_rows} rows, {df.shape[1]} columns")
    
    # 2. Data Preprocessing & Missing Value Handling
    # Drop rows missing the target AQI
    df_clean = df.dropna(subset=['AQI']).copy()
    
    # If AQI_Bucket is missing for any row where AQI is present, impute based on CPCB standard formula
    df_clean['AQI_Bucket'] = df_clean.apply(
        lambda r: r['AQI_Bucket'] if pd.notna(r['AQI_Bucket']) else get_aqi_bucket(r['AQI']), axis=1
    )
    
    core_features = ['PM2.5', 'PM10', 'NO2', 'SO2', 'CO', 'O3']
    
    # Handle missing values in core features: City median imputation first, then global median
    city_medians = {}
    global_medians = {}
    for col in core_features:
        global_med = float(df_clean[col].median())
        global_medians[col] = round(global_med, 2)
        med_dict = df_clean.groupby('City')[col].median().to_dict()
        city_medians[col] = {
            str(k): (round(float(v), 2) if pd.notna(v) else round(global_med, 2))
            for k, v in med_dict.items()
        }
        df_clean[col] = df_clean.groupby('City')[col].transform(lambda x: x.fillna(x.median()))
        df_clean[col] = df_clean[col].fillna(global_med)
    
    # Drop any remaining duplicates
    df_clean = df_clean.drop_duplicates(subset=['City', 'Date'])
    clean_rows = len(df_clean)
    print(f"   Cleaned dataset size: {clean_rows} records (Dropped {total_raw_rows - clean_rows} invalid/missing target rows)")
    
    # City-level summary stats for UI
    cities = sorted(df_clean['City'].unique().tolist())
    city_stats = {}
    for city in cities:
        c_df = df_clean[df_clean['City'] == city]
        city_stats[city] = {
            'record_count': int(len(c_df)),
            'min_date': str(c_df['Date'].min()),
            'max_date': str(c_df['Date'].max()),
            'avg_aqi': round(float(c_df['AQI'].mean()), 1),
            'min_aqi': round(float(c_df['AQI'].min()), 1),
            'max_aqi': round(float(c_df['AQI'].max()), 1),
            'avg_pm25': round(float(c_df['PM2.5'].mean()), 1),
            'avg_pm10': round(float(c_df['PM10'].mean()), 1),
            'avg_no2': round(float(c_df['NO2'].mean()), 1),
            'avg_so2': round(float(c_df['SO2'].mean()), 1),
            'avg_co': round(float(c_df['CO'].mean()), 1),
            'avg_o3': round(float(c_df['O3'].mean()), 1),
            'dominant_bucket': str(c_df['AQI_Bucket'].mode()[0]) if not c_df['AQI_Bucket'].empty else 'Moderate'
        }
    
    # 3. Train/Test Split
    X = df_clean[core_features]
    y_reg = df_clean['AQI']
    y_clf = df_clean['AQI_Bucket']
    
    bucket_order = ['Good', 'Satisfactory', 'Moderate', 'Poor', 'Very Poor', 'Severe']
    
    X_train, X_test, y_train_reg, y_test_reg, y_train_clf, y_test_clf = train_test_split(
        X, y_reg, y_clf, test_size=0.20, random_state=42
    )
    
    print(f"3. Train/Test Split: Train = {len(X_train)} rows (80%), Test = {len(X_test)} rows (20%)")
    
    # 4. Feature Scaling (for Linear & Logistic models)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Save Scaler
    scaler_path = os.path.join(artifacts_dir, 'scaler.pkl')
    joblib.dump(scaler, scaler_path)
    print(f"   Scaler saved to {scaler_path}")
    
    # 5. REGRESSION EXPERIMENT
    print("\n4. Training & Comparing Regression Models (Target: Numerical AQI)...")
    reg_models = {
        'Linear Regression': LinearRegression(),
        'Ridge Regression': Ridge(alpha=1.0),
        'Decision Tree Regressor': DecisionTreeRegressor(random_state=42, max_depth=12),
        'Random Forest Regressor': RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1, max_depth=15),
        'Gradient Boosting Regressor': GradientBoostingRegressor(n_estimators=100, random_state=42, max_depth=6)
    }
    
    reg_results = []
    trained_reg_instances = {}
    
    for name, model in reg_models.items():
        use_scaled = 'Linear' in name or 'Ridge' in name
        X_tr = X_train_scaled if use_scaled else X_train
        X_te = X_test_scaled if use_scaled else X_test
        
        model.fit(X_tr, y_train_reg)
        preds = model.predict(X_te)
        trained_reg_instances[name] = model
        
        mae = float(mean_absolute_error(y_test_reg, preds))
        mse = float(mean_squared_error(y_test_reg, preds))
        rmse = float(np.sqrt(mse))
        r2 = float(r2_score(y_test_reg, preds))
        
        reg_results.append({
            'model_name': name,
            'mae': round(mae, 2),
            'mse': round(mse, 2),
            'rmse': round(rmse, 2),
            'r2_score': round(r2, 4),
            'is_scaled': use_scaled
        })
        print(f"   - {name:<30} : MAE={mae:6.2f} | MSE={mse:8.2f} | RMSE={rmse:6.2f} | R²={r2:.4f}")
    
    # Select Best Regressor (Highest R² / Lowest RMSE)
    best_reg_info = max(reg_results, key=lambda x: x['r2_score'])
    best_reg_name = best_reg_info['model_name']
    best_reg_model = trained_reg_instances[best_reg_name]
    best_reg_path = os.path.join(artifacts_dir, 'best_regressor.pkl')
    joblib.dump(best_reg_model, best_reg_path)
    print(f"   >> Best Regression Model Selected: {best_reg_name} (R² = {best_reg_info['r2_score']}) saved to {best_reg_path}")
    
    # 6. CLASSIFICATION EXPERIMENT
    print("\n5. Training & Comparing Classification Models (Target: AQI_Bucket)...")
    clf_models = {
        'Logistic Regression': LogisticRegression(max_iter=1000, random_state=42),
        'Decision Tree Classifier': DecisionTreeClassifier(random_state=42, max_depth=12),
        'Random Forest Classifier': RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1, max_depth=15),
        'Gradient Boosting Classifier': GradientBoostingClassifier(n_estimators=60, random_state=42, max_depth=4)
    }
    
    clf_results = []
    trained_clf_instances = {}
    confusion_matrices = {}
    
    for name, model in clf_models.items():
        use_scaled = 'Logistic' in name
        X_tr = X_train_scaled if use_scaled else X_train
        X_te = X_test_scaled if use_scaled else X_test
        
        model.fit(X_tr, y_train_clf)
        preds = model.predict(X_te)
        trained_clf_instances[name] = model
        
        acc = float(accuracy_score(y_test_clf, preds))
        prec = float(precision_score(y_test_clf, preds, average='weighted', zero_division=0))
        rec = float(recall_score(y_test_clf, preds, average='weighted', zero_division=0))
        f1 = float(f1_score(y_test_clf, preds, average='weighted', zero_division=0))
        
        cm = confusion_matrix(y_test_clf, preds, labels=bucket_order)
        confusion_matrices[name] = {
            'matrix': cm.tolist(),
            'labels': bucket_order
        }
        
        clf_results.append({
            'model_name': name,
            'accuracy': round(acc, 4),
            'precision': round(prec, 4),
            'recall': round(rec, 4),
            'f1_score': round(f1, 4),
            'is_scaled': use_scaled
        })
        print(f"   - {name:<30} : Accuracy={acc*100:5.2f}% | Precision={prec*100:5.2f}% | Recall={rec*100:5.2f}% | F1={f1*100:5.2f}%")
    
    # Select Best Classifier (Highest Accuracy / F1)
    best_clf_info = max(clf_results, key=lambda x: x['accuracy'])
    best_clf_name = best_clf_info['model_name']
    best_clf_model = trained_clf_instances[best_clf_name]
    best_clf_path = os.path.join(artifacts_dir, 'best_classifier.pkl')
    joblib.dump(best_clf_model, best_clf_path)
    print(f"   >> Best Classification Model Selected: {best_clf_name} (Accuracy = {best_clf_info['accuracy']*100:.2f}%) saved to {best_clf_path}")
    
    # 7. Feature Importances (from Best Random Forest Models)
    feature_importances = {}
    if hasattr(best_reg_model, 'feature_importances_'):
        feature_importances['regression'] = [
            {'feature': feat, 'importance': round(float(imp), 4)}
            for feat, imp in zip(core_features, best_reg_model.feature_importances_)
        ]
        feature_importances['regression'].sort(key=lambda x: x['importance'], reverse=True)
        
    if hasattr(best_clf_model, 'feature_importances_'):
        feature_importances['classification'] = [
            {'feature': feat, 'importance': round(float(imp), 4)}
            for feat, imp in zip(core_features, best_clf_model.feature_importances_)
        ]
        feature_importances['classification'].sort(key=lambda x: x['importance'], reverse=True)
    
    # 8. Sample Actual vs Predicted Test Data (for College Project Graph Comparison)
    sample_indices = np.random.RandomState(42).choice(len(X_test), size=40, replace=False)
    sample_X_test = X_test.iloc[sample_indices]
    sample_y_reg = y_test_reg.iloc[sample_indices].tolist()
    sample_preds_reg = best_reg_model.predict(sample_X_test).tolist()
    sample_y_clf = y_test_clf.iloc[sample_indices].tolist()
    sample_preds_clf = best_clf_model.predict(sample_X_test).tolist()
    
    actual_vs_predicted = [
        {
            'sample_id': i + 1,
            'actual_aqi': round(float(act_reg), 1),
            'predicted_aqi': round(float(pred_reg), 1),
            'actual_bucket': act_clf,
            'predicted_bucket': pred_clf
        }
        for i, (act_reg, pred_reg, act_clf, pred_clf) in enumerate(zip(sample_y_reg, sample_preds_reg, sample_y_clf, sample_preds_clf))
    ]
    
    # 9. Save Complete Experiment 10 Report JSON
    report = {
        'project_title': 'Air Quality Prediction and Monitoring System Using Machine Learning',
        'experiment_no': 'ML Experiment 10',
        'dataset_info': {
            'source': 'city_day.csv (Indian Central Pollution Control Board - CPCB)',
            'total_raw_rows': total_raw_rows,
            'total_cleaned_rows': clean_rows,
            'train_rows': len(X_train),
            'test_rows': len(X_test),
            'train_split_pct': 80,
            'test_split_pct': 20,
            'features': core_features,
            'regression_target': 'AQI (Numerical Air Quality Index)',
            'classification_target': 'AQI_Bucket (Good, Satisfactory, Moderate, Poor, Very Poor, Severe)',
            'unique_cities_count': len(cities),
            'cities_list': cities,
            'date_range': {'min': str(df_clean['Date'].min()), 'max': str(df_clean['Date'].max())}
        },
        'regression_comparison': reg_results,
        'best_regression_model': best_reg_info,
        'classification_comparison': clf_results,
        'best_classification_model': best_clf_info,
        'confusion_matrices': confusion_matrices,
        'feature_importances': feature_importances,
        'actual_vs_predicted_sample': actual_vs_predicted,
        'city_stats': city_stats,
        'city_medians': city_medians,
        'global_medians': global_medians,
        'bucket_labels': bucket_order
    }
    
    report_path = os.path.join(artifacts_dir, 'experiment_10_report.json')
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"\n6. Complete ML Experiment 10 report saved to {report_path}")
    print("=== ML Pipeline Successfully Completed ===")

if __name__ == '__main__':
    train_and_evaluate()
