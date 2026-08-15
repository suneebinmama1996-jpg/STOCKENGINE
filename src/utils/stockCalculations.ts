import { StockItem, Branch, AuditSummary, EngineJsonOutput, VarianceStatus, VarianceColor } from '../types';
import { safeParseItems } from './safeJsonParser';

/**
 * Calculates variance and assigns exact status & color based on rule:
 * - Scanned Qty == System Qty -> status: "MATCH", color: "GREEN"
 * - Scanned Qty < System Qty  -> status: "SHORTAGE", color: "RED"
 * - Scanned Qty > System Qty  -> status: "OVER", color: "YELLOW"
 */
export function calculateItemVariance(systemQty: number, scannedQty: number): {
  variance: number;
  status: VarianceStatus;
  color: VarianceColor;
} {
  const variance = scannedQty - systemQty;
  if (scannedQty === systemQty) {
    return { variance: 0, status: 'MATCH', color: 'GREEN' };
  } else if (scannedQty < systemQty) {
    return { variance, status: 'SHORTAGE', color: 'RED' };
  } else {
    return { variance, status: 'OVER', color: 'YELLOW' };
  }
}

/**
 * Recalculates an entire array of items
 */
export function processItems(items: Omit<StockItem, 'variance' | 'status' | 'color'>[]): StockItem[] {
  return items.map((item) => {
    const { variance, status, color } = calculateItemVariance(item.systemQty, item.scannedQty);
    return {
      ...item,
      variance,
      status,
      color,
    };
  });
}

/**
 * Computes Audit Summary across all branches
 */
export function computeAuditSummary(branches: Branch[]): AuditSummary {
  let totalSkus = 0;
  let totalSystemQty = 0;
  let totalScannedQty = 0;
  let matchCount = 0;
  let shortageCount = 0;
  let overCount = 0;
  let notStartedBranches = 0;
  let inProgressBranches = 0;
  let submittedBranches = 0;
  let totalShortageValue = 0;
  let totalOverValue = 0;

  branches.forEach((b) => {
    if (b.auditStatus === 'NOT_STARTED') notStartedBranches++;
    else if (b.auditStatus === 'IN_PROGRESS') inProgressBranches++;
    else if (b.auditStatus === 'SUBMITTED') submittedBranches++;

    const itemList = safeParseItems(b.items);

    itemList.forEach((item) => {
      if (!item) return;
      totalSkus++;
      totalSystemQty += item.systemQty || 0;
      totalScannedQty += item.scannedQty || 0;

      const price = item.unitPrice || 0;

      if (item.status === 'MATCH') {
        matchCount++;
      } else if (item.status === 'SHORTAGE') {
        shortageCount++;
        totalShortageValue += Math.abs(item.variance || 0) * price;
      } else if (item.status === 'OVER') {
        overCount++;
        totalOverValue += Math.abs(item.variance || 0) * price;
      }
    });
  });

  const accuracyRate = totalSkus > 0 ? ((matchCount / totalSkus) * 100).toFixed(2) + '%' : '0.00%';

  return {
    totalBranches: branches.length,
    notStartedBranches,
    inProgressBranches,
    submittedBranches,
    totalSkus,
    totalSystemQty,
    totalScannedQty,
    totalVariance: totalScannedQty - totalSystemQty,
    matchCount,
    shortageCount,
    overCount,
    accuracyRate,
    totalShortageValue,
    totalOverValue,
  };
}

/**
 * Builds the strict JSON structure required by the specification
 */
export function generateEngineJsonOutput(branches: Branch[]): EngineJsonOutput {
  const summary = computeAuditSummary(branches);

  return {
    timestamp: new Date().toISOString(),
    engineVersion: '2.0.0-PROD',
    summary: {
      totalBranches: summary.totalBranches,
      auditProgress: {
        notStarted: summary.notStartedBranches,
        inProgress: summary.inProgressBranches,
        submitted: summary.submittedBranches,
      },
      totalSkus: summary.totalSkus,
      totalSystemQty: summary.totalSystemQty,
      totalScannedQty: summary.totalScannedQty,
      totalVariance: summary.totalVariance,
      statusCounts: {
        MATCH: summary.matchCount,
        SHORTAGE: summary.shortageCount,
        OVER: summary.overCount,
      },
      accuracyRate: summary.accuracyRate,
    },
    branches: branches.map((b) => {
      let bMatch = 0;
      let bShortage = 0;
      let bOver = 0;
      let bSystemQty = 0;
      let bScannedQty = 0;

      const itemList = safeParseItems(b.items);

      itemList.forEach((item) => {
        if (!item) return;
        bSystemQty += item.systemQty || 0;
        bScannedQty += item.scannedQty || 0;
        if (item.status === 'MATCH') bMatch++;
        else if (item.status === 'SHORTAGE') bShortage++;
        else if (item.status === 'OVER') bOver++;
      });

      return {
        branchId: b.id,
        branchCode: b.code,
        branchName: b.name,
        region: b.region,
        auditStatus: b.auditStatus,
        startedAt: b.startedAt,
        submittedAt: b.submittedAt,
        assignedAuditor: b.assignedAuditor,
        itemSummary: {
          totalItems: itemList.length,
          matchCount: bMatch,
          shortageCount: bShortage,
          overCount: bOver,
          totalSystemQty: bSystemQty,
          totalScannedQty: bScannedQty,
          variance: bScannedQty - bSystemQty,
        },
        items: itemList.map((item) => ({
          sku: item.sku,
          barcode: item.barcode,
          name: item.name,
          location: item.location,
          category: item.category,
          systemQty: item.systemQty,
          scannedQty: item.scannedQty,
          variance: item.variance,
          status: item.status,
          color: item.color,
          lastScannedAt: item.lastScannedAt,
        })),
      };
    }),
  };
}

/**
 * Web Audio API audio beep feedback for PDA Scanner
 */
export function playScanBeep(type: 'success' | 'item' | 'match' | 'box' | 'error' | 'over' = 'success') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    // Ensure suspended audio contexts resume on user action
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'match' || type === 'success') {
      // High bright double chirp for MATCH completion
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // A6
      osc.frequency.setValueAtTime(2349.32, ctx.currentTime + 0.06); // D7
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'item') {
      // Crisp laser chirp for single item scan +1
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2093, ctx.currentTime); // C7
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } else if (type === 'box') {
      // Pleasant elevator chime for box / location scan
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08); // E6
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'over') {
      // High alert note
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2600, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } else {
      // Low alert buzz for error / not found
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    }
  } catch {
    // ignore audio errors if blocked
  }
}
