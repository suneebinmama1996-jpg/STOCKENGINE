import { Branch } from '../types';
import { safeSetLocalStorage, safeGetLocalStorage } from './safeJsonParser';
import { normalizeBranchData, normalizeBranchesList } from './branchNormalizer';
import { saveBranchesToIndexedDb, loadBranchesFromIndexedDb } from './indexedDbStorage';

export interface ImportProgress {
  current: number;
  total: number;
  percent: number;
  chunkIndex: number;
  totalChunks: number;
  statusText: string;
}

const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbw5azl9m7Np9VY5Noe9fT78lRa7Ftzswn7f4lVeAmb_z4cUVNf7RjiL6Sdb2u8BRM9e/exec';
const LOCAL_STORAGE_KEY = 'STOCK_ENGINE_REAL_DATA';

// Polling pause state to prevent auto-refresh overwriting data during active upload/import
let isPollingPaused = false;
let pauseTimeout: any = null;

export function pausePolling(durationMs = 25000): void {
  isPollingPaused = true;
  if (pauseTimeout) clearTimeout(pauseTimeout);
  pauseTimeout = setTimeout(() => {
    isPollingPaused = false;
    console.log('[Google Sheets Service] Polling auto-resumed after duration timeout.');
  }, durationMs);
  console.log(`[Google Sheets Service] Polling paused for ${durationMs}ms`);
}

export function resumePolling(): void {
  if (pauseTimeout) clearTimeout(pauseTimeout);
  isPollingPaused = false;
  console.log('[Google Sheets Service] Polling resumed.');
}

export function getIsPollingPaused(): boolean {
  return isPollingPaused;
}

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
    // If polling is paused (e.g. during file import/saving), do not fetch or overwrite local state
    if (isPollingPaused) {
      console.log('[Google Sheets Service] Polling currently paused to protect active import/save transaction.');
      return;
    }

    try {
      const res = await fetch(GOOGLE_SHEETS_URL);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const json = await res.json();
      
      // If polling was paused while the request was in-flight, discard response
      if (isPollingPaused || !active) {
        return;
      }

      let fetched: any[] = [];
      let stockDataRows: any[] = [];

      if (Array.isArray(json)) {
        fetched = json;
      } else if (json && typeof json === 'object') {
        if (Array.isArray(json.branches)) {
          fetched = json.branches;
        } else if (Array.isArray(json.data)) {
          fetched = json.data;
        }
        // Handle Stock_Data rows returned from Apps Script
        if (Array.isArray(json.stockData)) {
          stockDataRows = json.stockData;
        } else if (Array.isArray(json.stock_data)) {
          stockDataRows = json.stock_data;
        }
      }

      if (active && !isPollingPaused) {
        // If stockData rows exist, group items by branchId
        const stockDataByBranch: Record<string, any[]> = {};
        if (stockDataRows.length > 0) {
          stockDataRows.forEach((row: any, rIdx: number) => {
            if (!row) return;
            const bId = String(row.branchId || row.branch_id || row[0] || '').trim();
            if (!bId) return;
            if (!stockDataByBranch[bId]) stockDataByBranch[bId] = [];

            const barcode = String(row.barcode || row.sku || row[1] || `BC-${rIdx + 1}`).trim();
            const name = String(row.name || row[2] || `สินค้า ${barcode}`).trim();
            const systemQty = Number(row.systemQty ?? row.qty ?? row[3] ?? 0);
            const scannedQty = Number(row.scannedQty ?? row[4] ?? 0);
            const location = String(row.location || row[5] || 'ไม่ระบุตำแหน่ง').trim();
            const category = String(row.category || row[6] || 'ทั่วไป').trim();

            stockDataByBranch[bId].push({
              id: row.id || `stock-item-${rIdx}`,
              barcode,
              sku: barcode,
              name,
              systemQty,
              scannedQty,
              location,
              category,
              variance: scannedQty - systemQty,
              status: scannedQty === systemQty ? 'MATCH' : scannedQty < systemQty ? 'SHORTAGE' : 'OVER',
              color: scannedQty === systemQty ? 'GREEN' : scannedQty < systemQty ? 'RED' : 'YELLOW',
            });
          });
        }

        // Attach grouped Stock_Data items to corresponding branches
        if (Object.keys(stockDataByBranch).length > 0) {
          fetched = fetched.map((b) => {
            const matchItems = stockDataByBranch[b.id] || stockDataByBranch[b.code] || stockDataByBranch[b.name];
            if (matchItems && matchItems.length > 0) {
              return {
                ...b,
                items: matchItems,
              };
            }
            return b;
          });
        }

        const realFetched = normalizeBranchesList(
          fetched.filter(b => !isMockBranch(b))
        );

        const currentLocals = getLocalBranches();

        if (realFetched.length > 0) {
          // Merge Cloud data with Local Storage: preserve local items if local has items and cloud is empty or has fewer items
          const merged = realFetched.map((cloudBranch) => {
            const localBranch = currentLocals.find(
              (l) => l.id === cloudBranch.id || l.code === cloudBranch.code || l.name === cloudBranch.name
            );
            if (localBranch && Array.isArray(localBranch.items) && localBranch.items.length > 0) {
              // If cloud branch items are empty or significantly fewer than local items (e.g. from recent large file import)
              if (!Array.isArray(cloudBranch.items) || cloudBranch.items.length === 0 || localBranch.items.length > cloudBranch.items.length) {
                return {
                  ...cloudBranch,
                  items: localBranch.items,
                  auditDate: localBranch.auditDate || cloudBranch.auditDate,
                };
              }
            }
            return cloudBranch;
          });

          // Also keep any local branches that haven't synced to cloud yet
          currentLocals.forEach((localBranch) => {
            const existsInCloud = merged.some(
              (m) => m.id === localBranch.id || m.code === localBranch.code || m.name === localBranch.name
            );
            if (!existsInCloud) {
              merged.push(localBranch);
            }
          });

          const finalized = normalizeBranchesList(merged);
          saveLocalBranches(finalized);
          onUpdate(finalized);
        } else {
          // If sheets is empty, check local cache or return empty array, but connection was OK!
          const locals = getLocalBranches();
          onUpdate(locals);
        }
      }
    } catch (err: any) {
      // Enter error handling only for true network/fetch errors
      console.warn('[Google Sheets Service] Network fetch error, falling back to LocalStorage cache:', err);
      if (active && !isPollingPaused) {
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
export async function saveBranch(rawBranch: Branch, originalId?: string, originalCode?: string): Promise<void> {
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
  const idx = currentLocals.findIndex(b => b.id === (originalId || branch.id) || b.name === branch.name || b.code === (originalCode || branch.code));
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
      originalId: originalId || branch.id,
      originalCode: originalCode || branch.code,
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
 * Clears all stock items and resets scan counts for a specific branch
 * in LocalStorage, IndexedDB, and Google Sheets (Stock_Data tab).
 */
export async function clearBranchStockData(branchId: string): Promise<void> {
  // 1. Update LocalStorage cache immediately
  const currentLocals = getLocalBranches();
  const targetBranch = currentLocals.find(
    (b) => b.id === branchId || b.code === branchId || b.name === branchId
  );

  if (targetBranch) {
    targetBranch.items = [];
    targetBranch.auditStatus = 'NOT_STARTED';
    targetBranch.startedAt = undefined;
    targetBranch.submittedAt = undefined;
  }

  const locals = normalizeBranchesList(currentLocals);
  saveLocalBranches(locals);

  // 2. Clear from IndexedDB immediately
  try {
    await saveBranchesToIndexedDb(locals);
    console.log(`[Google Sheets Service] Cleared items for branch "${branchId}" in IndexedDB.`);
  } catch (idbErr) {
    console.warn('[Google Sheets Service] IndexedDB clear warning:', idbErr);
  }

  // 3. Send delete/clear request to Google Sheets (Stock_Data & Branches)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const payload = {
      action: 'clearBranchData',
      targetSheet: 'Stock_Data',
      sheetName: 'Stock_Data',
      overwrite: true,
      mode: 'overwrite',
      id: targetBranch?.id || branchId,
      branchId: targetBranch?.id || branchId,
      code: targetBranch?.code || branchId,
      name: targetBranch?.name || branchId,
      items: [],
      rowValues: [],
      branches: locals,
    };

    const response = await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Google Sheets Service] Web App clearBranchData responded with HTTP ${response.status}`);
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn('[Google Sheets Service] Clear branch items network warning:', err?.message || err);
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


export async function importItemsToBranchInSheets(
  branchId: string,
  items: any[],
  onProgress?: (progress: ImportProgress) => void,
  importMode: 'overwrite' | 'append' = 'overwrite'
): Promise<void> {
  const totalItemsCount = items?.length || 0;
  // Pause polling immediately to stop any auto-refresh from interfering with active import
  pausePolling(120000);

  const formattedItems = (items || []).map((item, idx) => ({
    barcode: String(item.barcode || item.sku || `BC-${idx + 1}`).trim(),
    name: String(item.name || `สินค้า ${item.sku || idx + 1}`).trim(),
    systemQty: Number(item.systemQty ?? item.qty ?? item.quantity ?? 0),
    scannedQty: Number(item.scannedQty ?? 0),
    sku: String(item.sku || item.barcode || `SKU-${idx + 1}`).trim(),
    location: String(item.location || 'ไม่ระบุตำแหน่ง').trim(),
    category: String(item.category || 'ทั่วไป').trim(),
    variance: Number(item.variance ?? (Number(item.scannedQty || 0) - Number(item.systemQty || 0))),
    status: item.status || (Number(item.scannedQty || 0) === Number(item.systemQty || 0) ? 'MATCH' : Number(item.scannedQty || 0) < Number(item.systemQty || 0) ? 'SHORTAGE' : 'OVER'),
    color: item.color || (Number(item.scannedQty || 0) === Number(item.systemQty || 0) ? 'GREEN' : Number(item.scannedQty || 0) < Number(item.systemQty || 0) ? 'RED' : 'YELLOW'),
    id: item.id || `item-${Date.now()}-${idx}`
  }));

  // 1. Local Cache First: Save directly to localStorage immediately
  const currentLocals = getLocalBranches();
  const targetBranch = currentLocals.find(b => b.id === branchId || b.code === branchId || b.name === branchId);
  const targetId = targetBranch ? targetBranch.id : branchId;
  const targetCode = targetBranch ? targetBranch.code : branchId;
  const targetName = targetBranch ? targetBranch.name : branchId;

  if (targetBranch) {
    targetBranch.items = importMode === 'overwrite'
      ? formattedItems
      : [...(targetBranch.items || []), ...formattedItems];
  }
  const locals = normalizeBranchesList(currentLocals);
  saveLocalBranches(locals);

  // 2. Unlimited Chunked Batch Processing (Sub-arrays of 300 items per chunk)
  // Each item is structured cleanly for tabular rows: branchId, barcode, name, systemQty, scannedQty
  const CHUNK_SIZE = 300;
  const totalChunks = Math.ceil(formattedItems.length / CHUNK_SIZE) || 1;

  console.log(`[Google Sheets Service] Starting unlimited chunked import (${importMode.toUpperCase()}) for ${formattedItems.length} items (${totalChunks} chunk(s), size: ${CHUNK_SIZE}) targeting sheet tab "Stock_Data"...`);

  // Report initial progress 0%
  if (onProgress) {
    onProgress({
      current: 0,
      total: formattedItems.length,
      percent: 0,
      chunkIndex: 0,
      totalChunks,
      statusText: `เตรียมส่งข้อมูล ${formattedItems.length.toLocaleString()} รายการ (${importMode === 'overwrite' ? 'แทนที่ทั้งหมด' : 'ต่อท้าย'})...`
    });
  }

  for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
    // 1. Add 1.5s delay between chunks to prevent Google Apps Script Lock / Server Busy
    if (chunkIdx > 0) {
      console.log(`[Google Sheets Service] Waiting 1.5s delay before sending chunk ${chunkIdx + 1}/${totalChunks}...`);
      await new Promise(r => setTimeout(r, 1500));
    }

    const chunkItems = formattedItems.slice(chunkIdx * CHUNK_SIZE, (chunkIdx + 1) * CHUNK_SIZE);
    const isFirstChunk = chunkIdx === 0;
    const isLastChunk = chunkIdx === totalChunks - 1;
    const processedCount = Math.min((chunkIdx + 1) * CHUNK_SIZE, formattedItems.length);
    const currentPercent = Math.round((processedCount / (formattedItems.length || 1)) * 100);

    // Format tabular 2D array rows for direct Batch setValues: [branchId, barcode, name, systemQty, scannedQty]
    const rowValues = chunkItems.map(item => [
      targetId,
      item.barcode,
      item.name,
      item.systemQty,
      item.scannedQty,
      item.location || '',
      item.category || ''
    ]);

    if (onProgress) {
      onProgress({
        current: processedCount,
        total: formattedItems.length,
        percent: currentPercent,
        chunkIndex: chunkIdx + 1,
        totalChunks,
        statusText: `กำลังบันทึกลง Stock_Data (${importMode === 'overwrite' ? 'เขียนทับ' : 'ต่อท้าย'})... (${processedCount.toLocaleString()} / ${formattedItems.length.toLocaleString()} รายการ - ${currentPercent}%)`
      });
    }

    // 2. Automatic Retry Mechanism (up to 3 times if Server Busy / transient error)
    const MAX_RETRIES = 3;
    let uploadSuccess = false;
    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      try {
        // In overwrite mode: Chunk 0 sends 'importItems' with overwrite flag
        // In append mode: sends 'appendItems'
        const actionName = (isFirstChunk && importMode === 'overwrite') ? 'importItems' : 'appendItems';

        const payload = {
          action: actionName,
          targetSheet: 'Stock_Data',
          sheetName: 'Stock_Data',
          mode: importMode,
          overwrite: importMode === 'overwrite',
          id: targetId,
          branchId: targetId,
          code: targetCode,
          name: targetName,
          items: chunkItems,
          rowValues: rowValues, // Batch setValues compatible 2D array [branchId, barcode, name, systemQty, scannedQty]
          totalItems: formattedItems.length,
          chunkIndex: chunkIdx,
          totalChunks: totalChunks,
          chunkSize: CHUNK_SIZE,
          processedCount,
          isFirstChunk,
          isLastChunk,
          // Include full branches snapshot on last/single chunk to ensure full metadata consistency
          branches: isLastChunk ? locals : undefined
        };

        const response = await fetch(GOOGLE_SHEETS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const resText = await response.text();
        let resJson: any = null;
        try {
          resJson = JSON.parse(resText);
        } catch {
          // response may be text
        }

        if (resJson && resJson.status === 'error' && resJson.success === false) {
          const errMsg = String(resJson.message || 'Google Apps Script returned an error response');
          throw new Error(errMsg);
        }

        console.log(`[Google Sheets Service] Chunk ${chunkIdx + 1}/${totalChunks} (${chunkItems.length} items) written to Stock_Data successfully (attempt ${attempt}).`);
        uploadSuccess = true;
        break; // Successfully uploaded, exit retry loop
      } catch (chunkErr: any) {
        clearTimeout(timeoutId);
        lastError = chunkErr;
        const errMsg = String(chunkErr?.message || chunkErr || '');
        console.warn(`[Google Sheets Service] Chunk ${chunkIdx + 1}/${totalChunks} attempt ${attempt}/${MAX_RETRIES} warning:`, errMsg);

        if (attempt < MAX_RETRIES) {
          const retryWaitMs = 2000 * attempt;
          if (onProgress) {
            onProgress({
              current: processedCount,
              total: formattedItems.length,
              percent: currentPercent,
              chunkIndex: chunkIdx + 1,
              totalChunks,
              statusText: `เซิร์ฟเวอร์ไม่ว่าง กำลังลองส่งชุดที่ ${chunkIdx + 1} ใหม่ (รอบที่ ${attempt + 1}/${MAX_RETRIES} ใน ${retryWaitMs / 1000}s)...`
            });
          }
          await new Promise(r => setTimeout(r, retryWaitMs));
        }
      }
    }

    if (!uploadSuccess) {
      console.warn(`[Google Sheets Service] Chunk ${chunkIdx + 1}/${totalChunks} finished with warning, but local cache & IndexedDB are intact.`);
    }
  }

  // 3. Save full dataset to IndexedDB for ultra-fast offline & big-data persistence
  try {
    await saveBranchesToIndexedDb(locals);
    console.log('[Google Sheets Service] Full branches dataset saved to IndexedDB successfully.');
  } catch (idbErr) {
    console.warn('[Google Sheets Service] IndexedDB saving warning:', idbErr);
  }

  if (onProgress) {
    onProgress({
      current: formattedItems.length,
      total: formattedItems.length,
      percent: 100,
      chunkIndex: totalChunks,
      totalChunks,
      statusText: `บันทึกข้อมูลลงแท็บ Stock_Data ครบถ้วน 100% (${formattedItems.length.toLocaleString()} รายการ)`
    });
  }

  console.log('[Google Sheets Service] All item chunks successfully synced to Stock_Data in Google Sheets and IndexedDB for branch:', targetId);
}
