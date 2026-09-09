import pandas as pd
import numpy as np
import xgboost as xgb
import shap
import joblib
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "xgboost_model.pkl")
EXPLAINER_PATH = os.path.join(BASE_DIR, "shap_explainer.pkl")

def generate_baseline_data(n_samples=500):
    """Generates realistic physical baseline data for initial model training."""
    np.random.seed(42)
    slope = np.random.uniform(5, 50, n_samples)
    rainfall_24h = np.random.exponential(40, n_samples)
    rainfall_72h = rainfall_24h + np.random.exponential(60, n_samples)
    soil_moisture = np.random.uniform(0.1, 0.9, n_samples)
    lithology_class = np.random.choice([1, 2, 3], n_samples)

    # Physical risk heuristic: high slope + heavy rainfall + saturated soil
    risk_prob = 1 / (1 + np.exp(-(
        0.08 * slope + 
        0.03 * rainfall_24h + 
        0.02 * rainfall_72h + 
        3.0 * soil_moisture - 4.5
    )))
    is_landslide = (risk_prob > 0.5).astype(int)

    return pd.DataFrame({
        'slope': slope,
        'rainfall_24h': rainfall_24h,
        'rainfall_72h': rainfall_72h,
        'soil_moisture': soil_moisture,
        'lithology_class': lithology_class,
        'is_landslide': is_landslide
    })

def load_data(csv_path):
    if os.path.exists(csv_path):
        return pd.read_csv(csv_path)
    print(f"[Train] Training data '{csv_path}' not found. Generating physical baseline dataset...")
    return generate_baseline_data()

def train_model(csv_path="data/processed/training_data.csv"):
    if not os.path.isabs(csv_path):
        root_dir = os.path.dirname(BASE_DIR)
        csv_path = os.path.join(root_dir, csv_path)
        
    df_features = load_data(csv_path)
    features = ['slope', 'rainfall_24h', 'rainfall_72h', 'soil_moisture', 'lithology_class']
    
    missing_cols = [col for col in features + ['is_landslide'] if col not in df_features.columns]
    if missing_cols:
        raise ValueError(f"Dataset is missing required columns: {missing_cols}")
        
    X = df_features[features].fillna(0)
    y = df_features['is_landslide']
    
    model = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42)
    model.fit(X, y)
    
    # Save model and explainer
    joblib.dump(model, MODEL_PATH)
    explainer = shap.TreeExplainer(model)
    joblib.dump(explainer, EXPLAINER_PATH)
    
    # Calculate performance metrics
    probs = model.predict_proba(X)[:, 1]
    preds = (probs > 0.5).astype(int)
    acc = np.mean(preds == y)
    
    print(f"[Train] Model trained successfully on {len(df_features)} samples.")
    print(f"[Train] Training Accuracy: {acc * 100:.2f}%")
    print(f"[Train] Saved model to: {MODEL_PATH}")
    print(f"[Train] Saved SHAP explainer to: {EXPLAINER_PATH}")

if __name__ == "__main__":
    train_model()

