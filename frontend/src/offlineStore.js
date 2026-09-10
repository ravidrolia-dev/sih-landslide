// IndexedDB Storage & Auto-Sync Engine for Offline Geo-tagged Field Reports
const DB_NAME = 'NE_GeoAlert_OfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'pending_field_reports';

export function openOfflineDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'offline_id' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error("[IndexedDB Error]", event.target.error);
      reject(event.target.error);
    };
  });
}

// Save a field report to local IndexedDB when offline or network fails
export async function saveReportOffline(reportData) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const offlineItem = {
      offline_id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      ...reportData,
      timestamp: reportData.timestamp || new Date().toISOString(),
      created_at: Date.now(),
      status: 'pending_sync'
    };

    const request = store.put(offlineItem);

    request.onsuccess = () => {
      console.log("[IndexedDB] Report saved locally offline:", offlineItem.offline_id);
      resolve(offlineItem);
    };

    request.onerror = (e) => {
      console.error("[IndexedDB Save Error]", e.target.error);
      reject(e.target.error);
    };
  });
}

// Retrieve all pending offline reports stored in IndexedDB
export async function getPendingOfflineReports() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
}

// Delete an offline report from IndexedDB after successful server sync
export async function removeOfflineReport(offlineId) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(offlineId);

    request.onsuccess = () => {
      resolve(true);
    };

    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
}

import { API_BASE_URL } from './config';

// Auto-sync engine: flushes all IndexedDB pending reports to backend server
export async function syncOfflineQueueToServer(onSyncComplete = null) {
  if (!navigator.onLine) {
    console.log("[Auto-Sync] Device is still offline. Queue deferred.");
    return { synced_count: 0, pending: await getPendingOfflineReports() };
  }

  const pendingItems = await getPendingOfflineReports();
  if (pendingItems.length === 0) {
    return { synced_count: 0, pending: [] };
  }

  console.log(`[Auto-Sync] Reconnected! Flushing ${pendingItems.length} queued report(s) to server...`);

  try {
    const response = await fetch(`${API_BASE_URL}/reports/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reports: pendingItems })
    });

    if (!response.ok) {
      throw new Error(`Sync API HTTP ${response.status}`);
    }

    const result = await response.json();

    // Clear synced items from IndexedDB
    if (result.synced_offline_ids && result.synced_offline_ids.length > 0) {
      for (const id of result.synced_offline_ids) {
        await removeOfflineReport(id);
      }
    }

    console.log(`[Auto-Sync] Successfully synced ${result.synced_count} reports to central database!`);

    if (onSyncComplete && typeof onSyncComplete === 'function') {
      onSyncComplete(result);
    }

    return result;

  } catch (err) {
    console.error("[Auto-Sync Failed]", err);
    return { error: err.message, pending: pendingItems };
  }
}

// Initialize global auto-sync event listener on network status change
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log("🌐 Network connection restored. Triggering IndexedDB auto-sync...");
    syncOfflineQueueToServer();
  });
}
