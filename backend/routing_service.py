import math
import networkx as nx
import os
import sys
import urllib.request
import json
from datetime import datetime

# Ensure sys.path includes backend and ml
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

from ml.gee_service import get_all_features
from ml.predict import predict_risk
import field_report_service

# Key NER Settlements & Infrastructure Exposure Data
NER_SETTLEMENTS = [
    { "id": "shillong", "name": "Shillong", "district": "East Khasi Hills", "state": "Meghalaya", "lat": 25.5788, "lon": 91.8933, "population": 143000, "hospitals": 6, "relief_shelters": 3 },
    { "id": "cherrapunji", "name": "Cherrapunji (Sohra)", "district": "East Khasi Hills", "state": "Meghalaya", "lat": 25.2697, "lon": 91.7321, "population": 14800, "hospitals": 2, "relief_shelters": 2 },
    { "id": "haflong", "name": "Haflong", "district": "Dima Hasao", "state": "Assam", "lat": 25.1645, "lon": 93.0176, "population": 43800, "hospitals": 3, "relief_shelters": 2 },
    { "id": "lachen", "name": "Lachen", "district": "North Sikkim", "state": "Sikkim", "lat": 27.7315, "lon": 88.5486, "population": 3200, "hospitals": 1, "relief_shelters": 1 },
    { "id": "tamenglong", "name": "Tamenglong", "district": "Tamenglong", "state": "Manipur", "lat": 24.9879, "lon": 93.4952, "population": 29400, "hospitals": 2, "relief_shelters": 1 },
    { "id": "aizawl", "name": "Aizawl", "district": "Aizawl", "state": "Mizoram", "lat": 23.7440, "lon": 92.7030, "population": 293000, "hospitals": 8, "relief_shelters": 4 },
    { "id": "kohima", "name": "Kohima", "district": "Kohima", "state": "Nagaland", "lat": 25.6747, "lon": 94.1100, "population": 99000, "hospitals": 4, "relief_shelters": 2 },
    { "id": "itanagar", "name": "Itanagar", "district": "Papum Pare", "state": "Arunachal Pradesh", "lat": 27.0844, "lon": 93.6053, "population": 59500, "hospitals": 3, "relief_shelters": 2 },
    { "id": "mawsynram", "name": "Mawsynram", "district": "East Khasi Hills", "state": "Meghalaya", "lat": 25.2975, "lon": 91.5826, "population": 11200, "hospitals": 1, "relief_shelters": 1 },
    { "id": "tawang", "name": "Tawang", "district": "Tawang", "state": "Arunachal Pradesh", "lat": 27.5860, "lon": 91.8594, "population": 11200, "hospitals": 2, "relief_shelters": 1 }
]

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculates geodesic distance in kilometers between two GPS points."""
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def distance_point_to_segment(p_lat, p_lon, a_lat, a_lon, b_lat, b_lon):
    """Calculates shortest distance in kilometers from point P to line segment AB."""
    ab_dist_sq = (b_lat - a_lat)**2 + (b_lon - a_lon)**2
    if ab_dist_sq == 0:
        return haversine_distance(p_lat, p_lon, a_lat, a_lon)
    
    t = ((p_lat - a_lat) * (b_lat - a_lat) + (p_lon - a_lon) * (b_lon - a_lon)) / ab_dist_sq
    t = max(0, min(1, t))
    
    proj_lat = a_lat + t * (b_lat - a_lat)
    proj_lon = a_lon + t * (b_lon - a_lon)
    
    return haversine_distance(p_lat, p_lon, proj_lat, proj_lon)


# --------------------------------------------------------------------------
# Dynamic Landslide Hazard Aggregation & Proximity Checking
# --------------------------------------------------------------------------

def get_active_landslide_hazards():
    """
    Fetches active/recent landslide hazards from ground-truth field reports
    and severe GEE satellite risk locations.
    """
    hazards = []
    
    # 1. Ground truth field reports
    try:
        reports = field_report_service.get_all_field_reports()
        for r in reports:
            sev = (r.get("severity") or "MEDIUM").upper()
            if sev in ["CRITICAL", "HIGH"]:
                hazards.append({
                    "id": r.get("id"),
                    "title": r.get("title", "Landslide Hazard"),
                    "latitude": float(r.get("latitude")),
                    "longitude": float(r.get("longitude")),
                    "severity": sev,
                    "location_name": r.get("location_name", "Road Cut Zone"),
                    "description": r.get("description", ""),
                    "type": "FIELD_REPORT",
                    "timestamp": r.get("timestamp")
                })
    except Exception as e:
        print(f"[Routing Service Warning] Failed to load field reports for hazard check: {e}")

    # 2. Known static severe road cuts (e.g. Nongpoh NH-6 mudslide, Haflong railway slump)
    known_road_cuts = [
        {
            "id": "hazard_nongpoh",
            "title": "Nongpoh NH-6 Hill Cut Active Mudslide",
            "latitude": 25.7120,
            "longitude": 91.8980,
            "severity": "CRITICAL",
            "location_name": "NH-6 Nongpoh Cut, Meghalaya",
            "description": "Active rockfall and mudslide blocking primary highway lanes",
            "type": "ACTIVE_INCIDENT"
        },
        {
            "id": "hazard_haflong",
            "title": "Haflong Hill Section Slope Collapse",
            "latitude": 25.1720,
            "longitude": 93.0210,
            "severity": "HIGH",
            "location_name": "Haflong Hill Cut, Assam",
            "description": "Debris flow on secondary corridor",
            "type": "ACTIVE_INCIDENT"
        }
    ]
    
    for kh in known_road_cuts:
        if not any(h["id"] == kh["id"] for h in hazards):
            hazards.append(kh)

    return hazards


def check_route_landslide_risk(route_coords, active_hazards=None, buffer_km=1.5):
    """
    Checks whether any active/recent landslide hazards intersect or lie within safety buffer
    of the route polyline coordinates [[lon, lat], ...].
    """
    if active_hazards is None:
        active_hazards = get_active_landslide_hazards()
        
    affected_hazards = []
    blocked_segments = []
    
    if not route_coords or len(route_coords) < 2:
        return {
            "has_landslide_risk": False,
            "affected_hazards": [],
            "max_risk_score": 0.0,
            "blocked_segments": []
        }

    for hazard in active_hazards:
        h_lat = hazard["latitude"]
        h_lon = hazard["longitude"]
        min_dist = float('inf')
        closest_seg_idx = -1

        for i in range(len(route_coords) - 1):
            p1_lon, p1_lat = route_coords[i][0], route_coords[i][1]
            p2_lon, p2_lat = route_coords[i+1][0], route_coords[i+1][1]
            
            dist = distance_point_to_segment(h_lat, h_lon, p1_lat, p1_lon, p2_lat, p2_lon)
            if dist < min_dist:
                min_dist = dist
                closest_seg_idx = i

        if min_dist <= buffer_km:
            hazard_copy = dict(hazard)
            hazard_copy["distance_to_route_km"] = round(min_dist, 2)
            hazard_copy["intersected_segment_index"] = closest_seg_idx
            affected_hazards.append(hazard_copy)
            blocked_segments.append(closest_seg_idx)

    return {
        "has_landslide_risk": len(affected_hazards) > 0,
        "affected_hazards": affected_hazards,
        "max_risk_score": 95.0 if any(h["severity"] == "CRITICAL" for h in affected_hazards) else (75.0 if len(affected_hazards) > 0 else 10.0),
        "blocked_segments": blocked_segments
    }


def find_affected_route_segments(route_coords, active_hazards, buffer_km=1.5):
    """Identifies affected route segment indices and hazard metadata."""
    res = check_route_landslide_risk(route_coords, active_hazards, buffer_km)
    return res["affected_hazards"], res["blocked_segments"]


def rank_routes_by_safety(candidate_routes):
    """
    Ranks candidate routes using:
    Safety (0 affected hazards first) > Road Availability > Landslide Risk > Travel Time > Distance.
    """
    def route_sort_key(r):
        num_hazards = len(r.get("affected_hazards", []))
        is_safe = 0 if num_hazards == 0 else 1
        max_risk = r.get("max_risk_score", 0.0)
        time_mins = r.get("estimated_time_mins", 9999)
        dist_km = r.get("distance_km", 9999)
        return (is_safe, num_hazards, max_risk, time_mins, dist_km)

    sorted_routes = sorted(candidate_routes, key=route_sort_key)
    return sorted_routes


def should_reroute(original_risk_info, alternative_route=None):
    """Determines whether a reroute is required based on landslide hazard risk."""
    if not original_risk_info.get("has_landslide_risk"):
        return False
    if alternative_route is None:
        return True
    return len(alternative_route.get("affected_hazards", [])) < len(original_risk_info.get("affected_hazards", []))


# --------------------------------------------------------------------------
# NER Road Graph & Routing Engine
# --------------------------------------------------------------------------

def build_ner_road_graph():
    """
    Builds a NetworkX weighted graph representing key NER highway corridors & evacuation paths.
    """
    G = nx.Graph()

    nodes = {
        "shillong": (25.5788, 91.8933),
        "guwahati_hub": (26.1445, 91.7362),
        "nongpoh": (25.9034, 91.8808),
        "nongstoin": (25.5200, 91.2600), # West Khasi Hills Disaster Bypass Hub
        "boko": (25.9700, 91.2400),      # NH-127B Assam Bypass Hub
        "cherrapunji": (25.2697, 91.7321),
        "mawsynram": (25.2975, 91.5826),
        "jowai": (25.4526, 92.2037),
        "haflong": (25.1645, 93.0176),
        "silchar_hub": (24.8333, 92.7789),
        "agartala": (23.8315, 91.2868),  # Tripura Hub
        "kohima": (25.6747, 94.1100),
        "dimapur": (25.9060, 93.7274),
        "aizawl": (23.7440, 92.7030),
        "tamenglong": (24.9879, 93.4952),
        "imphal_hub": (24.8170, 93.9368),
        "lachen": (27.7315, 88.5486),
        "gangtok_hub": (27.3389, 88.6065),
        "siliguri_hub": (26.7271, 88.3953), # Sikkim-Assam Connection Hub
        "itanagar": (27.0844, 93.6053),
        "tezpur_hub": (26.6338, 92.8001),
        "tawang": (27.5860, 91.8594),
        "bomdila": (27.2644, 92.4162)
    }

    for n, coords in nodes.items():
        G.add_node(n, lat=coords[0], lon=coords[1])

    edges = [
        ("shillong", "nongpoh"), ("nongpoh", "guwahati_hub"),
        ("shillong", "nongstoin"), ("nongstoin", "boko"), ("boko", "guwahati_hub"), # West Khasi Highway Bypass to Guwahati
        ("shillong", "jowai"), ("jowai", "guwahati_hub"),
        ("shillong", "cherrapunji"), ("shillong", "mawsynram"),
        ("jowai", "haflong"), ("haflong", "silchar_hub"), 
        ("silchar_hub", "aizawl"), ("jowai", "silchar_hub"), ("silchar_hub", "agartala"),
        ("haflong", "tamenglong"), ("tamenglong", "imphal_hub"), 
        ("kohima", "dimapur"), ("dimapur", "imphal_hub"), ("dimapur", "guwahati_hub"), ("dimapur", "tezpur_hub"), ("dimapur", "haflong"),
        ("lachen", "gangtok_hub"), ("gangtok_hub", "siliguri_hub"), ("siliguri_hub", "guwahati_hub"),
        ("itanagar", "tezpur_hub"), 
        ("tawang", "bomdila"), ("bomdila", "tezpur_hub"), 
        ("guwahati_hub", "tezpur_hub")
    ]

    for u, v in edges:
        lat1, lon1 = nodes[u]
        lat2, lon2 = nodes[v]
        dist = haversine_distance(lat1, lon1, lat2, lon2)
        G.add_edge(u, v, weight=dist, original_weight=dist, distance_km=round(dist, 1))

    return G, nodes


def fetch_osrm_detailed_geometry(waypoints_lon_lat):
    """
    Queries OSRM API to fetch exact turn-by-turn real highway road geometry polyline.
    """
    try:
        formatted_wps = ";".join([f"{lon:.4f},{lat:.4f}" for lon, lat in waypoints_lon_lat])
        url = f"http://router.project-osrm.org/route/v1/driving/{formatted_wps}?overview=full&geometries=geojson"
        req = urllib.request.Request(url, headers={'User-Agent': 'NE-GeoAlert-Emergency-Routing/1.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data.get("routes") and len(data["routes"]) > 0:
                route_data = data["routes"][0]
                detailed_coords = route_data["geometry"]["coordinates"]
                distance_km = round(route_data["distance"] / 1000.0, 1)
                duration_mins = round(route_data["duration"] / 60.0)
                return detailed_coords, distance_km, duration_mins
    except Exception as e:
        print(f"[OSRM Warning] Failed to fetch OSRM road geometry: {e}")
    
    return waypoints_lon_lat, None, None


# --------------------------------------------------------------------------
# Main Dynamic Landslide-Safe Routing Core Logic
# --------------------------------------------------------------------------

def calculate_safe_alternative_route(origin_lat: float, origin_lon: float, dest_lat: float = None, dest_lon: float = None, safety_buffer_km: float = 1.5):
    """
    Calculates the shortest route first, checks against live active landslide hazards,
    and automatically recalculates a safe alternative route avoiding blocked road segments.
    """
    G, nodes = build_ner_road_graph()
    active_hazards = get_active_landslide_hazards()

    # Determine origin and destination graph nodes
    origin_node = min(nodes.keys(), key=lambda n: haversine_distance(origin_lat, origin_lon, nodes[n][0], nodes[n][1]))
    
    safe_hubs = ["guwahati_hub", "silchar_hub", "gangtok_hub", "imphal_hub", "tezpur_hub", "dimapur"]
    if dest_lat is not None and dest_lon is not None:
        dest_node = min(nodes.keys(), key=lambda n: haversine_distance(dest_lat, dest_lon, nodes[n][0], nodes[n][1]))
        dest_display_name = dest_node.replace("_hub", "").title()
    else:
        dest_node = min(safe_hubs, key=lambda n: haversine_distance(origin_lat, origin_lon, nodes[n][0], nodes[n][1]))
        dest_display_name = dest_node.replace("_hub", "").title() + " Relief Hub"

    # Step 1: Compute Original Unconstrained Shortest Route
    orig_coords, orig_dist, orig_dur = None, None, None
    orig_route_geojson = None
    orig_path_nodes = [origin_node, dest_node]

    # Try fetching direct OSRM route first if custom coordinates are provided
    if dest_lat is not None and dest_lon is not None:
        direct_wps = [[origin_lon, origin_lat], [dest_lon, dest_lat]]
        dir_coords, dir_dist, dir_dur = fetch_osrm_detailed_geometry(direct_wps)
        if dir_coords and len(dir_coords) > 1 and dir_dist is not None:
            orig_coords = dir_coords
            orig_dist = dir_dist if dir_dist is not None else round(haversine_distance(origin_lat, origin_lon, dest_lat, dest_lon) * 1.3, 1)
            orig_dur = dir_dur if dir_dur is not None else round((orig_dist / 35.0) * 60)
            orig_route_geojson = {
                "type": "Feature",
                "geometry": { "type": "LineString", "coordinates": orig_coords },
                "properties": {
                    "route_type": "ORIGINAL_SHORTEST",
                    "distance_km": round(orig_dist, 1),
                    "estimated_time_mins": orig_dur,
                    "waypoints": [origin_node.title(), dest_display_name]
                }
            }

    # Fallback to Graph Dijkstra path if direct OSRM route was not established
    if orig_coords is None:
        try:
            orig_path_nodes = nx.dijkstra_path(G, origin_node, dest_node, weight='original_weight')
            orig_wps = [[origin_lon, origin_lat]] + [[nodes[n][1], nodes[n][0]] for n in orig_path_nodes]
            orig_coords, orig_dist, orig_dur = fetch_osrm_detailed_geometry(orig_wps)
            
            if orig_dist is None:
                orig_dist = sum(G[orig_path_nodes[i]][orig_path_nodes[i+1]]['original_weight'] for i in range(len(orig_path_nodes)-1))
            if orig_dur is None:
                orig_dur = round((orig_dist / 35.0) * 60)
                
            orig_route_geojson = {
                "type": "Feature",
                "geometry": { "type": "LineString", "coordinates": orig_coords },
                "properties": {
                    "route_type": "ORIGINAL_SHORTEST",
                    "distance_km": round(orig_dist, 1),
                    "estimated_time_mins": orig_dur,
                    "waypoints": [n.replace("_hub", "").title() for n in orig_path_nodes]
                }
            }
        except Exception as e:
            print(f"[Routing Error] Original path calculation failed: {e}")
            return {
                "status": "NO_SAFE_ROUTE_AVAILABLE",
                "is_rerouted": False,
                "error": "No viable road network connection exists between selected locations."
            }

    # Step 2: Check Original Route against Active Landslides & Safety Buffer
    risk_assessment = check_route_landslide_risk(orig_coords, active_hazards, buffer_km=safety_buffer_km)
    
    # CASE A: Original Route is 100% Safe (No landslides detected)
    if not risk_assessment["has_landslide_risk"]:
        return {
            "status": "SAFE_ROUTE",
            "is_rerouted": False,
            "reroute_reason": None,
            "origin": {"latitude": origin_lat, "longitude": origin_lon, "nearest_node": origin_node.title()},
            "destination": {"nearest_safe_hub": dest_display_name, "latitude": nodes[dest_node][0], "longitude": nodes[dest_node][1]},
            "distance_km": round(orig_dist, 1),
            "estimated_time_mins": orig_dur,
            "waypoints": [n.replace("_hub", "").title() for n in orig_path_nodes],
            "avoided_hazard_zones": 0,
            "affected_hazards": [],
            "safe_route_geojson": orig_route_geojson,
            "original_route_geojson": None
        }

    # CASE B: Landslide Detected! Find Affected Edges & Calculate Safe Alternative Route
    affected_hazards = risk_assessment["affected_hazards"]
    
    # Penalize graph edges that pass through or near active hazards
    G_safe = G.copy()
    for u, v, d in G.edges(data=True):
        edge_p1 = (nodes[u][0], nodes[u][1])
        edge_p2 = (nodes[v][0], nodes[v][1])
        
        is_hazard_edge = False
        for h in affected_hazards:
            h_dist = distance_point_to_segment(h["latitude"], h["longitude"], edge_p1[0], edge_p1[1], edge_p2[0], edge_p2[1])
            if h_dist <= safety_buffer_km + 2.0:
                is_hazard_edge = True
                break

        # Specifically penalize Nongpoh & Jowai NH-6 corridors if Nongpoh is blocked
        if any("nongpoh" in h.get("location_name", "").lower() or haversine_distance(h["latitude"], h["longitude"], 25.9034, 91.8808) <= 15.0 for h in affected_hazards):
            if u == "nongpoh" or v == "nongpoh" or (u == "jowai" and v == "guwahati_hub") or (u == "guwahati_hub" and v == "jowai"):
                is_hazard_edge = True

        if is_hazard_edge:
            G_safe[u][v]['weight'] = d['original_weight'] + 50000.0

    # Find Alternative Safe Path using Dijkstra on safe weighted graph
    candidate_routes = []
    try:
        alt_nodes = nx.dijkstra_path(G_safe, origin_node, dest_node, weight='weight')
        alt_wps = [[origin_lon, origin_lat]] + [[nodes[n][1], nodes[n][0]] for n in alt_nodes]
        if dest_lat is not None and dest_lon is not None:
            alt_wps.append([dest_lon, dest_lat])

        alt_coords, alt_dist, alt_dur = fetch_osrm_detailed_geometry(alt_wps)
        
        if alt_dist is None:
            alt_dist = sum(G[alt_nodes[i]][alt_nodes[i+1]]['original_weight'] for i in range(len(alt_nodes)-1))
        if alt_dur is None:
            alt_dur = round((alt_dist / 35.0) * 60)
            
        alt_risk = check_route_landslide_risk(alt_coords, active_hazards, buffer_km=safety_buffer_km)
        
        candidate_routes.append({
            "nodes": alt_nodes,
            "coords": alt_coords,
            "distance_km": alt_dist,
            "estimated_time_mins": alt_dur,
            "affected_hazards": alt_risk["affected_hazards"],
            "max_risk_score": alt_risk["max_risk_score"],
            "has_landslide_risk": alt_risk["has_landslide_risk"]
        })
    except Exception as e:
        print(f"[Routing Error] Alternative path search failed: {e}")

    # Rank candidates by Safety > Risk > Travel Time > Distance
    ranked_candidates = rank_routes_by_safety(candidate_routes)
    
    # Pick best candidate that has 0 or fewer hazards than original
    best_safe_route = None
    if ranked_candidates:
        best_candidate = ranked_candidates[0]
        if len(best_candidate["affected_hazards"]) < len(affected_hazards):
            best_safe_route = best_candidate

    # If NO candidate route is safer than original or all paths blocked:
    if not best_safe_route:
        return {
            "status": "NO_SAFE_ROUTE_AVAILABLE",
            "is_rerouted": False,
            "error": "🔴 No Safe Route Available: All available routes are currently affected by severe landslide risk.",
            "affected_hazards": affected_hazards,
            "original_route_geojson": orig_route_geojson,
            "safe_route_geojson": None
        }

    # Construct Safe Alternative Route Payload
    safe_dist = best_safe_route["distance_km"]
    safe_dur = best_safe_route["estimated_time_mins"]
    base_dist = orig_dist if orig_dist is not None else safe_dist
    base_dur = orig_dur if orig_dur is not None else safe_dur
    add_dist = round(max(0.0, safe_dist - base_dist), 1)
    add_time = max(0, safe_dur - base_dur)

    safe_route_geojson = {
        "type": "Feature",
        "geometry": { "type": "LineString", "coordinates": best_safe_route["coords"] },
        "properties": {
            "route_type": "SAFE_ALTERNATIVE",
            "distance_km": round(safe_dist, 1),
            "estimated_time_mins": safe_dur,
            "waypoints": [n.replace("_hub", "").title() for n in best_safe_route["nodes"]],
            "additional_distance_km": add_dist,
            "additional_time_mins": add_time
        }
    }

    return {
        "status": "ROUTE_AUTOMATICALLY_CHANGED",
        "is_rerouted": True,
        "reroute_reason": "⚠️ Recent landslide detected on original route. We've selected a safer alternative.",
        "origin": {"latitude": origin_lat, "longitude": origin_lon, "nearest_node": origin_node.title()},
        "destination": {"nearest_safe_hub": dest_display_name, "latitude": nodes[dest_node][0], "longitude": nodes[dest_node][1]},
        "distance_km": round(safe_dist, 1),
        "estimated_time_mins": safe_dur,
        "original_distance_km": round(orig_dist, 1),
        "original_estimated_time_mins": orig_dur,
        "additional_distance_km": add_dist,
        "additional_time_mins": add_time,
        "waypoints": [n.replace("_hub", "").title() for n in best_safe_route["nodes"]],
        "avoided_hazard_zones": len(affected_hazards),
        "affected_hazards": affected_hazards,
        "safe_route_geojson": safe_route_geojson,
        "original_route_geojson": orig_route_geojson
    }


def calculate_evacuation_route(origin_lat: float, origin_lon: float, dest_lat: float = None, dest_lon: float = None):
    """Wrapper function preserving backwards compatibility."""
    return calculate_safe_alternative_route(origin_lat, origin_lon, dest_lat, dest_lon)


# --------------------------------------------------------------------------
# Emergency Priority List Calculation
# --------------------------------------------------------------------------

def _process_settlement_priority(item):
    """Worker to compute risk score & priority score for a single settlement."""
    try:
        gee_feats = get_all_features(item["lat"], item["lon"])
        features_dict = {
            "slope": gee_feats["slope"],
            "rainfall_24h": gee_feats["rainfall_24h"],
            "rainfall_72h": gee_feats["rainfall_72h"],
            "soil_moisture": gee_feats["soil_moisture"],
            "lithology_class": gee_feats["lithology_class"]
        }
        pred = predict_risk(features_dict)
        risk_score = float(pred["score"])
    except Exception as e:
        slope_factor = 25.0
        rain_factor = 40.0
        risk_score = min(98.0, slope_factor * 1.5 + rain_factor * 0.8)

    pop_log = math.log10(max(item["population"], 1000))
    exposure_multiplier = pop_log * (1.0 + (item["hospitals"] * 0.05))
    priority_score = round(risk_score * exposure_multiplier, 1)

    if priority_score > 350 or risk_score > 75:
        recommended_action = "🚨 IMMEDIATE EVACUATION REQUIRED"
        urgency_level = "CRITICAL"
    elif priority_score > 220 or risk_score > 50:
        recommended_action = "⚠️ DEPLOY NDRF/SDRF RESCUE TEAMS"
        urgency_level = "HIGH"
    elif priority_score > 120 or risk_score > 25:
        recommended_action = "📢 ISSUE PUBLIC HEAVY RAIN ADVISORY"
        urgency_level = "MEDIUM"
    else:
        recommended_action = "👁️ MONITOR WEATHER & SATELLITE FEED"
        urgency_level = "LOW"

    return {
        "id": item["id"],
        "name": item["name"],
        "district": item["district"],
        "state": item["state"],
        "latitude": item["lat"],
        "longitude": item["lon"],
        "population": item["population"],
        "hospitals": item["hospitals"],
        "relief_shelters": item["relief_shelters"],
        "risk_score": round(risk_score, 1),
        "priority_score": priority_score,
        "urgency_level": urgency_level,
        "recommended_action": recommended_action
    }

def get_emergency_priority_list():
    """Outputs auto-ranked priority list for District Collectors."""
    results = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(_process_settlement_priority, item) for item in NER_SETTLEMENTS]
        for future in as_completed(futures):
            try:
                results.append(future.result())
            except Exception as e:
                print(f"[Routing Error] Settlement processing failed: {e}")

    results.sort(key=lambda x: x["priority_score"], reverse=True)
    return results
