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
  lastScannedAt?: string;
  notes?: string;
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
