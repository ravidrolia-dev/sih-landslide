import pandas as pd
import numpy as np
import joblib
import os
import threading
import warnings

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "xgboost_model.pkl")
EXPLAINER_PATH = os.path.join(BASE_DIR, "shap_explainer.pkl")

_MODEL = None
_EXPLAINER = None
_MODEL_LOCK = threading.Lock()

def get_model_and_explainer():
    """
    Singleton loader for XGBoost model and SHAP explainer.
    Loads once into memory on demand and reuses the instances across all predictions.
    """
    global _MODEL, _EXPLAINER
    if _MODEL is None or _EXPLAINER is None:
        with _MODEL_LOCK:
            if _MODEL is None or _EXPLAINER is None:
                if not os.path.exists(MODEL_PATH) or not os.path.exists(EXPLAINER_PATH):
                    raise FileNotFoundError(f"Model or Explainer not found at {MODEL_PATH}. Run train.py first.")
                
                print(f"[ML Singleton] Loading XGBoost model & SHAP explainer from {MODEL_PATH}...")
                with warnings.catch_warnings():
                    warnings.filterwarnings("ignore", category=UserWarning, module="xgboost")
                    _MODEL = joblib.load(MODEL_PATH)
                    _EXPLAINER = joblib.load(EXPLAINER_PATH)
                print("[ML Singleton] XGBoost model & SHAP explainer loaded successfully into memory!")
    return _MODEL, _EXPLAINER

def predict_risk(features_dict):
    """
    Given a dictionary of features, return the risk score (0-100) and SHAP breakdown.
    Uses singleton model instance to prevent memory bloat and disk re-reads.
    """
    model, explainer = get_model_and_explainer()
    
    df = pd.DataFrame([features_dict])
    
    # Predict probability
    prob = float(model.predict_proba(df)[0][1])
    score = float(prob * 100)
    
    # Compute SHAP values
    shap_values = explainer.shap_values(df)
    
    breakdown = {}
    if isinstance(shap_values, list):
        vals = shap_values[1][0]
    else:
        vals = shap_values[0]
        
    for i, col in enumerate(df.columns):
        breakdown[col] = float(vals[i])
        
    base_val = float(explainer.expected_value[1] if isinstance(explainer.expected_value, (list, np.ndarray)) else explainer.expected_value)

    return {
        "score": round(score, 2),
        "shap_breakdown": breakdown,
        "base_value": round(base_val, 4)
    }

