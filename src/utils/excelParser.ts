import * as XLSX from 'xlsx';
import { StockItem } from '../types';
import { calculateItemVariance } from './stockCalculations';

export interface ImportedRow {
  sku?: string;
  barcode?: string;
  name?: string;
  location?: string;
  bin?: string;
  category?: string;
  systemQty?: number;
  scannedQty?: number;
  unitPrice?: number;
  [key: string]: unknown;
}

/**
 * Parses Excel (.xlsx, .xls, .csv) or JSON file buffer into StockItem array
 */
export async function parseMasterFile(file: File): Promise<Omit<StockItem, 'id'>[]> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.json')) {
    const text = await file.text();
    const json = JSON.parse(text);
    const rows = Array.isArray(json) ? json : json.items || [];
    return processRawRows(rows);
  } else {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<ImportedRow>(worksheet, { defval: '' });
    return processRawRows(rawRows);
  }
}

function getValueFromRow(row: Record<string, unknown>, possibleKeys: string[]): string {
  const rowKeys = Object.keys(row);
  for (const pKey of possibleKeys) {
    const targetNorm = pKey.toLowerCase().replace(/[\s_]/g, '');
    for (const rKey of rowKeys) {
      const rKeyNorm = rKey.toLowerCase().replace(/[\s_]/g, '');
      if (rKeyNorm === targetNorm) {
        const val = row[rKey];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }
  return '';
}

function processRawRows(rows: ImportedRow[]): Omit<StockItem, 'id'>[] {
  return rows.map((row, index) => {
    const record = row as Record<string, unknown>;

    const sku =
      getValueFromRow(record, ['รหัสสินค้า', 'sku', 'productcode', 'barcode', 'บาร์โค้ด']) ||
      `SKU-${index + 1001}`;

    const barcode =
      getValueFromRow(record, ['บาร์โค้ด', 'barcode', 'รหัสสินค้า', 'sku']) || sku;

    const name =
      getValueFromRow(record, ['ชื่อสินค้า', 'name', 'description', 'รายละเอียด']) ||
      `สินค้า ${sku}`;

    // Extract exact location / bin code from Excel file (e.g. SHT-1-1, DM-1-1, ตำแหน่งหยิบชั่วคราว)
    const location =
      getValueFromRow(record, [
        'ตำแหน่ง',
        'ตำแหน่งจัดเก็บ',
        'เลขลัง',
        'ตำแหน่งลัง',
        'รหัสลัง',
        'location',
        'bin',
        'rack',
        'shelf',
        'box',
        'พื้นที่คลังสินค้า',
      ]) || 'ไม่ระบุตำแหน่ง';

    const category =
      getValueFromRow(record, ['หมวดหมู่', 'category', 'กลุ่มสินค้า', 'ประเภท']) || 'ทั่วไป';

    const systemQtyRaw = getValueFromRow(record, [
      'จำนวน',
      'systemqty',
      'system_qty',
      'จำนวนตามระบบ',
      'qty',
      'quantity',
    ]);
    const systemQty = Number(systemQtyRaw) || 0;

    const scannedQtyRaw = getValueFromRow(record, [
      'จำนวนสแกนจริง',
      'จำนวนสแกน',
      'scannedqty',
      'scanned_qty',
      'จำนวนนับได้',
    ]);
    const scannedQty = Number(scannedQtyRaw) || 0;

    const unitPriceRaw = getValueFromRow(record, ['ราคาต่อหน่วย', 'unitprice', 'price', 'ราคา']);
    const unitPrice = Number(unitPriceRaw) || 0;

    const { variance, status, color } = calculateItemVariance(systemQty, scannedQty);

    return {
      sku,
      barcode,
      name,
      location,
      category,
      systemQty,
      scannedQty,
      variance,
      status,
      color,
      unitPrice,
    };
  });
}

/**
 * Downloads a sample Excel template matching the exact format shown in user uploads
 */
export function downloadSampleExcelTemplate() {
  const sampleData = [
    {
      'ชื่อสินค้า': 'ฮิญาบ NUH CLASSIC - ทรงฟองน้ำตาราง',
      'รหัสสินค้า': 'HJNU-FN-N-A68-L-KP',
      'จำนวน': 10,
      'จำนวนนับได้': 10,
      'ตำแหน่ง': 'SHT-1-1',
      'ประเภทตำแหน่ง': 'ตำแหน่งหยิบสินค้า',
      'พื้นที่คลังสินค้า': 'คลังสินค้าชำรุด',
      'หมวดหมู่': 'HJ',
    },
    {
      'ชื่อสินค้า': 'ฮิญาบ NUH CLASSIC - ทรงตาลากง',
      'รหัสสินค้า': 'HJNU-TLK-A68-S-MS',
      'จำนวน': 15,
      'จำนวนนับได้': 14,
      'ตำแหน่ง': 'DM-1-1',
      'ประเภทตำแหน่ง': 'ตำแหน่งหยิบสินค้า',
      'พื้นที่คลังสินค้า': 'คลังสินค้าชำรุด',
      'หมวดหมู่': 'HJ',
    },
    {
      'ชื่อสินค้า': 'ชุดเดรสอาบาย่า NUH AUDREY - ผ่าหน้าทรงสุภาพ',
      'รหัสสินค้า': 'JB69-ABY-BIG-ADR-PC-S-WH',
      'จำนวน': 5,
      'จำนวนนับได้': 5,
      'ตำแหน่ง': 'ตำแหน่งหยิบชั่วคราว',
      'ประเภทตำแหน่ง': 'ตำแหน่งหยิบชั่วคราว',
      'พื้นที่คลังสินค้า': 'คลังสินค้าชำรุด',
      'หมวดหมู่': 'JB',
    },
    {
      'ชื่อสินค้า': 'อินเนอร์สวม NUH INNER 2024 - แบบยาว',
      'รหัสสินค้า': 'INN24-NANO-Y-BLACK',
      'จำนวน': 20,
      'จำนวนนับได้': 21,
      'ตำแหน่ง': 'SHT-1-1',
      'ประเภทตำแหน่ง': 'ตำแหน่งหยิบสินค้า',
      'พื้นที่คลังสินค้า': 'คลังสินค้าชำรุด',
      'หมวดหมู่': 'INN',
    },
    {
      'ชื่อสินค้า': 'เข็มประดับ NUH',
      'รหัสสินค้า': 'KM-L061',
      'จำนวน': 50,
      'จำนวนนับได้': 48,
      'ตำแหน่ง': 'SHT-1-1',
      'ประเภทตำแหน่ง': 'ตำแหน่งหยิบสินค้า',
      'พื้นที่คลังสินค้า': 'คลังสินค้าชำรุด',
      'หมวดหมู่': 'KM',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Data');
  XLSX.writeFile(workbook, 'ตัวอย่างไฟล์นำเข้าสต็อก_MasterData.xlsx');
}

/**
 * Downloads stock items report as Excel spreadsheet
 */
export function exportToExcel(items: StockItem[], filename = 'stock_counting_report.xlsx') {
  const exportData = items.map((item) => ({
    'รหัสสินค้า (SKU)': item.sku,
    'บาร์โค้ด (Barcode)': item.barcode,
    'ชื่อสินค้า': item.name,
    'หมวดหมู่': item.category,
    'ตำแหน่ง (Location/Bin)': item.location,
    'จำนวนตามระบบ (System Qty)': item.systemQty,
    'จำนวนสแกนจริง (Scanned Qty)': item.scannedQty,
    'ผลต่าง (Variance)': item.variance,
    'สถานะ (Status)': item.status,
    'สีสถานะ (Color)': item.color,
    'ราคาต่อหน่วย': item.unitPrice || 0,
    'สแกนล่าสุด': item.lastScannedAt ? new Date(item.lastScannedAt).toLocaleString('th-TH') : '-',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Audit');
  XLSX.writeFile(workbook, filename);
}
