import { StockItem } from '../types';

/**
 * Sanitizes non-standard serialized string formats from Google Sheets / Apps Script
 * e.g. "{sku=1001, name=น้ำดื่ม, scannedQty=5.0, systemQty=10.0}" or "[{sku=...}, ...]"
 */
export function sanitizeItemsString(rawStr: string): string {
  if (!rawStr || typeof rawStr !== 'string') return '[]';
  let s = rawStr.trim();

  // If already standard JSON array/object, leave for JSON.parse
  if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
    // Check if it uses '=' instead of ':'
    if (s.includes('=')) {
      // 1. Replace key= with "key":
      s = s.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*=/g, '$1"$2":');

      // 2. Wrap unquoted string values in double quotes
      s = s.replace(/:\s*([^,{}\[\]"\s][^,{}\[\]]*?)(?=\s*[,}\]])/g, (_m, val) => {
        const trimmed = val.trim();
        if (trimmed === 'true' || trimmed === 'false' || trimmed === 'null') {
          return `: ${trimmed}`;
        }
        if (!isNaN(Number(trimmed)) && trimmed !== '') {
          return `: ${trimmed}`;
        }
        return `: "${trimmed.replace(/"/g, '\\"')}"`;
      });
    }

    // If it's a single object {...}, wrap in array [...]
    if (s.startsWith('{') && s.endsWith('}')) {
      s = `[${s}]`;
    }
    return s;
  }

  return s;
}

/**
 * Safely parses items from any format (Array, standard JSON string, or AppsScript format)
 * Returns a valid StockItem[] array. Never throws SyntaxError or crashes the console.
 */
export function safeParseItems(rawItems: any): StockItem[] {
  if (!rawItems) return [];

  // Case 1: Already an array
  if (Array.isArray(rawItems)) {
    return rawItems
      .filter((it) => it && typeof it === 'object')
      .map((it, idx) => ({
        id: String(it.id || `item-${idx}`),
        sku: String(it.sku || ''),
        barcode: String(it.barcode || it.sku || ''),
        name: String(it.name || ''),
        location: String(it.location || 'A1'),
        category: String(it.category || 'ทั่วไป'),
        systemQty: Number(it.systemQty ?? 0),
        scannedQty: Number(it.scannedQty ?? 0),
        variance: Number(it.variance ?? (Number(it.scannedQty ?? 0) - Number(it.systemQty ?? 0))),
        status: it.status || (Number(it.scannedQty ?? 0) === Number(it.systemQty ?? 0) ? 'MATCH' : Number(it.scannedQty ?? 0) < Number(it.systemQty ?? 0) ? 'SHORTAGE' : 'OVER'),
        color: it.color || (Number(it.scannedQty ?? 0) === Number(it.systemQty ?? 0) ? 'GREEN' : Number(it.scannedQty ?? 0) < Number(it.systemQty ?? 0) ? 'RED' : 'YELLOW'),
        unitPrice: Number(it.unitPrice ?? 0),
        lastScannedAt: it.lastScannedAt ? String(it.lastScannedAt) : undefined,
        notes: it.notes ? String(it.notes) : undefined,
      }));
  }

  // Case 2: String format
  if (typeof rawItems === 'string') {
    const trimmed = rawItems.trim();
    if (!trimmed || trimmed === '[]' || trimmed === '{}') return [];

    // Attempt 1: Standard JSON parse
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return safeParseItems(parsed);
      }
      if (parsed && typeof parsed === 'object') {
        return safeParseItems([parsed]);
      }
    } catch {
      // Attempt 2: Sanitize AppsScript / non-standard string then parse
      try {
        const sanitized = sanitizeItemsString(trimmed);
        const parsed = JSON.parse(sanitized);
        if (Array.isArray(parsed)) {
          return safeParseItems(parsed);
        }
        if (parsed && typeof parsed === 'object') {
          return safeParseItems([parsed]);
        }
      } catch {
        // Suppress error and return clean empty array as requested
        return [];
      }
    }
  }

  // Case 3: Single object
  if (typeof rawItems === 'object' && rawItems !== null) {
    if (rawItems.sku || rawItems.name) {
      return safeParseItems([rawItems]);
    }
  }

  return [];
}

/**
 * Safely parses any JSON string with fallback, suppressing SyntaxError
 */
export function safeParseJson<T>(raw: any, fallback: T): T {
  if (raw === null || raw === undefined || raw === '') return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Safely writes to LocalStorage, handling QuotaExceededError automatically
 * Clears old backup caches if quota is reached or skips silently.
 */
export function safeSetLocalStorage(key: string, value: any): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, str);
    return true;
  } catch (e: any) {
    // Check if error is QuotaExceededError
    const isQuotaError = 
      e?.name === 'QuotaExceededError' || 
      e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e?.code === 22 || 
      e?.code === 1014;

    if (isQuotaError) {
      try {
        // Free up space by removing older/temporary caches
        localStorage.removeItem('stock_branches_cache');
        localStorage.removeItem('STOCK_ENGINE_REAL_DATA_BACKUP');
        // Try saving once more
        const str = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, str);
        return true;
      } catch {
        // If still full, skip quietly without breaking the app
        return false;
      }
    }
    return false;
  }
}

/**
 * Safely reads from LocalStorage with fallback
 */
export function safeGetLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return safeParseJson<T>(item, fallback);
  } catch {
    return fallback;
  }
}

/**
 * Safely removes key from LocalStorage
 */
export function safeRemoveLocalStorage(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
