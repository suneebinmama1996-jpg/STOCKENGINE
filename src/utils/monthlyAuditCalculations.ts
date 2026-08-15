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

// Standard Category Definitions and Friendly Thai Labels
export const STANDARD_CATEGORY_MAPPINGS: Record<string, { code: string; label: string; desc: string }> = {
  SK: { code: 'SK', label: 'SK - สกินแคร์', desc: 'บำรุงผิวหน้าและผิวกายทั่วไป' },
  SKMC: { code: 'SKMC', label: 'SKMC - สกินแคร์เคาน์เตอร์', desc: 'เคาน์เตอร์แบรนด์และพรีเมียมสกินแคร์' },
  HT: { code: 'HT', label: 'HT - ผลิตภัณฑ์ดูแลเส้นผม', desc: 'แชมพู ทรีทเม้นท์ เซรั่มผม' },
  'PN/SY/SLT/TS': { code: 'PN/SY/SLT/TS', label: 'PN/SY/SLT/TS - แป้ง/ลิป/เซรั่ม/โทนเนอร์', desc: 'เมคอัพและผลิตภัณฑ์บำรุงเฉพาะจุด' },
  HJ: { code: 'HJ', label: 'HJ - ฮิญาบ & เครื่องแต่งกาย', desc: 'ผ้าคลุม เครื่องแต่งกายมุสลิม' },
  PP: { code: 'PP', label: 'PP - ของใช้ส่วนตัว', desc: 'ของใช้ในชีวิตประจำวัน' },
  INN: { code: 'INN', label: 'INN - อาหารเสริม & วิตามิน', desc: 'ผลิตภัณฑ์เสริมอาหาร อินเนอร์บิวตี้' },
  KK: { code: 'KK', label: 'KK - เครื่องสำอางค์เกาหลี/ญี่ปุ่น', desc: 'K-Beauty & J-Beauty Cosmetics' },
  JB: { code: 'JB', label: 'JB - เครื่องประดับ & บิวตี้แอคเซสเซอรี่', desc: 'อุปกรณ์แต่งหน้าและเครื่องประดับ' },
  KM: { code: 'KM', label: 'KM - ขนม & เครื่องดื่ม', desc: 'ของว่าง เครื่องดื่ม ขนมนำเข้า' },
  SPORT: { code: 'SPORT', label: 'SPORT - กีฬาและฟิตเนส', desc: 'อุปกรณ์ออกกำลังกายและสุขภาพ' },
  'BOX/BAG': { code: 'BOX/BAG', label: 'BOX/BAG - กล่อง & ถุงบรรจุภัณฑ์', desc: 'อุปกรณ์แพ็คเกจจิ้ง' },
  GIFT: { code: 'GIFT', label: 'GIFT - กิฟต์เซ็ต & ของขวัญ', desc: 'ชุดของขวัญโปรโมชั่น' },
  OTHER: { code: 'OTHER', label: 'OTHER - สินค้าทั่วไปอื่นๆ', desc: 'หมวดหมู่อื่นๆ' },
};

/**
 * Normalizes and categorizes raw category string into standard code and Thai label
 */
export function getCategoryInfo(rawCategory: string): { code: string; label: string; desc: string } {
  const clean = (rawCategory || '').trim();
  const upper = clean.toUpperCase();

  for (const [key, info] of Object.entries(STANDARD_CATEGORY_MAPPINGS)) {
    if (upper === key.toUpperCase() || upper.includes(key.toUpperCase()) || clean.includes(info.label)) {
      return info;
    }
  }

  // Fallback
  return {
    code: clean || 'OTHER',
    label: clean || 'หมวดทั่วไป',
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
