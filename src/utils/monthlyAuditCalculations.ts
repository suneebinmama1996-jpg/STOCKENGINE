import { Branch, MonthlyAuditScorecard, MonthlyCategoryBreakdown, MonthlyPerformanceSummary } from '../types';
import { normalizeBranchesList } from './branchNormalizer';
import { safeParseItems } from './safeJsonParser';

export const THAI_MONTH_NAMES = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

/**
 * Returns formatted Thai month string, e.g. "สิงหาคม 2026"
 */
export function formatThaiMonth(yearMonthStr: string): string {
  if (!yearMonthStr || !yearMonthStr.includes('-')) return yearMonthStr;
  const [year, month] = yearMonthStr.split('-');
  const monthIdx = parseInt(month, 10) - 1;
  const monthName = THAI_MONTH_NAMES[monthIdx] || `เดือน ${month}`;
  return `${monthName} ${year}`;
}

/**
 * Generates month choices for selection (e.g. past 6 months + next 6 months)
 */
export function generateMonthOptions(currentYearMonth = '2026-08'): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  const [currYearStr, currMonthStr] = currentYearMonth.split('-');
  const baseYear = parseInt(currYearStr, 10) || 2026;
  const baseMonth = parseInt(currMonthStr, 10) || 8;

  // Generate range from -5 months to +2 months
  for (let offset = -5; offset <= 2; offset++) {
    const d = new Date(baseYear, baseMonth - 1 + offset, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const ym = `${y}-${m}`;
    options.push({
      value: ym,
      label: formatThaiMonth(ym),
    });
  }

  // Ensure currentYearMonth is in list
  if (!options.some((o) => o.value === currentYearMonth)) {
    options.unshift({
      value: currentYearMonth,
      label: formatThaiMonth(currentYearMonth),
    });
  }

  return options;
}

// Standard Category Definitions - Clean Category Codes Only (as per HQ Weekly/Monthly Standards)
export const STANDARD_CATEGORY_ORDER = [
  'SK',
  'SKMC',
  'HT',
  'PN/SY/SLT/TS',
  'HJ',
  'PP',
  'INN',
  'KK',
  'JB',
  'ผ้าละหมาด',
  'KM',
  'SPORT',
  'BOX/BAG',
  'GIFT',
  'ของแถม',
  'เครื่องประดับ',
  'ส่งเสริมการขาย',
] as const;

export const STANDARD_CATEGORY_MAPPINGS: Record<string, { code: string; label: string; desc: string }> = {
  SK: { code: 'SK', label: 'SK', desc: 'บำรุงผิวหน้าและผิวกายทั่วไป' },
  SKMC: { code: 'SKMC', label: 'SKMC', desc: 'เคาน์เตอร์แบรนด์และพรีเมียมสกินแคร์' },
  HT: { code: 'HT', label: 'HT', desc: 'แชมพู ทรีทเม้นท์ เซรั่มผม' },
  'PN/SY/SLT/TS': { code: 'PN/SY/SLT/TS', label: 'PN/SY/SLT/TS', desc: 'แป้ง/ลิป/เซรั่ม/โทนเนอร์' },
  SY: { code: 'PN/SY/SLT/TS', label: 'PN/SY/SLT/TS', desc: 'เซรั่ม' },
  PN: { code: 'PN/SY/SLT/TS', label: 'PN/SY/SLT/TS', desc: 'แป้งพัฟ/แป้งฝุ่น' },
  SLT: { code: 'PN/SY/SLT/TS', label: 'PN/SY/SLT/TS', desc: 'ลิปสติก/ทินท์' },
  TS: { code: 'PN/SY/SLT/TS', label: 'PN/SY/SLT/TS', desc: 'โทนเนอร์/สเปรย์' },
  HJ: { code: 'HJ', label: 'HJ', desc: 'ผ้าคลุม เครื่องแต่งกายมุสลิม' },
  PP: { code: 'PP', label: 'PP', desc: 'ของใช้ในชีวิตประจำวัน' },
  INN: { code: 'INN', label: 'INN', desc: 'ผลิตภัณฑ์เสริมอาหาร อินเนอร์บิวตี้' },
  KK: { code: 'KK', label: 'KK', desc: 'K-Beauty & J-Beauty Cosmetics' },
  JB: { code: 'JB', label: 'JB', desc: 'อุปกรณ์แต่งหน้าและเครื่องประดับ' },
  ผ้าละหมาด: { code: 'ผ้าละหมาด', label: 'ผ้าละหมาด', desc: 'ชุดและผ้าละหมาด' },
  KM: { code: 'KM', label: 'KM', desc: 'ของว่าง เครื่องดื่ม ขนมนำเข้า' },
  SPORT: { code: 'SPORT', label: 'SPORT', desc: 'อุปกรณ์ออกกำลังกายและสุขภาพ' },
  'BOX/BAG': { code: 'BOX/BAG', label: 'BOX/BAG', desc: 'อุปกรณ์แพ็คเกจจิ้ง' },
  BOX: { code: 'BOX/BAG', label: 'BOX/BAG', desc: 'อุปกรณ์แพ็คเกจจิ้ง' },
  BAG: { code: 'BOX/BAG', label: 'BOX/BAG', desc: 'ถุงบรรจุภัณฑ์' },
  GIFT: { code: 'GIFT', label: 'GIFT', desc: 'ชุดของขวัญโปรโมชั่น' },
  ของแถม: { code: 'ของแถม', label: 'ของแถม', desc: 'ของแถมส่งเสริมการขาย' },
  เครื่องประดับ: { code: 'เครื่องประดับ', label: 'เครื่องประดับ', desc: 'เครื่องประดับแฟชั่น' },
  ส่งเสริมการขาย: { code: 'ส่งเสริมการขาย', label: 'ส่งเสริมการขาย', desc: 'สื่อและอุปกรณ์ส่งเสริมการขาย' },
  OTHER: { code: 'OTHER', label: 'OTHER', desc: 'หมวดหมู่อื่นๆ' },
};

/**
 * Normalizes and categorizes raw category string into clean standard short code
 */
export function getCategoryInfo(rawCategory: string): { code: string; label: string; desc: string } {
  const clean = (rawCategory || '').trim();
  if (!clean) {
    return { code: 'OTHER', label: 'OTHER', desc: 'หมวดหมู่อื่นๆ' };
  }

  const upper = clean.toUpperCase();

  // 1. Direct exact key match
  if (STANDARD_CATEGORY_MAPPINGS[clean]) {
    return STANDARD_CATEGORY_MAPPINGS[clean];
  }
  if (STANDARD_CATEGORY_MAPPINGS[upper]) {
    return STANDARD_CATEGORY_MAPPINGS[upper];
  }

  // 2. Check if string starts with code followed by space or hyphen (e.g. "SK - สกินแคร์" -> "SK")
  for (const [key, info] of Object.entries(STANDARD_CATEGORY_MAPPINGS)) {
    const keyUpper = key.toUpperCase();
    if (
      upper === keyUpper ||
      upper.startsWith(`${keyUpper} `) ||
      upper.startsWith(`${keyUpper}-`) ||
      upper.startsWith(`${keyUpper} -`) ||
      upper.startsWith(`${keyUpper}/`) ||
      clean.startsWith(`${key} `) ||
      clean.startsWith(`${key}-`)
    ) {
      return info;
    }
  }

  // 3. Check Thai substring matches
  if (clean.includes('ผ้าละหมาด')) return STANDARD_CATEGORY_MAPPINGS['ผ้าละหมาด'];
  if (clean.includes('ของแถม') || clean.includes('แถม')) return STANDARD_CATEGORY_MAPPINGS['ของแถม'];
  if (clean.includes('เครื่องประดับ')) return STANDARD_CATEGORY_MAPPINGS['เครื่องประดับ'];
  if (clean.includes('ส่งเสริมการขาย') || clean.includes('โปรโมชั่น')) return STANDARD_CATEGORY_MAPPINGS['ส่งเสริมการขาย'];
  if (clean.includes('สกินแคร์เคาน์เตอร์') || clean.includes('เคาน์เตอร์')) return STANDARD_CATEGORY_MAPPINGS['SKMC'];
  if (clean.includes('สกินแคร์') || clean.includes('บำรุงผิว')) return STANDARD_CATEGORY_MAPPINGS['SK'];
  if (clean.includes('ผม') || clean.includes('แชมพู') || clean.includes('ทรีทเม้นท์')) return STANDARD_CATEGORY_MAPPINGS['HT'];
  if (clean.includes('ฮิญาบ') || clean.includes('ผ้าคลุม')) return STANDARD_CATEGORY_MAPPINGS['HJ'];
  if (clean.includes('ของใช้')) return STANDARD_CATEGORY_MAPPINGS['PP'];
  if (clean.includes('อาหารเสริม') || clean.includes('วิตามิน')) return STANDARD_CATEGORY_MAPPINGS['INN'];
  if (clean.includes('ขนม') || clean.includes('เครื่องดื่ม')) return STANDARD_CATEGORY_MAPPINGS['KM'];
  if (clean.includes('กีฬา') || clean.includes('ฟิตเนส')) return STANDARD_CATEGORY_MAPPINGS['SPORT'];
  if (clean.includes('กล่อง') || clean.includes('ถุง') || clean.includes('แพ็ค')) return STANDARD_CATEGORY_MAPPINGS['BOX/BAG'];
  if (clean.includes('ของขวัญ') || clean.includes('กิฟต์')) return STANDARD_CATEGORY_MAPPINGS['GIFT'];

  // Clean code fallback - extract first word/token if alphanumeric
  const firstWord = clean.split(/[\s-]+/)[0].toUpperCase();
  if (STANDARD_CATEGORY_MAPPINGS[firstWord]) {
    return STANDARD_CATEGORY_MAPPINGS[firstWord];
  }

  return {
    code: clean,
    label: clean,
    desc: 'หมวดหมู่สินค้าในระบบ',
  };
}

/**
 * Calculates branch grade based on accuracy rate
 */
export function calculateBranchGrade(accuracyRate: number): 'A' | 'B' | 'C' | 'D' {
  if (accuracyRate >= 95) return 'A';
  if (accuracyRate >= 85) return 'B';
  if (accuracyRate >= 70) return 'C';
  return 'D';
}

/**
 * Computes monthly performance scorecard for all branches and category breakdown
 */
export function computeMonthlyPerformance(
  branches: Branch[],
  selectedMonthKey = '2026-08'
): {
  scorecards: MonthlyAuditScorecard[];
  categoryBreakdowns: MonthlyCategoryBreakdown[];
  summary: MonthlyPerformanceSummary;
} {
  const cleanBranches = normalizeBranchesList(branches);
  const scorecards: MonthlyAuditScorecard[] = [];
  const categoryMap = new Map<
    string,
    {
      code: string;
      label: string;
      itemsCount: number;
      totalScannedQty: number;
      totalSystemQty: number;
      matchCount: number;
      shortageCount: number;
      overCount: number;
      mismatchSwapCount: number;
      shortageQty: number;
      overQty: number;
      completedBranchesSet: Set<string>;
      auditingBranchesSet: Set<string>;
    }
  >();

  let totalSystemUnitsSum = 0;
  let totalScannedUnitsSum = 0;
  let totalShortageUnitsSum = 0;
  let totalOverUnitsSum = 0;
  let gradeACnt = 0;
  let gradeBCnt = 0;
  let gradeCCnt = 0;

  // Process each branch
  cleanBranches.forEach((branch) => {
    const items = safeParseItems(branch.items);
    
    // Determine effective audit date of the branch
    const branchAuditDate =
      branch.auditDate ||
      (items[0]?.auditDate) ||
      (branch.submittedAt ? branch.submittedAt.slice(0, 10) : '') ||
      new Date().toISOString().slice(0, 10);

    const isSubmitted = branch.auditStatus === 'SUBMITTED';

    // Calculate required rounds in standard 4-week month (e.g. 8 rounds if counting Thurs + Fri, or 4 if 1 round/week)
    const requiredRounds = branch.auditScheduleDay === 'ALL' ? 8 : (branch.auditScheduleDay === 'THURSDAY' || branch.auditScheduleDay === 'FRIDAY' ? 4 : 4);
    
    // Determine completed rounds for this month
    let submittedRounds = 0;
    if (branch.dailyAuditHistory) {
      Object.entries(branch.dailyAuditHistory).forEach(([dateKey, record]) => {
        if (dateKey.startsWith(selectedMonthKey) && record.status === 'SUBMITTED') {
          submittedRounds++;
        }
      });
    }
    if (submittedRounds === 0 && isSubmitted && branchAuditDate.startsWith(selectedMonthKey)) {
      submittedRounds = 1;
    }

    const submissionRate = Math.min(100, Math.round((submittedRounds / Math.max(1, requiredRounds)) * 100));

    // Calculate SKU & Variance Metrics
    let matchCount = 0;
    let shortageCount = 0;
    let overCount = 0;
    let totalSysQty = 0;
    let totalScanQty = 0;
    let branchShortageQty = 0;
    let branchOverQty = 0;
    const categoriesSet = new Set<string>();

    items.forEach((item) => {
      const catInfo = getCategoryInfo(item.category || 'ทั่วไป');
      const catKey = catInfo.code;
      categoriesSet.add(catInfo.label);

      const sysQ = item.systemQty || 0;
      const scnQ = item.scannedQty || 0;
      const diff = scnQ - sysQ;

      totalSysQty += sysQ;
      totalScanQty += scnQ;

      if (item.status === 'MATCH') {
        matchCount++;
      } else if (item.status === 'SHORTAGE') {
        shortageCount++;
        branchShortageQty += Math.abs(item.variance || diff || 0);
      } else if (item.status === 'OVER') {
        overCount++;
        branchOverQty += Math.abs(item.variance || diff || 0);
      }

      // Aggregate into global category map
      if (!categoryMap.has(catKey)) {
        categoryMap.set(catKey, {
          code: catInfo.code,
          label: catInfo.label,
          itemsCount: 0,
          totalScannedQty: 0,
          totalSystemQty: 0,
          matchCount: 0,
          shortageCount: 0,
          overCount: 0,
          mismatchSwapCount: 0,
          shortageQty: 0,
          overQty: 0,
          completedBranchesSet: new Set(),
          auditingBranchesSet: new Set(),
        });
      }
      const catData = categoryMap.get(catKey)!;
      catData.itemsCount++;
      catData.totalSystemQty += sysQ;
      catData.totalScannedQty += scnQ;
      catData.auditingBranchesSet.add(branch.id);
      if (isSubmitted) {
        catData.completedBranchesSet.add(branch.id);
      }

      if (item.status === 'MATCH') {
        catData.matchCount++;
      } else if (item.status === 'SHORTAGE') {
        catData.shortageCount++;
        catData.shortageQty += Math.abs(item.variance || diff || 0);
      } else if (item.status === 'OVER') {
        catData.overCount++;
        catData.overQty += Math.abs(item.variance || diff || 0);
      }

      // Detect potential mismatch / swapped barcode (scanned exists but differs)
      if (item.status !== 'MATCH' && scnQ > 0 && sysQ > 0) {
        catData.mismatchSwapCount++;
      }
    });

    const totalItems = items.length;
    // SKUA Accuracy: Percentage of SKUs with exact 100% quantity match
    const skuaAccuracyRate = totalItems > 0 ? Math.round((matchCount / totalItems) * 1000) / 10 : 100;
    
    // QA Accuracy: Unit-level physical stock match rate (1 - totalUnitVariance / max(1, totalSysQty))
    const totalUnitVariance = branchShortageQty + branchOverQty;
    const rawQaRate = totalSysQty > 0
      ? Math.max(0, Math.min(100, Math.round(((totalSysQty - totalUnitVariance) / totalSysQty) * 1000) / 10))
      : (totalItems > 0 ? skuaAccuracyRate : 100);
    const qaAccuracyRate = rawQaRate >= 0 ? rawQaRate : 0;

    const accuracyRate = skuaAccuracyRate;
    const grade = calculateBranchGrade(accuracyRate);

    if (grade === 'A') gradeACnt++;
    else if (grade === 'B') gradeBCnt++;
    else gradeCCnt++;

    totalSystemUnitsSum += totalSysQty;
    totalScannedUnitsSum += totalScanQty;
    totalShortageUnitsSum += branchShortageQty;
    totalOverUnitsSum += branchOverQty;

    scorecards.push({
      branchId: branch.id,
      branchCode: branch.code,
      branchName: branch.name,
      region: branch.region,
      assignedAuditor: branch.assignedAuditor || 'ยังไม่ระบุ',
      auditScheduleDay: branch.auditScheduleDay || 'OTHER',
      requiredRounds,
      submittedRounds: isSubmitted ? Math.max(1, submittedRounds) : submittedRounds,
      submissionRate: isSubmitted && submissionRate === 0 ? 100 : submissionRate,
      categoriesAudited: Array.from(categoriesSet),
      totalItems,
      totalSystemQty: totalSysQty,
      totalScannedQty: totalScanQty,
      matchCount,
      shortageCount,
      overCount,
      shortageQty: branchShortageQty,
      overQty: branchOverQty,
      netVariance: totalScanQty - totalSysQty,
      accuracyRate,
      qaAccuracyRate,
      skuaAccuracyRate,
      grade,
      currentStatus: branch.auditStatus,
      lastAuditDate: branchAuditDate,
    });
  });

  // Convert Category Map to sorted array
  const categoryBreakdowns: MonthlyCategoryBreakdown[] = Array.from(categoryMap.entries()).map(
    ([, data]) => {
      const accuracyRate =
        data.itemsCount > 0 ? Math.round((data.matchCount / data.itemsCount) * 1000) / 10 : 100;
      const shortageRate =
        data.itemsCount > 0 ? Math.round((data.shortageCount / data.itemsCount) * 1000) / 10 : 0;
      const overRate =
        data.itemsCount > 0 ? Math.round((data.overCount / data.itemsCount) * 1000) / 10 : 0;

      const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
        accuracyRate >= 95 ? 'LOW' : accuracyRate >= 85 ? 'MEDIUM' : 'HIGH';

      return {
        category: data.label,
        categoryCode: data.code,
        categoryLabel: data.label,
        completedBranchesCount: data.completedBranchesSet.size,
        totalBranchesAuditing: data.auditingBranchesSet.size,
        itemsCount: data.itemsCount,
        totalScannedQty: data.totalScannedQty,
        totalSystemQty: data.totalSystemQty,
        matchCount: data.matchCount,
        shortageCount: data.shortageCount,
        overCount: data.overCount,
        mismatchSwapCount: data.mismatchSwapCount,
        shortageQty: data.shortageQty,
        overQty: data.overQty,
        netVariance: data.totalScannedQty - data.totalSystemQty,
        accuracyRate,
        shortageRate,
        overRate,
        riskLevel,
      };
    }
  );

  // Sort categories by frequency / items count
  categoryBreakdowns.sort((a, b) => b.itemsCount - a.itemsCount);

  // Top Audited, Shortage, Over Category summaries
  let topAuditedCategory = 'ไม่มีข้อมูล';
  let highestShortageCategory = 'ไม่มีข้อมูล';
  let highestOverCategory = 'ไม่มีข้อมูล';

  if (categoryBreakdowns.length > 0) {
    topAuditedCategory = `${categoryBreakdowns[0].category} (${categoryBreakdowns[0].itemsCount} รายการ)`;

    const sortedByShortage = [...categoryBreakdowns].sort((a, b) => b.shortageQty - a.shortageQty);
    if (sortedByShortage[0] && sortedByShortage[0].shortageQty > 0) {
      highestShortageCategory = `${sortedByShortage[0].category} (ขาด ${sortedByShortage[0].shortageQty} ชิ้น)`;
    } else {
      highestShortageCategory = 'ไม่มีสต็อกขาด';
    }

    const sortedByOver = [...categoryBreakdowns].sort((a, b) => b.overQty - a.overQty);
    if (sortedByOver[0] && sortedByOver[0].overQty > 0) {
      highestOverCategory = `${sortedByOver[0].category} (เกิน ${sortedByOver[0].overQty} ชิ้น)`;
    } else {
      highestOverCategory = 'ไม่มีสต็อกเกิน';
    }
  }

  const totalBranchesCount = scorecards.length;
  const activeBranches = scorecards.filter((s) => s.currentStatus === 'SUBMITTED' || s.currentStatus === 'IN_PROGRESS').length;
  
  const totalAccSum = scorecards.reduce((acc, s) => acc + s.accuracyRate, 0);
  const overallAccuracyRate = totalBranchesCount > 0 ? Math.round((totalAccSum / totalBranchesCount) * 10) / 10 : 100;
  
  const totalQaSum = scorecards.reduce((acc, s) => acc + s.qaAccuracyRate, 0);
  const overallQaAccuracyRate = totalBranchesCount > 0 ? Math.round((totalQaSum / totalBranchesCount) * 10) / 10 : 100;

  const totalSubRateSum = scorecards.reduce((acc, s) => acc + s.submissionRate, 0);
  const overallSubmissionRate = totalBranchesCount > 0 ? Math.round(totalSubRateSum / totalBranchesCount) : 0;

  // Real-Time TOTAL KPI STOCK (100) Calculation
  // 1. Stock Accuracy Score (Weight: 40 Points)
  let stockAccuracyScore = 40;
  if (overallAccuracyRate >= 95) {
    stockAccuracyScore = 40;
  } else if (overallAccuracyRate >= 90) {
    stockAccuracyScore = Math.round((35 + ((overallAccuracyRate - 90) / 5) * 5) * 10) / 10;
  } else if (overallAccuracyRate >= 80) {
    stockAccuracyScore = Math.round((25 + ((overallAccuracyRate - 80) / 10) * 10) * 10) / 10;
  } else {
    stockAccuracyScore = Math.round((overallAccuracyRate / 80) * 25 * 10) / 10;
  }

  // 2. Audit Submission & On-Time Compliance (Weight: 30 Points)
  const submissionScore = Math.round(((overallSubmissionRate / 100) * 30) * 10) / 10;

  // 3. Variance Volume Control (Weight: 20 Points)
  const totalVarianceUnits = totalShortageUnitsSum + totalOverUnitsSum;
  const varianceRatio = totalSystemUnitsSum > 0 ? (totalVarianceUnits / totalSystemUnitsSum) * 100 : 0;
  let varianceControlScore = 20;
  if (varianceRatio <= 1) {
    varianceControlScore = 20;
  } else if (varianceRatio <= 3) {
    varianceControlScore = 16;
  } else if (varianceRatio <= 5) {
    varianceControlScore = 12;
  } else if (varianceRatio <= 10) {
    varianceControlScore = 8;
  } else {
    varianceControlScore = 4;
  }

  // 4. Discrepancy Resolution & Audit Governance (Weight: 10 Points)
  const categoriesCount = categoryBreakdowns.length;
  const auditResolutionScore = activeBranches > 0 ? (categoriesCount >= 3 ? 10 : Math.max(6, categoriesCount * 3)) : 10;

  const totalKpiStockScore = Math.min(100, Math.round((stockAccuracyScore + submissionScore + varianceControlScore + auditResolutionScore) * 10) / 10);
  
  let kpiGrade: 'A+' | 'A' | 'B' | 'C' | 'D' = 'D';
  if (totalKpiStockScore >= 95) kpiGrade = 'A+';
  else if (totalKpiStockScore >= 90) kpiGrade = 'A';
  else if (totalKpiStockScore >= 80) kpiGrade = 'B';
  else if (totalKpiStockScore >= 70) kpiGrade = 'C';

  const summary: MonthlyPerformanceSummary = {
    monthKey: selectedMonthKey,
    monthLabel: formatThaiMonth(selectedMonthKey),
    totalBranches: totalBranchesCount,
    activeBranches,
    overallSubmissionRate,
    overallAccuracyRate,
    overallQaAccuracyRate,
    overallSkuaAccuracyRate: overallAccuracyRate,
    gradeACount: gradeACnt,
    gradeBCount: gradeBCnt,
    gradeCCount: gradeCCnt,
    topAuditedCategory,
    highestShortageCategory,
    highestOverCategory,
    totalSystemUnits: totalSystemUnitsSum,
    totalScannedUnits: totalScannedUnitsSum,
    totalShortageUnits: totalShortageUnitsSum,
    totalOverUnits: totalOverUnitsSum,
    totalKpiStockScore,
    kpiGrade,
    kpiPillars: {
      stockAccuracyScore,
      submissionScore,
      varianceControlScore,
      auditResolutionScore,
    },
  };

  return {
    scorecards,
    categoryBreakdowns,
    summary,
  };
}

/**
 * Computes category breakdown specifically filtered for All Branches or a Selected Branch
 */
export function computeFilteredCategoryBreakdowns(
  branches: Branch[],
  branchFilter: string = 'ALL'
): MonthlyCategoryBreakdown[] {
  const cleanBranches = normalizeBranchesList(branches);

  // Determine target branch or all branches
  const targetBranches =
    branchFilter === 'ALL'
      ? cleanBranches
      : cleanBranches.filter(
          (b) => b.id === branchFilter || b.code.toUpperCase() === branchFilter.toUpperCase()
        );

  // Group items by category code
  const categoryMap = new Map<
    string,
    {
      code: string;
      itemsCount: number;
      totalScannedQty: number;
      totalSystemQty: number;
      matchCount: number;
      shortageCount: number;
      overCount: number;
      mismatchSwapCount: number;
      shortageQty: number;
      overQty: number;
      branchesWithItems: Set<string>;
      branchesSubmitted: Set<string>;
    }
  >();

  // Initialize with standard categories in predefined order
  STANDARD_CATEGORY_ORDER.forEach((catCode) => {
    categoryMap.set(catCode, {
      code: catCode,
      itemsCount: 0,
      totalScannedQty: 0,
      totalSystemQty: 0,
      matchCount: 0,
      shortageCount: 0,
      overCount: 0,
      mismatchSwapCount: 0,
      shortageQty: 0,
      overQty: 0,
      branchesWithItems: new Set(),
      branchesSubmitted: new Set(),
    });
  });

  // Aggregate items from target branches
  targetBranches.forEach((branch) => {
    const items = safeParseItems(branch.items);
    const isSubmitted = branch.auditStatus === 'SUBMITTED';

    items.forEach((item) => {
      const catInfo = getCategoryInfo(item.category || 'OTHER');
      const catCode = catInfo.code;

      if (!categoryMap.has(catCode)) {
        categoryMap.set(catCode, {
          code: catCode,
          itemsCount: 0,
          totalScannedQty: 0,
          totalSystemQty: 0,
          matchCount: 0,
          shortageCount: 0,
          overCount: 0,
          mismatchSwapCount: 0,
          shortageQty: 0,
          overQty: 0,
          branchesWithItems: new Set(),
          branchesSubmitted: new Set(),
        });
      }

      const entry = categoryMap.get(catCode)!;
      const sysQ = item.systemQty || 0;
      const scnQ = item.scannedQty || 0;
      const diff = scnQ - sysQ;

      entry.itemsCount++;
      entry.totalSystemQty += sysQ;
      entry.totalScannedQty += scnQ;
      entry.branchesWithItems.add(branch.id);
      if (isSubmitted) {
        entry.branchesSubmitted.add(branch.id);
      }

      if (item.status === 'MATCH') {
        entry.matchCount++;
      } else if (item.status === 'SHORTAGE') {
        entry.shortageCount++;
        entry.shortageQty += Math.abs(item.variance || diff || 0);
      } else if (item.status === 'OVER') {
        entry.overCount++;
        entry.overQty += Math.abs(item.variance || diff || 0);
      }

      // Check for swapped / mismatch (both system and scanned exist with differences)
      if (item.status !== 'MATCH' && scnQ > 0 && sysQ > 0) {
        entry.mismatchSwapCount++;
      }
    });
  });

  // Convert to ordered list
  const results: MonthlyCategoryBreakdown[] = [];

  // 1. Process standard categories first in fixed sequence
  STANDARD_CATEGORY_ORDER.forEach((code) => {
    const data = categoryMap.get(code);
    if (!data) return;

    let submissionStatus: 'ส่งครบแล้ว' | 'ไม่ส่ง' | 'ไม่มีสินค้า' = 'ส่งครบแล้ว';
    if (data.itemsCount === 0) {
      submissionStatus = 'ไม่มีสินค้า';
    } else if (branchFilter !== 'ALL' && targetBranches[0]?.auditStatus === 'NOT_STARTED') {
      submissionStatus = 'ไม่ส่ง';
    } else {
      submissionStatus = 'ส่งครบแล้ว';
    }

    const accuracyRate =
      data.itemsCount > 0
        ? Math.round((data.matchCount / data.itemsCount) * 1000) / 10
        : 100;
    const shortageRate =
      data.itemsCount > 0
        ? Math.round((data.shortageCount / data.itemsCount) * 1000) / 10
        : 0;
    const overRate =
      data.itemsCount > 0
        ? Math.round((data.overCount / data.itemsCount) * 1000) / 10
        : 0;

    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
      data.itemsCount === 0
        ? 'LOW'
        : accuracyRate < 85 || data.shortageQty > 15 || data.mismatchSwapCount > 5
        ? 'HIGH'
        : accuracyRate < 95 || data.shortageQty > 5
        ? 'MEDIUM'
        : 'LOW';

    results.push({
      category: code,
      categoryCode: code,
      categoryLabel: code,
      submissionStatus,
      completedBranchesCount: data.branchesSubmitted.size,
      totalBranchesAuditing: data.branchesWithItems.size,
      itemsCount: data.itemsCount,
      totalScannedQty: data.totalScannedQty,
      totalSystemQty: data.totalSystemQty,
      matchCount: data.matchCount,
      shortageCount: data.shortageCount,
      overCount: data.overCount,
      mismatchSwapCount: data.mismatchSwapCount,
      shortageQty: data.shortageQty,
      overQty: data.overQty,
      netVariance: data.totalScannedQty - data.totalSystemQty,
      accuracyRate,
      shortageRate,
      overRate,
      riskLevel,
    });
  });

  // 2. Append any custom non-standard categories that have items
  categoryMap.forEach((data, code) => {
    if ((STANDARD_CATEGORY_ORDER as readonly string[]).includes(code)) return;
    if (data.itemsCount === 0) return; // Skip empty custom categories

    const accuracyRate =
      data.itemsCount > 0
        ? Math.round((data.matchCount / data.itemsCount) * 1000) / 10
        : 100;
    const shortageRate =
      data.itemsCount > 0
        ? Math.round((data.shortageCount / data.itemsCount) * 1000) / 10
        : 0;
    const overRate =
      data.itemsCount > 0
        ? Math.round((data.overCount / data.itemsCount) * 1000) / 10
        : 0;

    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
      accuracyRate < 85 ? 'HIGH' : accuracyRate < 95 ? 'MEDIUM' : 'LOW';

    results.push({
      category: code,
      categoryCode: code,
      categoryLabel: code,
      submissionStatus: 'ส่งครบแล้ว',
      completedBranchesCount: data.branchesSubmitted.size,
      totalBranchesAuditing: data.branchesWithItems.size,
      itemsCount: data.itemsCount,
      totalScannedQty: data.totalScannedQty,
      totalSystemQty: data.totalSystemQty,
      matchCount: data.matchCount,
      shortageCount: data.shortageCount,
      overCount: data.overCount,
      mismatchSwapCount: data.mismatchSwapCount,
      shortageQty: data.shortageQty,
      overQty: data.overQty,
      netVariance: data.totalScannedQty - data.totalSystemQty,
      accuracyRate,
      shortageRate,
      overRate,
      riskLevel,
    });
  });

  return results;
}
