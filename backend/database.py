import os
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

MONGO_URL = os.getenv("DATABASE_URL") or os.getenv("MONGO_URL") or "mongodb://localhost:27017"
DB_NAME = "risk_db"

print(f"[Database Config] Configured MongoDB connection to '{MONGO_URL}'")

try:
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    # Trigger a server selection to verify connection
    client.admin.command('ping')
    print("[Database Config] Successfully connected to MongoDB")
except ConnectionFailure as e:
    print(f"[Database Warning] Connection to MongoDB failed: {e}")
    client = MongoClient("mongodb://localhost:27017") # Fallback to localhost

db_client = client[DB_NAME]

def get_db():
    try:
        yield db_client
    finally:
        pass

