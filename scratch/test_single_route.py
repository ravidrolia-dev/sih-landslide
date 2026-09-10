import urllib.request
import json
import sys

dest_name = sys.argv[1] if len(sys.argv) > 1 else 'Kohima'

locations = {
  'Shillong': {'lat': 25.5788, 'lon': 91.8933},
  'Guwahati': {'lat': 26.1445, 'lon': 91.7362},
  'Kohima': {'lat': 25.6747, 'lon': 94.1100},
  'Dimapur': {'lat': 25.9064, 'lon': 93.7270},
  'Haflong': {'lat': 25.1645, 'lon': 93.0176},
  'Silchar': {'lat': 24.8333, 'lon': 92.7789},
  'Tezpur': {'lat': 26.6338, 'lon': 92.8001},
  'Imphal': {'lat': 24.8170, 'lon': 93.9368},
  'Aizawl': {'lat': 23.744, 'lon': 92.703},
  'Itanagar': {'lat': 27.0844, 'lon': 93.6053},
  'Gangtok': {'lat': 27.3389, 'lon': 88.6065},
  'Agartala': {'lat': 23.8315, 'lon': 91.2868}
}

origin = locations['Shillong']
dest = locations.get(dest_name, locations['Kohima'])

url = f"http://localhost:8000/emergency/evacuation-route?origin_lat={origin['lat']}&origin_lon={origin['lon']}&dest_lat={dest['lat']}&dest_lon={dest['lon']}"
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    print(f"Shillong -> {dest_name}: status={data.get('status')}, dist={data.get('distance_km')} km, rerouted={data.get('is_rerouted')}", flush=True)
