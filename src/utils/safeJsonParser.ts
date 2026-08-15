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

  const extractItem = (it: any, idx: number): StockItem => {
    if (!it || typeof it !== 'object') {
      return {
        id: `item-${idx}`,
        sku: `SKU-${idx + 1}`,
        barcode: `SKU-${idx + 1}`,
        name: `สินค้า ${idx + 1}`,
        location: 'ไม่ระบุตำแหน่ง',
        category: 'ทั่วไป',
        systemQty: 0,
        scannedQty: 0,
        variance: 0,
        status: 'MATCH',
        color: 'GREEN',
        unitPrice: 0,
      };
    }

    const getVal = (keys: string[]): string => {
      for (const k of keys) {
        if (it[k] !== undefined && it[k] !== null && String(it[k]).trim() !== '') {
          return String(it[k]).trim();
        }
      }
      const itKeys = Object.keys(it);
      for (const k of keys) {
        const targetNorm = k.toLowerCase().replace(/[\s_\-]/g, '');
        for (const rKey of itKeys) {
          const rKeyNorm = rKey.toLowerCase().replace(/[\s_\-]/g, '');
          if (rKeyNorm === targetNorm) {
            const val = it[rKey];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              return String(val).trim();
            }
          }
        }
      }
      return '';
    };

    const skuRaw = getVal([
      'sku', 'SKU', 'รหัสสินค้า', 'productCode', 'product_code', 'itemCode',
      'item_code', 'code', 'รหัส', 'itemNo', 'item_no', 'itemNumber'
    ]);
    const barcodeRaw = getVal([
      'barcode', 'บาร์โค้ด', 'Barcode', 'BARCODE', 'รหัสบาร์โค้ด',
      'upc', 'ean', 'qr', 'qrcode'
    ]);
    const nameRaw = getVal([
      'name', 'ชื่อสินค้า', 'productName', 'product_name', 'description',
      'รายละเอียด', 'ชื่อ', 'รายการ', 'item'
    ]);
    const locationRaw = getVal([
      'location', 'ตำแหน่ง', 'ตำแหน่งจัดเก็บ', 'เลขลัง', 'รหัสลัง',
      'ตำแหน่งลัง', 'bin', 'rack', 'shelf', 'box', 'พื้นที่คลังสินค้า', 'ลัง'
    ]) || 'ไม่ระบุตำแหน่ง';
    const categoryRaw = getVal([
      'category', 'หมวดหมู่', 'กลุ่มสินค้า', 'ประเภท', 'dept', 'department'
    ]) || 'ทั่วไป';

    // Establish non-empty SKU, Barcode, and Name
    const finalSku = skuRaw || barcodeRaw || nameRaw || (it.id && !String(it.id).startsWith('item-') ? String(it.id) : `SKU-${idx + 1001}`);
    const finalBarcode = barcodeRaw || finalSku;
    const finalName = nameRaw || (finalSku ? `สินค้า ${finalSku}` : `สินค้าลำดับที่ ${idx + 1}`);

    const systemQtyRaw = it.systemQty ?? it['จำนวน'] ?? it['จำนวนตามระบบ'] ?? it.quantity ?? it.qty ?? 0;
    const scannedQtyRaw = it.scannedQty ?? it['จำนวนสแกน'] ?? it['จำนวนสแกนจริง'] ?? it['จำนวนนับได้'] ?? 0;
    const systemQty = Number(systemQtyRaw) || 0;
    const scannedQty = Number(scannedQtyRaw) || 0;
    const unitPriceRaw = it.unitPrice ?? it['ราคา'] ?? it['ราคาต่อหน่วย'] ?? it.price ?? 0;
    const unitPrice = Number(unitPriceRaw) || 0;

    return {
      id: String(it.id || `item-${idx}`),
      sku: finalSku,
      barcode: finalBarcode,
      name: finalName,
      location: locationRaw,
      category: categoryRaw,
      systemQty,
      scannedQty,
      variance: Number(it.variance ?? (scannedQty - systemQty)),
      status: it.status || (scannedQty === systemQty ? 'MATCH' : scannedQty < systemQty ? 'SHORTAGE' : 'OVER'),
      color: it.color || (scannedQty === systemQty ? 'GREEN' : scannedQty < systemQty ? 'RED' : 'YELLOW'),
      unitPrice,
      lastScannedAt: it.lastScannedAt ? String(it.lastScannedAt) : undefined,
      notes: it.notes ? String(it.notes) : undefined,
    };
  };

  // Case 1: Already an array
  if (Array.isArray(rawItems)) {
    return rawItems
      .filter((it) => it && typeof it === 'object')
      .map((it, idx) => extractItem(it, idx));
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
