import pandas as pd
import numpy as np
import xgboost as xgb
import shap
import joblib
import os

MODEL_PATH = "xgboost_model.pkl"
EXPLAINER_PATH = "shap_explainer.pkl"

def load_data(csv_path):
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Real training data not found at '{csv_path}'. Please provide the dataset before training.")
    df = pd.read_csv(csv_path)
    return df

def train_model(csv_path="real_events.csv"):
    df_features = load_data(csv_path)
    
    # We assume the real dataset already contains the engineered features and 'is_landslide' label.
    # If feature extraction is needed later, query PostGIS/Earth Engine here instead of using synthetic data.
    
    features = ['slope', 'rainfall_24h', 'rainfall_72h', 'soil_moisture', 'lithology_class']
    
    # Check if features exist in the provided dataset
    missing_cols = [col for col in features + ['is_landslide'] if col not in df_features.columns]
    if missing_cols:
        raise ValueError(f"Dataset is missing required columns: {missing_cols}")
        
    X = df_features[features]
    y = df_features['is_landslide']
    
    model = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42)
    model.fit(X, y)
    joblib.dump(model, MODEL_PATH)
    
    # Fit SHAP explainer on training data for faster lookups later
    explainer = shap.TreeExplainer(model)
    joblib.dump(explainer, EXPLAINER_PATH)
    
    print(f"Model trained on real data and saved to {MODEL_PATH}")

if __name__ == "__main__":
    train_model("real_events.csv")
