import { Branch } from '../types';
import { safeSetLocalStorage, safeGetLocalStorage } from './safeJsonParser';
import { normalizeBranchData, normalizeBranchesList } from './branchNormalizer';

const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbw5azl9m7Np9VY5Noe9fT78lRa7Ftzswn7f4lVeAmb_z4cUVNf7RjiL6Sdb2u8BRM9e/exec';
const LOCAL_STORAGE_KEY = 'STOCK_ENGINE_REAL_DATA';

// Safeguard check to eliminate all mockup branches
export const isMockBranch = (b: Branch): boolean => {
  if (!b) return true;
  const idStr = String(b.id || '');
  const codeStr = String(b.code || '').toUpperCase();
  const nameStr = String(b.name || '').toLowerCase();

  const isMockId = [
    'BR-DMG', 'BR-SP', 'BR-CW', 'BR-MB', 'BR-NM', 'BR-PK',
    'CW-02', 'MB-03', 'NM-04', 'PK-05'
  ].includes(idStr) || [
    'CW-02', 'MB-03', 'NM-04', 'PK-05'
  ].includes(codeStr);
  
  const isMockName = 
    nameStr.includes('คลังสินค้าชำรุด') ||
    nameStr.includes('siam paragon') ||
    nameStr.includes('centralworld') ||
    nameStr.includes('mega bangna') ||
    nameStr.includes('nimman') ||
    nameStr.includes('phuket') ||
    nameStr.includes('central phuket');
    
  return isMockId || isMockName;
};

// Local storage helper
function getLocalBranches(): Branch[] {
  try {
    const cached = safeGetLocalStorage<any[]>(LOCAL_STORAGE_KEY, []);
    if (Array.isArray(cached) && cached.length > 0) {
      return normalizeBranchesList(cached.filter(b => b && !isMockBranch(b)));
    }
  } catch (e) {
    console.warn('[Google Sheets Service] Error reading local cache safely:', e);
  }
  return [];
}

function saveLocalBranches(branches: Branch[]) {
  try {
    const cleanList = normalizeBranchesList(branches.filter(b => !isMockBranch(b)));
    safeSetLocalStorage(LOCAL_STORAGE_KEY, cleanList);
  } catch (e) {
    console.warn('[Google Sheets Service] Error writing local cache safely:', e);
  }
}

/**
 * Periodically polls or loads branches from Google Sheets, with local fallback
 */
export function subscribeToBranches(
  onUpdate: (branches: Branch[]) => void,
  onError: (error: any) => void
): () => void {
  let active = true;

  const loadData = async () => {
    try {
      const res = await fetch(GOOGLE_SHEETS_URL);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const json = await res.json();
      
      let fetched: any[] = [];
      if (Array.isArray(json)) {
        fetched = json;
      } else if (json && Array.isArray(json.branches)) {
        fetched = json.branches;
      } else if (json && Array.isArray(json.data)) {
        fetched = json.data;
      }

      if (active) {
        const realFetched = normalizeBranchesList(
          fetched.filter(b => !isMockBranch(b))
        );

        // If we got valid real branches from sheets, cache them locally and update state
        if (realFetched.length > 0) {
          saveLocalBranches(realFetched);
          onUpdate(realFetched);
        } else {
          // If sheets is empty, check local cache or return empty array, but connection was OK!
          const locals = getLocalBranches();
          onUpdate(locals);
        }
      }
    } catch (err: any) {
      // Enter error handling only for true network/fetch errors
      console.warn('[Google Sheets Service] Network fetch error, falling back to LocalStorage cache:', err);
      if (active) {
        onUpdate(getLocalBranches());
        onError(err);
      }
    }
  };

  // Run initial fetch
  loadData();

  // Set up polling interval (every 12 seconds) for seamless real-time sheets syncing
  const intervalId = setInterval(loadData, 12000);

  // Return unsubscribe / cleanup function
  return () => {
    active = false;
    clearInterval(intervalId);
  };
}

/**
 * Saves or updates a branch in Google Sheets and updates LocalStorage cache.
 * Uses text/plain header with POST stringify payload with a 7s timeout safeguard.
 */
export async function saveBranch(rawBranch: Branch): Promise<void> {
  const branch = normalizeBranchData(rawBranch);
  if (isMockBranch(branch)) {
    console.log('[Google Sheets Service] Skipping save for mock branch:', branch.name);
    return;
  }

  // Ensure current date is set if not provided
  if (!branch.auditDate) {
    branch.auditDate = new Date().toISOString().slice(0, 10);
  }

  // Update local storage first (Optimistic UI)
  const currentLocals = getLocalBranches();
  const idx = currentLocals.findIndex(b => b.id === branch.id || b.name === branch.name || b.code === branch.code);
  if (idx >= 0) {
    currentLocals[idx] = branch;
  } else {
    currentLocals.push(branch);
  }
  const locals = normalizeBranchesList(currentLocals);
  saveLocalBranches(locals);

  // Post updates to Google Sheets Web App with correct keys and timeout safeguard
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const payload = {
      action: 'save',
      branch: branch,
      branches: locals, // Full list sync backup
      id: branch.id,
      code: branch.code,
      name: branch.name,
      region: branch.region,
      assignedAuditor: branch.assignedAuditor || '',
      auditStatus: branch.auditStatus,
      auditDate: branch.auditDate || new Date().toISOString().slice(0, 10),
      items: branch.items
    };

    const response = await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Google Sheets Service] Web App responded with HTTP ${response.status}`);
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn('[Google Sheets Service] Save network warning (LocalStorage is safe):', err?.message || err);
    // Do not throw if it was just network timeout because optimistic UI and localStorage already saved it
  }
}

/**
 * Deletes a branch from Google Sheets and LocalStorage
 */
export async function removeBranch(branchId: string): Promise<void> {
  const locals = getLocalBranches().filter(b => b.id !== branchId && b.code !== branchId);
  saveLocalBranches(locals);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const payload = {
      action: 'deleteBranch',
      id: branchId,
      branchId: branchId,
      code: branchId,
      branches: locals
    };

    const response = await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Google Sheets Service] Non-critical: Web App responded with HTTP ${response.status}`);
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn('[Google Sheets Service] Non-critical: Delete request network error:', err?.message || err);
  }
}

/**
 * Resets database/sheet with specific list
 */
export async function resetFirestoreDatabase(defaultBranches: Branch[] = []): Promise<void> {
  const filtered = normalizeBranchesList(defaultBranches.filter(b => !isMockBranch(b)));
  saveLocalBranches(filtered);

  try {
    const payload = {
      action: 'reset',
      branches: filtered
    };

    const response = await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Google Sheets Web App responded with HTTP ${response.status}`);
    }
  } catch (err) {
    console.error('[Google Sheets Service] Reset database failed:', err);
    throw err;
  }
}
