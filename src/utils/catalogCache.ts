import { Recipe } from '../types/freshdiy';

const DB_NAME = 'freshdiy_catalog_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'catalog_store';
const CACHE_KEY = 'hellofresh_recipes_v1';

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedRecipes(): Promise<Recipe[] | null> {
  try {
    const db = await openCacheDb();
    return await new Promise<Recipe[] | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CACHE_KEY);
      req.onsuccess = () => {
        const val = req.result;
        if (Array.isArray(val) && val.length > 0) {
          resolve(val as Recipe[]);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function setCachedRecipes(recipes: Recipe[]): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(recipes, CACHE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

/**
 * Loads the base HelloFresh catalog from IndexedDB in <50ms if cached,
 * or fetches `/data/hellofresh_recipes.json` and populates IndexedDB in the background.
 */
export async function loadBaseCatalogFast(): Promise<Recipe[]> {
  const cached = await getCachedRecipes();
  if (cached && cached.length > 0) {
    return cached;
  }

  const res = await fetch('/data/hellofresh_recipes.json');
  const fresh: Recipe[] = await res.json();
  if (Array.isArray(fresh) && fresh.length > 0) {
    setCachedRecipes(fresh).catch(() => {});
  }
  return fresh;
}
