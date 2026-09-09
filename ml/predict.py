import pandas as pd
import numpy as np
import joblib
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "xgboost_model.pkl")
EXPLAINER_PATH = os.path.join(BASE_DIR, "shap_explainer.pkl")

def predict_risk(features_dict):
    """
    Given a dictionary of features, return the risk score (0-100) and SHAP breakdown.
    """
    if not os.path.exists(MODEL_PATH) or not os.path.exists(EXPLAINER_PATH):
        raise FileNotFoundError(f"Model or Explainer not found at {MODEL_PATH}. Run train.py first.")
        
    model = joblib.load(MODEL_PATH)
    explainer = joblib.load(EXPLAINER_PATH)
    
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
