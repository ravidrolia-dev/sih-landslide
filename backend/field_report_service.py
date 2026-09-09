import os
import json
import time
from datetime import datetime

# Sample pre-loaded ground truth field reports from NER state officers & citizens
INITIAL_REPORTS = [
    {
        "id": "report_101",
        "title": "Severe Mudslide on Shillong-Guwahati Highway (NH-6)",
        "reporter_name": "Insp. R. Sangma (Meghalaya SDMA)",
        "severity": "CRITICAL",
        "latitude": 25.7120,
        "longitude": 91.8980,
        "location_name": "Nongpoh Hill Cut, Meghalaya",
        "description": "Heavy boulder collapse and mudslide completely blocking two lanes of NH-6. Traffic diverted.",
        "image_url": "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?w=600&auto=format&fit=crop&q=60",
        "timestamp": "2026-09-09T14:30:00Z",
        "synced": True,
        "source": "Field Officer GPS Camera"
    },
    {
        "id": "report_102",
        "title": "Soil Slump near Haflong Railway Track",
        "reporter_name": "K. Baruah (NFR Engineer)",
        "severity": "HIGH",
        "latitude": 25.1720,
        "longitude": 93.0210,
        "location_name": "Haflong Hill Section, Assam",
        "description": "Continuous seepage causing 15-meter embankment erosion adjacent to rail line. Monitoring in progress.",
        "image_url": "https://images.unsplash.com/photo-1590402494682-cd3fb53b1f70?w=600&auto=format&fit=crop&q=60",
        "timestamp": "2026-09-09T15:45:00Z",
        "synced": True,
        "source": "Mobile Officer App"
    },
    {
        "id": "report_103",
        "title": "Minor Debris Flow on Lachen Valley Route",
        "reporter_name": "T. Lepcha (Sikkim Disaster Cell)",
        "severity": "MEDIUM",
        "latitude": 27.7280,
        "longitude": 88.5420,
        "location_name": "North Sikkim Highway",
        "description": "Small rockfall cleared by local BRO excavators. Passable with caution.",
        "image_url": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=60",
        "timestamp": "2026-09-09T16:10:00Z",
        "synced": True,
        "source": "Citizen Alert"
    }
]

REPORTS_FILE = os.path.join(os.path.dirname(__file__), "field_reports.json")

def load_reports():
    """Load persisted reports from disk or return initial seed data."""
    if os.path.exists(REPORTS_FILE):
        try:
            with open(REPORTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[FieldReport Service Warning] Failed to load JSON file ({e}), using initial seed data.")
    return INITIAL_REPORTS

def save_reports(reports):
    """Save reports to local JSON file for persistence."""
    try:
        with open(REPORTS_FILE, "w", encoding="utf-8") as f:
            json.dump(reports, f, indent=2)
    except Exception as e:
        print(f"[FieldReport Service Error] Failed to persist reports to file: {e}")

# Global state
_field_reports = load_reports()

def get_all_field_reports():
    """Returns all ground-truth field reports."""
    global _field_reports
    return _field_reports

def submit_single_report(report_data):
    """Saves a single field report."""
    global _field_reports
    new_id = f"report_{int(time.time() * 1000)}"
    
    report_entry = {
        "id": new_id,
        "title": report_data.get("title") or f"Field Report @ {report_data.get('latitude', 0):.3f}°, {report_data.get('longitude', 0):.3f}°",
        "reporter_name": report_data.get("reporter_name", "Anonymous Citizen"),
        "severity": report_data.get("severity", "MEDIUM").upper(),
        "latitude": float(report_data.get("latitude", 0.0)),
        "longitude": float(report_data.get("longitude", 0.0)),
        "location_name": report_data.get("location_name", "North-East India Location"),
        "description": report_data.get("description", "No details provided"),
        "image_url": report_data.get("image_url") or "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?w=600&auto=format&fit=crop&q=60",
        "timestamp": report_data.get("timestamp") or datetime.utcnow().isoformat() + "Z",
        "synced": True,
        "source": report_data.get("source", "Mobile Field App")
    }

    _field_reports.insert(0, report_entry)
    save_reports(_field_reports)
    return report_entry

def sync_batch_offline_reports(reports_list):
    """Processes a batch array of offline-queued reports from IndexedDB."""
    global _field_reports
    synced_count = 0
    synced_ids = []

    for item in reports_list:
        try:
            res = submit_single_report(item)
            synced_count += 1
            if "offline_id" in item:
                synced_ids.append(item["offline_id"])
            elif "id" in item:
                synced_ids.append(item["id"])
        except Exception as e:
            print(f"[FieldReport Sync Error] Failed to import offline report item: {e}")

    return {
        "status": "SUCCESS",
        "synced_count": synced_count,
        "synced_offline_ids": synced_ids,
        "total_reports": len(_field_reports)
    }
