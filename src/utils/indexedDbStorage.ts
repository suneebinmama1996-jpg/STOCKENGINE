import { Branch, StockItem } from '../types';
import { normalizeBranchesList } from './branchNormalizer';

const DB_NAME = 'StockCountingDB';
const DB_VERSION = 1;
const STORE_BRANCHES = 'branches';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_BRANCHES)) {
        db.createObjectStore(STORE_BRANCHES, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
}

/**
 * Saves all branches and their items into IndexedDB for persistent unlimited storage
 */
export async function saveBranchesToIndexedDb(branches: Branch[]): Promise<void> {
  try {
    const db = await openDatabase();
    const cleanBranches = normalizeBranchesList(branches);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_BRANCHES], 'readwrite');
      const store = transaction.objectStore(STORE_BRANCHES);

      // Clear existing records and re-populate with latest clean branches
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        for (const branch of cleanBranches) {
          store.put(branch);
        }
      };

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error('Transaction error while saving to IndexedDB'));
      };
    });
  } catch (err) {
    console.warn('[IndexedDB] Could not save branches to IndexedDB:', err);
  }
}

/**
 * Saves a single branch into IndexedDB
 */
export async function saveSingleBranchToIndexedDb(branch: Branch): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_BRANCHES], 'readwrite');
      const store = transaction.objectStore(STORE_BRANCHES);
      store.put(branch);

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.warn('[IndexedDB] Could not save single branch to IndexedDB:', err);
  }
}

/**
 * Loads all branches stored in IndexedDB
 */
export async function loadBranchesFromIndexedDb(): Promise<Branch[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_BRANCHES], 'readonly');
      const store = transaction.objectStore(STORE_BRANCHES);
      const request = store.getAll();

      request.onsuccess = () => {
        db.close();
        const results = request.result as Branch[];
        if (Array.isArray(results) && results.length > 0) {
          resolve(normalizeBranchesList(results));
        } else {
          resolve([]);
        }
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn('[IndexedDB] Could not load branches from IndexedDB:', err);
    return [];
  }
}
