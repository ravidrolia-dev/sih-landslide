import urllib.request
import json

locations = [
  {'name': 'Shillong', 'lat': 25.5788, 'lon': 91.8933},
  {'name': 'Guwahati', 'lat': 26.1445, 'lon': 91.7362},
  {'name': 'Kohima', 'lat': 25.6747, 'lon': 94.1100},
  {'name': 'Dimapur', 'lat': 25.9064, 'lon': 93.7270},
  {'name': 'Haflong', 'lat': 25.1645, 'lon': 93.0176},
  {'name': 'Silchar', 'lat': 24.8333, 'lon': 92.7789},
  {'name': 'Tezpur', 'lat': 26.6338, 'lon': 92.8001},
  {'name': 'Imphal', 'lat': 24.8170, 'lon': 93.9368},
  {'name': 'Aizawl', 'lat': 23.744, 'lon': 92.703},
  {'name': 'Itanagar', 'lat': 27.0844, 'lon': 93.6053},
  {'name': 'Gangtok', 'lat': 27.3389, 'lon': 88.6065},
  {'name': 'Agartala', 'lat': 23.8315, 'lon': 91.2868}
]

origin = locations[0]
for dest in locations[1:]:
    olat, olon = origin['lat'], origin['lon']
    dlat, dlon = dest['lat'], dest['lon']
    url = f"http://localhost:8000/emergency/evacuation-route?origin_lat={olat}&origin_lon={olon}&dest_lat={dlat}&dest_lon={dlon}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f"{origin['name']} -> {dest['name']}: status={data.get('status')}, dist={data.get('distance_km')}, error={data.get('error')}", flush=True)
    except Exception as e:
        print(f"{origin['name']} -> {dest['name']}: EXCEPTION {e}", flush=True)
