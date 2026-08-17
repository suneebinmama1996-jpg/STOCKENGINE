export type VarianceStatus = 'MATCH' | 'SHORTAGE' | 'OVER';
export type VarianceColor = 'GREEN' | 'RED' | 'YELLOW';
export type AuditStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED';

export interface StockItem {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  location: string;
  category: string;
  systemQty: number;
  scannedQty: number;
  variance: number;
  status: VarianceStatus;
  color: VarianceColor;
  unitPrice?: number;
  auditDate?: string; // YYYY-MM-DD
  batchId?: string;
  importDate?: string;
  isNewItem?: boolean;
  lastScannedAt?: string;
  notes?: string;
}

export interface DailyAuditRecord {
  status: AuditStatus;
  auditDate: string; // YYYY-MM-DD
  dayOfWeek?: string; // e.g. "พฤหัสบดี", "ศุกร์"
  submittedAt?: string;
  totalItems?: number;
  accuracy?: number;
  scannedQty?: number;
  systemQty?: number;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  region: string;
  auditStatus: AuditStatus;
  assignedAuditor?: string;
  startedAt?: string;
  submittedAt?: string;
  auditDate?: string; // YYYY-MM-DD
  auditScheduleDay?: 'THURSDAY' | 'FRIDAY' | 'ALL' | string;
  dailyAuditHistory?: Record<string, DailyAuditRecord>;
  items: StockItem[];
}

export interface AuditSummary {
  totalBranches: number;
  notStartedBranches: number;
  inProgressBranches: number;
  submittedBranches: number;
  totalSkus: number;
  totalSystemQty: number;
  totalScannedQty: number;
  totalVariance: number;
  matchCount: number;
  shortageCount: number;
  overCount: number;
  accuracyRate: string;
  totalShortageValue: number;
  totalOverValue: number;
}

export interface EngineJsonOutput {
  timestamp: string;
  engineVersion: string;
  summary: {
    totalBranches: number;
    auditProgress: {
      notStarted: number;
      inProgress: number;
      submitted: number;
    };
    totalSkus: number;
    totalSystemQty: number;
    totalScannedQty: number;
    totalVariance: number;
    statusCounts: {
      MATCH: number;
      SHORTAGE: number;
      OVER: number;
    };
    accuracyRate: string;
  };
  branches: Array<{
    branchId: string;
    branchCode: string;
    branchName: string;
    region: string;
    auditStatus: AuditStatus;
    startedAt?: string;
    submittedAt?: string;
    assignedAuditor?: string;
    itemSummary: {
      totalItems: number;
      matchCount: number;
      shortageCount: number;
      overCount: number;
      totalSystemQty: number;
      totalScannedQty: number;
      variance: number;
    };
    items: Array<{
      sku: string;
      barcode: string;
      name: string;
      location: string;
      category: string;
      systemQty: number;
      scannedQty: number;
      variance: number;
      status: VarianceStatus;
      color: VarianceColor;
      lastScannedAt?: string;
    }>;
  }>;
}

export interface MonthlyAuditScorecard {
  branchId: string;
  branchCode: string;
  branchName: string;
  region: string;
  assignedAuditor: string;
  auditScheduleDay?: string;
  requiredRounds: number; // e.g. 8 rounds/month (4 Thursdays + 4 Fridays)
  submittedRounds: number;
  submissionRate: number; // percentage e.g. 100%
  categoriesAudited: string[];
  totalItems: number;
  totalSystemQty: number;
  totalScannedQty: number;
  matchCount: number;
  shortageCount: number;
  overCount: number;
  shortageQty: number;
  overQty: number;
  netVariance: number;
  accuracyRate: number; // (matchCount / totalItems) * 100
  qaAccuracyRate: number; // QA accuracy based on physical units match
  skuaAccuracyRate: number; // SKUA accuracy based on SKU line match
  grade: 'A' | 'B' | 'C' | 'D';
  currentStatus: AuditStatus;
  lastAuditDate?: string;
}

export interface MonthlyCategoryBreakdown {
  category: string;
  categoryCode?: string;
  categoryLabel?: string;
  submissionStatus?: 'ส่งครบแล้ว' | 'ไม่ส่ง' | 'ไม่มีสินค้า' | string;
  completedBranchesCount?: number;
  totalBranchesAuditing?: number;
  itemsCount: number;
  totalScannedQty: number;
  totalSystemQty: number;
  matchCount: number;
  shortageCount: number;
  overCount: number;
  mismatchSwapCount?: number;
  shortageQty: number;
  overQty: number;
  netVariance: number;
  accuracyRate: number;
  shortageRate: number;
  overRate: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface MonthlyPerformanceSummary {
  monthKey: string; // e.g. "2026-08"
  monthLabel: string; // e.g. "สิงหาคม 2569"
  totalBranches: number;
  activeBranches: number;
  overallSubmissionRate: number;
  overallAccuracyRate: number;
  overallQaAccuracyRate?: number;
  overallSkuaAccuracyRate?: number;
  gradeACount: number;
  gradeBCount: number;
  gradeCCount: number;
  topAuditedCategory: string;
  highestShortageCategory: string;
  highestOverCategory: string;
  totalSystemUnits: number;
  totalScannedUnits: number;
  totalShortageUnits: number;
  totalOverUnits: number;
  totalKpiStockScore: number; // 0-100 score
  kpiGrade: 'A+' | 'A' | 'B' | 'C' | 'D';
  kpiPillars: {
    stockAccuracyScore: number; // max 40
    submissionScore: number; // max 30
    varianceControlScore: number; // max 20
    auditResolutionScore: number; // max 10
  };
}

