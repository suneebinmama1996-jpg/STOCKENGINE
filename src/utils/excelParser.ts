import * as XLSX from 'xlsx';
import { StockItem, MonthlyAuditScorecard, MonthlyCategoryBreakdown, MonthlyPerformanceSummary } from '../types';
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
    const targetNorm = pKey.toLowerCase().replace(/[\s_\-/\\]/g, '');
    for (const rKey of rowKeys) {
      const rKeyNorm = rKey.toLowerCase().replace(/[\s_\-/\\]/g, '');
      if (rKeyNorm === targetNorm || rKeyNorm.includes(targetNorm) || targetNorm.includes(rKeyNorm)) {
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
    
    const skuRaw = getValueFromRow(record, ['รหัสสินค้า', 'sku', 'productcode', 'itemcode', 'itemno', 'code', 'รหัส', 'barcode', 'บาร์โค้ด']);
    const barcodeRaw = getValueFromRow(record, ['บาร์โค้ด', 'barcode', 'รหัสบาร์โค้ด', 'upc', 'ean', 'รหัสสินค้า', 'sku', 'productcode']);
    const nameRaw = getValueFromRow(record, ['ชื่อสินค้า', 'name', 'productname', 'description', 'รายละเอียด', 'ชื่อ', 'รายการ', 'item']);
    
    const sku = skuRaw || barcodeRaw || nameRaw || `SKU-${index + 1001}`;
    const barcode = barcodeRaw || sku;
    const name = nameRaw || `สินค้า ${sku}`;

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

    // Reset scanned quantity to 0 by default on newly imported files so count starts from 0
    const scannedQty = 0;

    const unitPriceRaw = getValueFromRow(record, ['ราคาต่อหน่วย', 'unitprice', 'price', 'ราคา']);
    const unitPrice = Number(unitPriceRaw) || 0;

    const batchId = getValueFromRow(record, ['รอบการนับ', 'batchid', 'batch_id', 'batch', 'รอบ', 'audit_round', 'round']);
    const importDate = getValueFromRow(record, ['วันที่นำเข้า', 'importdate', 'import_date', 'date_imported']);
    const auditDate = getValueFromRow(record, ['วันที่ตรวจนับ', 'auditdate', 'audit_date', 'date']);
    const isNewItemRaw = getValueFromRow(record, ['isnewitem', 'is_new_item', 'สินค้าใหม่', 'new_sku']);
    const isNewItem = isNewItemRaw === 'true' || isNewItemRaw === 'TRUE' || isNewItemRaw === '1' || isNewItemRaw === 'ใช่';

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
      ...(batchId ? { batchId } : {}),
      ...(importDate ? { importDate } : {}),
      ...(auditDate ? { auditDate } : {}),
      ...(isNewItem ? { isNewItem: true } : {}),
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

/**
 * Downloads full Monthly Audit & Cycle Count Performance Report as Excel spreadsheet with multiple sheets
 */
export function exportMonthlyPerformanceToExcel(
  monthLabel: string,
  scorecards: MonthlyAuditScorecard[],
  categoryBreakdowns: MonthlyCategoryBreakdown[],
  summary?: MonthlyPerformanceSummary
) {
  const sanitizedLabel = monthLabel.replace(/[\s/]/g, '_');
  const filename = `รายงานผลการตรวจนับประจำเดือน_${sanitizedLabel}.xlsx`;

  const workbook = XLSX.utils.book_new();

  // Sheet 1: Executive Summary
  if (summary) {
    const summaryData = [
      { 'หัวข้อสรุปภาพรวม': 'ประจำเดือน', 'ค่าสถิติ': summary.monthLabel },
      { 'หัวข้อสรุปภาพรวม': 'TOTAL KPI STOCK (คะแนนเต็ม 100)', 'ค่าสถิติ': `${summary.totalKpiStockScore} / 100 (เกรด ${summary.kpiGrade})` },
      { 'หัวข้อสรุปภาพรวม': '  - เสาหลัก 1: ความแม่นยำสต็อก (น้ำหนัก 40)', 'ค่าสถิติ': `${summary.kpiPillars?.stockAccuracyScore ?? 40} / 40` },
      { 'หัวข้อสรุปภาพรวม': '  - เสาหลัก 2: การส่งรายงานตรงเวลา (น้ำหนัก 30)', 'ค่าสถิติ': `${summary.kpiPillars?.submissionScore ?? 30} / 30` },
      { 'หัวข้อสรุปภาพรวม': '  - เสาหลัก 3: ควบคุมสต็อกขาด/เกิน (น้ำหนัก 20)', 'ค่าสถิติ': `${summary.kpiPillars?.varianceControlScore ?? 20} / 20` },
      { 'หัวข้อสรุปภาพรวม': '  - เสาหลัก 4: การกระทบยอด & ธรรมาภิบาล (น้ำหนัก 10)', 'ค่าสถิติ': `${summary.kpiPillars?.auditResolutionScore ?? 10} / 10` },
      { 'หัวข้อสรุปภาพรวม': 'จำนวนสาขาทั้งหมด', 'ค่าสถิติ': `${summary.totalBranches} สาขา` },
      { 'หัวข้อสรุปภาพรวม': 'สาขาที่ตรวจนับในเดือนนี้', 'ค่าสถิติ': `${summary.activeBranches} สาขา` },
      { 'หัวข้อสรุปภาพรวม': 'อัตราการส่งงานเฉลี่ย (Submission Rate)', 'ค่าสถิติ': `${summary.overallSubmissionRate}%` },
      { 'หัวข้อสรุปภาพรวม': 'ความแม่นยำรวม SKUA (SKU Level Accuracy)', 'ค่าสถิติ': `${summary.overallAccuracyRate}%` },
      { 'หัวข้อสรุปภาพรวม': 'ความแม่นยำรวม QA (Unit Level Accuracy)', 'ค่าสถิติ': `${summary.overallQaAccuracyRate ?? summary.overallAccuracyRate}%` },
      { 'หัวข้อสรุปภาพรวม': 'สาขาเกรด A (>=95%)', 'ค่าสถิติ': `${summary.gradeACount} สาขา` },
      { 'หัวข้อสรุปภาพรวม': 'สาขาเกรด B (85-94%)', 'ค่าสถิติ': `${summary.gradeBCount} สาขา` },
      { 'หัวข้อสรุปภาพรวม': 'สาขาเกรด C (<85%)', 'ค่าสถิติ': `${summary.gradeCCount} สาขา` },
      { 'หัวข้อสรุปภาพรวม': 'หมวดหมู่ที่ตรวจนับบ่อยที่สุด', 'ค่าสถิติ': summary.topAuditedCategory },
      { 'หัวข้อสรุปภาพรวม': 'หมวดหมู่ที่มีสต็อกขาดสูงสุด', 'ค่าสถิติ': summary.highestShortageCategory },
      { 'หัวข้อสรุปภาพรวม': 'หมวดหมู่ที่มีสต็อกเกินสูงสุด', 'ค่าสถิติ': summary.highestOverCategory },
      { 'หัวข้อสรุปภาพรวม': 'จำนวนสินค้าระบบทั้งหมด', 'ค่าสถิติ': `${summary.totalSystemUnits.toLocaleString()} ชิ้น` },
      { 'หัวข้อสรุปภาพรวม': 'จำนวนสินค้าสแกนจริงทั้งหมด', 'ค่าสถิติ': `${summary.totalScannedUnits.toLocaleString()} ชิ้น` },
      { 'หัวข้อสรุปภาพรวม': 'ยอดสต็อกขาดรวม (Shortage Units)', 'ค่าสถิติ': `${summary.totalShortageUnits.toLocaleString()} ชิ้น` },
      { 'หัวข้อสรุปภาพรวม': 'ยอดสต็อกเกินรวม (Over Units)', 'ค่าสถิติ': `${summary.totalOverUnits.toLocaleString()} ชิ้น` },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, wsSummary, 'ภาพรวมผู้บริหาร (Overview & KPI)');
  }

  // Sheet 2: Branch Scorecard
  const scorecardData = scorecards.map((s, idx) => ({
    'ลำดับ': idx + 1,
    'รหัสสาขา': s.branchCode,
    'ชื่อสาขา': s.branchName,
    'ภูมิภาค': s.region,
    'ผู้ตรวจนับที่รับผิดชอบ': s.assignedAuditor,
    'รอบที่ส่งจริง / รอบที่ต้องส่ง': `${s.submittedRounds} / ${s.requiredRounds} รอบ`,
    'อัตราการส่งงาน (%)': `${s.submissionRate}%`,
    'หมวดหมู่ที่ตรวจนับ': s.categoriesAudited.join(', ') || 'ทั่วไป',
    'รายการสินค้าทั้งหมด (SKU)': s.totalItems,
    'รายการตรงตามระบบ (MATCH SKU)': s.matchCount,
    'รายการขาด (SHORTAGE SKU)': s.shortageCount,
    'รายการเกิน (OVER SKU)': s.overCount,
    'จำนวนระบบรวม (System Units)': s.totalSystemQty,
    'จำนวนสแกนจริงรวม (Scanned Units)': s.totalScannedQty,
    'ยอดสต็อกขาด (ชิ้น)': s.shortageQty,
    'ยอดสต็อกเกิน (ชิ้น)': s.overQty,
    'ผลต่างสุทธิ (Net Variance)': s.netVariance,
    '% ความแม่นยำ QA (Unit Accuracy)': `${s.qaAccuracyRate ?? s.accuracyRate}%`,
    '% ความแม่นยำ SKUA (SKU Accuracy)': `${s.skuaAccuracyRate ?? s.accuracyRate}%`,
    'เกรดประเมิน (Grade)': s.grade,
    'สถานะปัจจุบัน': s.currentStatus,
    'วันที่ตรวจล่าสุด': s.lastAuditDate || '-',
  }));
  const wsScorecard = XLSX.utils.json_to_sheet(scorecardData);
  XLSX.utils.book_append_sheet(workbook, wsScorecard, 'คะแนนรายสาขา (Scorecard)');

  // Sheet 3: Category Breakdown
  const categoryData = categoryBreakdowns.map((c, idx) => ({
    'ลำดับ': idx + 1,
    'รหัสหมวดหมู่': c.categoryCode || c.category,
    'หมวดหมู่สินค้า': c.categoryLabel || c.category,
    'สถานะส่งข้อมูล': c.completedBranchesCount && c.totalBranchesAuditing ? `${c.completedBranchesCount}/${c.totalBranchesAuditing} สาขา` : 'ส่งครบแล้ว',
    'จำนวนรายการสินค้า (SKU)': c.itemsCount,
    'รายการตรงตามระบบ (MATCH)': c.matchCount,
    'รายการสต็อกขาด (SHORTAGE)': c.shortageCount,
    'รายการสต็อกเกิน (OVER)': c.overCount,
    'รายการขาด-สลับ / รหัสสลับ (SWAP)': c.mismatchSwapCount || 0,
    'จำนวนระบบ (System Units)': c.totalSystemQty,
    'จำนวนสแกนจริง (Scanned Units)': c.totalScannedQty,
    'ยอดขาดรวม (ชิ้น)': c.shortageQty,
    'ยอดเกินรวม (ชิ้น)': c.overQty,
    'ผลต่างสุทธิ': c.netVariance,
    'ความแม่นยำ (%)': `${c.accuracyRate}%`,
    'อัตราสต็อกขาด (%)': `${c.shortageRate}%`,
    'อัตราสต็อกเกิน (%)': `${c.overRate}%`,
    'ระดับความเสี่ยง (Risk Level)': c.riskLevel || 'LOW',
  }));
  const wsCategory = XLSX.utils.json_to_sheet(categoryData);
  XLSX.utils.book_append_sheet(workbook, wsCategory, 'วิเคราะห์หมวดหมู่ (Category)');

  XLSX.writeFile(workbook, filename);
}

