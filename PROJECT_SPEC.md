1. System Architecture (high level)
[Data Sources: Rainfall, Soil Moisture, DEM, Satellite, Geology, Historical Landslides]
                              ↓
                  [Ingestion & ETL Layer (scheduled jobs)]
                              ↓
              [PostgreSQL + PostGIS + TimescaleDB (feature store)]
                              ↓
        [ML Risk Engine: hybrid physical-threshold + ML classifier]
                              ↓
              [Risk API (FastAPI) — grid/village-level scores]
              ↙                                          ↘
  [GIS Dashboard - React + Mapbox/Leaflet]      [Alert Engine → FCM push + SMS gateway]
              ↓                                          ↓
  [Officials: drill-down, backtesting view]   [Citizens: app + SMS, multilingual]
                              ↓
        [Offline-first Reporting: mobile PWA / React Native + local DB + sync queue]
                              ↓
              [Geo-tagged reports feed back into dashboard + model retraining set]
2. Datasets (all free/public — use these exact sources)

Historical landslide inventory (ground truth for training + backtesting):

ISRO/NRSC Landslide Atlas of India — prepared by the National Remote Sensing Centre of ISRO, covering landslides in India from 1998–2022, with a geospatial inventory of around 80,000 landslides, including seasonal, event-based, and route-wise records, plus district-wise susceptibility and exposure mapping. This is your single best labeled dataset — use it for NER states directly.
Geological Survey of India (GSI) Bhukosh portal — geology + existing landslide susceptibility zonation (macro-level, useful as a prior feature).
NASA COOLR (Cooperative Open Online Landslide Repository) / Global Landslide Catalog — supplementary events, especially cross-border NE Himalaya events.

Rainfall:

IMD gridded rainfall data (0.25°×0.25°, daily) — official Indian source, most credible to judges.
NASA GPM IMERG (30-min, near-real-time, global) — for real-time triggering since IMD real-time APIs are harder to get hackathon access to. Use IMERG as your live feed, IMD gridded as historical/training.

Soil moisture:

NASA SMAP L3/L4 (9 km resolution, updated every 2–3 days) — antecedent soil saturation is one of the strongest landslide predictors.

Terrain / DEM (slope, aspect, curvature, drainage):

Cartosat-1 DEM (30m, via Bhuvan) if you can get an account fast, otherwise
SRTM 30m DEM via USGS EarthExplorer or directly through Google Earth Engine (USGS/SRTMGL1_003) — this is the fast path, no manual download needed.

Land use / vegetation / deforestation signal:

Sentinel-2 NDVI via Google Earth Engine — deforested slopes correlate strongly with landslide susceptibility.
Bhuvan LULC thematic layer as a static overlay.

Geology/lithology: GSI geology maps (static raster, digitize just the NER states to keep scope small).

Road network (for evacuation routing): OpenStreetMap (OSM) extract for NER — free, has road graph data you can route on immediately with OSRM or a simple Dijkstra.

Practical shortcut for the hackathon: don't try to pull all of this live for all 8 NE states. Pick 2–3 districts (e.g., a district in Meghalaya + one in Sikkim/Darjeeling border area — both have dense recorded landslide history) as your demo AOI (area of interest), pre-process that data once, and cache it. Architect the pipeline to be scalable, but only populate it for the demo region. Judges will ask "does this scale to all of NER" — answer "yes, architecture is region-agnostic, we scoped data ingestion to X districts for the demo."

3. Tech Stack

Data processing & ML pipeline: Python. Use Google Earth Engine (GEE) Python API as your central data layer — this is your biggest time-saver. GEE already hosts SRTM DEM, Sentinel-1/2, MODIS, CHIRPS/IMERG-adjacent rainfall products, and SMAP, and can compute slope/aspect/NDVI server-side without you downloading and processing giant rasters yourself. This alone can save you a full day of the hackathon.

Database: PostgreSQL + PostGIS extension (geospatial queries: point-in-polygon, distance to fault line, nearest village) + TimescaleDB extension for the time-series rainfall/soil-moisture feed. One Postgres instance, two extensions — don't overcomplicate with separate DBs.

Backend API: FastAPI (Python) — fast to write, native async, easy to expose your ML model directly (no separate serving layer needed), auto-generates OpenAPI docs which looks good in a judging demo.

ML model:

Core classifier: XGBoost or LightGBM (gradient-boosted trees) — tabular data, handles mixed feature types well, and has mature explainability tooling.
Explainability: SHAP — show per-prediction feature importance ("this village is high-risk because: 68mm rainfall in 24h + 40° slope + saturated soil"). This is your single biggest differentiator — almost no other team will do this.
Physical baseline layered in: implement a simple rainfall intensity-duration threshold (Caine-type ID curve, well established in landslide literature) as a rule-based fallback/sanity check that runs alongside the ML model. This lets you say "our system doesn't purely trust a black box — it's hybrid physical + ML," which is very defensible to judges with technical backgrounds.
Validation: spatial train/test split (not random — random splits leak spatially correlated data and inflate accuracy, and a judge who knows GIS will ask this exact question), backtest against the historical landslide inventory, report ROC-AUC / precision-recall / lead-time-before-event.

GIS Dashboard (officials-facing):

React + Leaflet.js or Mapbox GL JS for the map.
Map tiles: use OpenStreetMap tiles (free, no rate limits for hackathon use) as the base layer, or Bhuvan WMS layers as an overlay for government-data authenticity — showing Bhuvan integration specifically signals to MDoNER judges that you're plugging into existing government geospatial infrastructure rather than reinventing it. Mapbox is fine too if you want nicer styling and are okay with their free tier (50k loads/month, plenty for a demo).
Risk grid rendered as a colored choropleth/heatmap layer (GeoJSON polygons colored by risk score) with a time slider.

Mobile / citizen app (offline-first):

Flutter or React Native — either works; Flutter tends to have smoother offline/local-storage story out of the box.
Local storage: SQLite (via sqflite/drift in Flutter, or WatermelonDB in RN) to queue geo-tagged photo reports when there's no signal.
Background sync: Flutter's workmanager or RN's background fetch — syncs queued reports the moment connectivity returns.
If a full native app is too much scope, build this as a PWA (installable web app) using Service Workers + IndexedDB for offline queueing — same effect, much faster to build, and still demoable on a phone browser.

Alerts:

Push notifications: Firebase Cloud Messaging (FCM) — free, works for both app and PWA.
SMS: Twilio (easiest global sandbox, works instantly for a demo) or MSG91/Gupshup (India-specific gateways, cheaper and more "real" for an India government pitch — mention MSG91 by name in your pitch since it's an actual DoT-registered Indian SMS aggregator, which matters for a government buyer).
Two-way SMS: also accept inbound structured SMS from citizens without smartphones (e.g., LANDSLIDE <PIN/village code> <severity 1-3>) parsed via webhook — this is a cheap feature that directly answers "low connectivity" in the problem statement and almost nobody else will build it.

Multilingual: i18next (web) / flutter_intl (mobile) with pre-translated alert templates in Assamese, Bengali, Nepali/Khasi/Mizo (pick 2–3 realistic to the demo, don't fake all 8 official NER languages — 2 well-done translations beat 8 Google-Translated placeholders).

Hosting: any free-tier cloud works — Render/Railway for backend+DB, Vercel/Netlify for frontend, Firebase for push. Don't burn hackathon time fighting AWS IAM permissions; use the fastest-to-deploy option.

4. Feature set for the ML model
Feature	Source	Why it matters
Slope, aspect, curvature	DEM (GEE)	Primary geomorphic driver
24h / 72h / 7-day cumulative rainfall	IMERG	Rainfall-triggered landslides are the dominant NER mechanism
Antecedent soil moisture	SMAP	Saturated soil fails at lower rainfall thresholds
NDVI / land cover change	Sentinel-2	Deforestation removes root cohesion
Lithology/geology class	GSI	Some rock types shear more easily when wet
Distance to road cut / river	OSM + DEM	Human-modified slopes and river undercutting are major triggers
Historical landslide density (prior)	NRSC inventory	Spatial recurrence signal
Drainage density	Derived from DEM	Concentrated runoff paths

Output: risk score 0–100 per grid cell (e.g., 500m or 1km resolution) or per village polygon, bucketed into Watch / Alert / Warning / Severe — mirror IMD's own color-coded warning nomenclature so district officials immediately recognize the semantics.

5. Feature list — MVP vs. stretch

MVP (must work live in the demo):

Risk dashboard for the demo AOI, colored by current computed risk, with a rainfall/soil-moisture overlay toggle.
Backtesting view — pick 2-3 historical landslide dates from the NRSC inventory, show the model would have flagged that zone as high-risk beforehand. This is your credibility slide.
Explainability panel — click a village, see SHAP-driven "why" breakdown.
Alert simulation — trigger a rainfall spike (manually or via a "simulate event" button), watch it cascade to a push notification + SMS (use your own phone).
Offline report demo — put the app in airplane mode, submit a geo-tagged photo report, show it queued locally, then re-enable network and show it sync and appear as a pin on the dashboard.
One evacuation route suggestion — from a village to the nearest safe zone/hospital avoiding the flagged risk polygon (even a simple weighted Dijkstra over OSM roads is enough to demo).

Stretch (build if time remains, mention in pitch even if not fully wired):

Multi-district scaling with a live cron ingestion job (vs. cached demo data).
Two-way SMS reporting for feature phones.
Model retraining loop from citizen-submitted reports.
District Collector PDF situation report auto-export.