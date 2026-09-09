import pandas as pd
import numpy as np
from sklearn.metrics import roc_auc_score, precision_recall_curve, auc, classification_report
import joblib
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
MODEL_PATH = os.path.join(BASE_DIR, "xgboost_model.pkl")

def load_backtest_data(csv_path="data/processed/training_data.csv"):
    if not os.path.isabs(csv_path):
        csv_path = os.path.join(ROOT_DIR, csv_path)
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Backtest data not found at '{csv_path}'. Run prepare_data.py first.")
    df = pd.read_csv(csv_path)
    return df

def run_backtest():
    if not os.path.exists(MODEL_PATH):
        print(f"Model not found at '{MODEL_PATH}'. Please train the model first by running train.py")
        return
        
    model = joblib.load(MODEL_PATH)
    df_test = load_backtest_data()
    features = ['slope', 'rainfall_24h', 'rainfall_72h', 'soil_moisture', 'lithology_class']
    
    # Check if features exist
    missing_cols = [col for col in features + ['is_landslide'] if col not in df_test.columns]
    if missing_cols:
        raise ValueError(f"Dataset is missing required columns: {missing_cols}")
        
    X_test = df_test[features].fillna(0)
    y_test = df_test['is_landslide']
    
    # Get probabilities and predictions
    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob > 0.5).astype(int)
    
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

