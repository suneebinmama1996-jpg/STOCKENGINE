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

/**
 * Calculates grade based on accuracy rate
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
      itemsCount: number;
      totalScannedQty: number;
      totalSystemQty: number;
      matchCount: number;
      shortageCount: number;
      overCount: number;
      shortageQty: number;
      overQty: number;
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
    // For weekly audit compliance, standard target is 8 rounds for multi-day, or at least 4 rounds/month
    const requiredRounds = branch.auditScheduleDay === 'ALL' ? 8 : (branch.auditScheduleDay === 'THURSDAY' || branch.auditScheduleDay === 'FRIDAY' ? 4 : 4);
    
    // Determine completed rounds for this month
    // If branch has dailyAuditHistory recorded, count entries in this month
    let submittedRounds = 0;
    if (branch.dailyAuditHistory) {
      Object.entries(branch.dailyAuditHistory).forEach(([dateKey, record]) => {
        if (dateKey.startsWith(selectedMonthKey) && record.status === 'SUBMITTED') {
          submittedRounds++;
        }
      });
    }
    // If no history or zero, but current branch status is SUBMITTED and in current month, count at least 1 or calculate submission rate
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
      const cat = (item.category || 'ทั่วไป').trim();
      categoriesSet.add(cat);

      totalSysQty += item.systemQty || 0;
      totalScanQty += item.scannedQty || 0;

      if (item.status === 'MATCH') {
        matchCount++;
      } else if (item.status === 'SHORTAGE') {
        shortageCount++;
        branchShortageQty += Math.abs(item.variance || 0);
      } else if (item.status === 'OVER') {
        overCount++;
        branchOverQty += Math.abs(item.variance || 0);
      }

      // Aggregate into global category map
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, {
          itemsCount: 0,
          totalScannedQty: 0,
          totalSystemQty: 0,
          matchCount: 0,
          shortageCount: 0,
          overCount: 0,
          shortageQty: 0,
          overQty: 0,
        });
      }
      const catData = categoryMap.get(cat)!;
      catData.itemsCount++;
      catData.totalSystemQty += item.systemQty || 0;
      catData.totalScannedQty += item.scannedQty || 0;

      if (item.status === 'MATCH') catData.matchCount++;
      else if (item.status === 'SHORTAGE') {
        catData.shortageCount++;
        catData.shortageQty += Math.abs(item.variance || 0);
      } else if (item.status === 'OVER') {
        catData.overCount++;
        catData.overQty += Math.abs(item.variance || 0);
      }
    });

    const totalItems = items.length;
    const accuracyRate = totalItems > 0 ? Math.round((matchCount / totalItems) * 1000) / 10 : 100;
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
      grade,
      currentStatus: branch.auditStatus,
      lastAuditDate: branchAuditDate,
    });
  });

  // Convert Category Map to sorted array
  const categoryBreakdowns: MonthlyCategoryBreakdown[] = Array.from(categoryMap.entries()).map(
    ([category, data]) => {
      const accuracyRate =
        data.itemsCount > 0 ? Math.round((data.matchCount / data.itemsCount) * 1000) / 10 : 100;
      const shortageRate =
        data.itemsCount > 0 ? Math.round((data.shortageCount / data.itemsCount) * 1000) / 10 : 0;
      const overRate =
        data.itemsCount > 0 ? Math.round((data.overCount / data.itemsCount) * 1000) / 10 : 0;

      return {
        category,
        itemsCount: data.itemsCount,
        totalScannedQty: data.totalScannedQty,
        totalSystemQty: data.totalSystemQty,
        matchCount: data.matchCount,
        shortageCount: data.shortageCount,
        overCount: data.overCount,
        shortageQty: data.shortageQty,
        overQty: data.overQty,
        netVariance: data.totalScannedQty - data.totalSystemQty,
        accuracyRate,
        shortageRate,
        overRate,
      };
    }
  );

  // Sort categories by frequency / scanned items
  categoryBreakdowns.sort((a, b) => b.itemsCount - a.itemsCount);

  // Identify Top Audited, Highest Shortage, Highest Over Categories
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
  const totalSubRateSum = scorecards.reduce((acc, s) => acc + s.submissionRate, 0);
  const overallSubmissionRate = totalBranchesCount > 0 ? Math.round(totalSubRateSum / totalBranchesCount) : 0;

  const summary: MonthlyPerformanceSummary = {
    monthKey: selectedMonthKey,
    monthLabel: formatThaiMonth(selectedMonthKey),
    totalBranches: totalBranchesCount,
    activeBranches,
    overallSubmissionRate,
    overallAccuracyRate,
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
  };

  return {
    scorecards,
    categoryBreakdowns,
    summary,
  };
}
