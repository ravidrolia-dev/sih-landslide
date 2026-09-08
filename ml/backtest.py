import pandas as pd
import numpy as np
from sklearn.metrics import roc_auc_score, precision_recall_curve, auc, classification_report
import joblib
import os

def load_backtest_data(csv_path="historical_events.csv"):
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Real backtest data not found at '{csv_path}'. Please provide the dataset before backtesting.")
    df = pd.read_csv(csv_path)
    return df

def run_backtest():
    try:
        model = joblib.load("xgboost_model.pkl")
    except FileNotFoundError:
        print("Model not found. Please train the model first by running train.py")
        return
        
    df_test = load_backtest_data()
    features = ['slope', 'rainfall_24h', 'rainfall_72h', 'soil_moisture', 'lithology_class']
    
    # Check if features exist
    missing_cols = [col for col in features + ['is_landslide'] if col not in df_test.columns]
    if missing_cols:
        raise ValueError(f"Dataset is missing required columns: {missing_cols}")
        
    X_test = df_test[features]
    y_test = df_test['is_landslide']
    
    # Get probabilities and predictions
    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = model.predict(X_test)
    
    # ROC-AUC
    roc_auc = roc_auc_score(y_test, y_prob)
    
    # Precision-Recall AUC
    precision, recall, _ = precision_recall_curve(y_test, y_prob)
    pr_auc = auc(recall, precision)
    
    print("\n=== Backtest Evaluation ===")
    print(f"ROC-AUC Score: {roc_auc:.4f}")
    print(f"PR-AUC Score:  {pr_auc:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

if __name__ == "__main__":
    run_backtest()
