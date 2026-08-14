import { Branch, AuditStatus } from '../types';
import { safeParseItems } from './safeJsonParser';

export function isStatusValue(val: string): boolean {
  if (!val) return false;
  const v = String(val).trim().toUpperCase();
  return (
    v === 'NOT_STARTED' ||
    v === 'IN_PROGRESS' ||
    v === 'SUBMITTED' ||
    v === 'INPROGRESS' ||
    v === 'NOTSTARTED' ||
    v === 'COMPLETED' ||
    v === 'กำลังตรวจนับ' ||
    v === 'กำลังนับ' ||
    v === 'ส่งงานแล้ว' ||
    v === 'ส่งรายงานแล้ว' ||
    v === 'ยังไม่เริ่ม' ||
    v === 'ยังไม่เริ่มตรวจ'
  );
}

export function parseAuditStatus(val: string): AuditStatus {
  if (!val) return 'NOT_STARTED';
  const v = String(val).trim().toUpperCase();
  if (v === 'IN_PROGRESS' || v === 'INPROGRESS' || v === 'กำลังตรวจนับ' || v === 'กำลังนับ') {
    return 'IN_PROGRESS';
  }
  if (v === 'SUBMITTED' || v === 'COMPLETED' || v === 'ส่งงานแล้ว' || v === 'ส่งรายงานแล้ว') {
    return 'SUBMITTED';
  }
  return 'NOT_STARTED';
}

/**
 * Normalizes single branch data object according to specification:
 * - code / id: รหัสสาขา (เช่น BR-1930, 008, PTN-001)
 * - name: ชื่อสาขา (เช่น สาขา ดิจิตอล, สาขา ปัตตานี)
 * - region: ภูมิภาค/พื้นที่ (เช่น นราธิวาส, ปัตตานี, กรุงเทพฯ)
 * - assignedAuditor: ผู้ตรวจ (เช่น อาวาตีฟ, ซัลวา, เจ้าหน้าที่ Audit)
 * - auditStatus: สถานะ (เช่น NOT_STARTED, IN_PROGRESS, SUBMITTED)
 */
export function normalizeBranchData(input: any, fallbackIndex: number = 0): Branch {
  if (!input) {
    const code = `BR-00${fallbackIndex + 1}`;
    return {
      id: code,
      code,
      name: `สาขา ${fallbackIndex + 1}`,
      region: 'ทั่วไป',
      auditStatus: 'NOT_STARTED',
      assignedAuditor: 'เจ้าหน้าที่ Audit',
      items: [],
    };
  }

  let raw = input;

  // 1. Unwrap from Google Sheets action / branch payload where clean object is stored
  if (raw && typeof raw === 'object') {
    if (raw.action && typeof raw.action === 'object' && (raw.action.name || raw.action.code || raw.action.id)) {
      raw = {
        ...raw.action,
        items: Array.isArray(raw.action.items) && raw.action.items.length > 0 ? raw.action.items : raw.items,
      };
    } else if (typeof raw.action === 'string' && raw.action.trim().startsWith('{')) {
      try {
        const parsedAction = JSON.parse(raw.action);
        if (parsedAction && (parsedAction.name || parsedAction.code || parsedAction.id)) {
          raw = {
            ...parsedAction,
            items: Array.isArray(parsedAction.items) && parsedAction.items.length > 0 ? parsedAction.items : raw.items,
          };
        }
      } catch (e) {
        // Not JSON
      }
    } else if (Array.isArray(raw.branch) && raw.branch.length > 0) {
      const first = raw.branch[0];
      if (first && typeof first === 'object' && (first.name || first.code || first.id)) {
        raw = {
          ...first,
          items: Array.isArray(first.items) && first.items.length > 0 ? first.items : raw.items,
        };
      }
    } else if (raw.branch && typeof raw.branch === 'object' && !Array.isArray(raw.branch) && (raw.branch.name || raw.branch.code)) {
      raw = {
        ...raw.branch,
        items: Array.isArray(raw.branch.items) && raw.branch.items.length > 0 ? raw.branch.items : raw.items,
      };
    }
  }

  // 2. Handle Shifted column row format (from old Sheets layout where branches column has branch name)
  if (raw && typeof raw.branches === 'string' && (raw.branches.includes('สาขา') || raw.branches.toLowerCase().includes('branch'))) {
    const bName = raw.branches.trim();
    let bCode = String(raw.branch || raw.action || `BR-00${fallbackIndex + 1}`).trim();
    if (bCode === '8') bCode = '008';
    const bRegion = String(raw.id || 'ทั่วไป').trim();
    const bAuditor = String(raw.name || raw.auditStatus || '').trim();
    const bStatus = isStatusValue(raw.code) ? parseAuditStatus(raw.code) : 'NOT_STARTED';

    return {
      id: bCode,
      code: bCode,
      name: bName,
      region: isStatusValue(bRegion) ? 'ทั่วไป' : bRegion,
      assignedAuditor: isStatusValue(bAuditor) ? 'เจ้าหน้าที่ Audit' : (bAuditor || 'เจ้าหน้าที่ Audit'),
      auditStatus: bStatus,
      items: safeParseItems(raw.items),
    };
  }

  // Handle case where code is status e.g. "NOT_STARTED" and name is auditor e.g. "อาวาตีฟ"
  if (raw && (isStatusValue(raw.code) || isStatusValue(raw.id)) && raw.name && !raw.name.includes('สาขา')) {
    const statusVal = isStatusValue(raw.code) ? raw.code : (isStatusValue(raw.id) ? raw.id : 'NOT_STARTED');
    const auditorVal = raw.name.trim();
    const regionVal = raw.id && !isStatusValue(raw.id) ? raw.id : (raw.region || 'ทั่วไป');
    let codeVal = String(raw.branch || raw.action || `BR-00${fallbackIndex + 1}`).trim();
    if (codeVal === '8') codeVal = '008';
    const nameVal = typeof raw.branches === 'string' && raw.branches.trim() ? raw.branches.trim() : (auditorVal.includes('อาวาตีฟ') ? 'สาขา ดิจิตอล' : (auditorVal.includes('ซัลวา') ? 'สาขา ปัตตานี' : `สาขา ${codeVal}`));

    return {
      id: codeVal,
      code: codeVal,
      name: nameVal,
      region: regionVal,
      assignedAuditor: auditorVal,
      auditStatus: parseAuditStatus(statusVal),
      items: safeParseItems(raw.items),
    };
  }

  // 3. Array row format from Sheets e.g. [code, name, region, auditor, status, items]
  if (Array.isArray(raw)) {
    const rawCode = String(raw[0] || `BR-00${fallbackIndex + 1}`).trim();
    const rawName = String(raw[1] || '').trim();
    const rawRegion = String(raw[2] || '').trim();
    const rawAuditor = String(raw[3] || '').trim();
    const rawStatus = String(raw[4] || '').trim();
    const rawItems = raw[5];

    return normalizeBranchData(
      {
        id: rawCode,
        code: rawCode,
        name: rawName,
        region: rawRegion,
        assignedAuditor: rawAuditor,
        auditStatus: rawStatus,
        items: rawItems,
      },
      fallbackIndex
    );
  }

  // 4. Extract standard fields
  let id = String(
    raw.id ?? raw.code ?? raw.branchId ?? raw.branchCode ?? raw['รหัสสาขา'] ?? raw['รหัส'] ?? `BR-00${fallbackIndex + 1}`
  ).trim();

  let code = String(
    raw.code ?? raw.id ?? raw.branchCode ?? raw.branchId ?? raw['รหัสสาขา'] ?? raw['รหัส'] ?? id
  ).trim();

  let name = String(
    raw.name ?? raw.branchName ?? raw['ชื่อสาขา'] ?? raw['สาขา'] ?? ''
  ).trim();

  let region = String(
    raw.region ?? raw.area ?? raw.zone ?? raw.province ?? raw['ภูมิภาค'] ?? raw['พื้นที่'] ?? raw['จังหวัด'] ?? ''
  ).trim();

  let assignedAuditor = '';
  if (raw.assignedAuditor && typeof raw.assignedAuditor === 'string') {
    assignedAuditor = raw.assignedAuditor.trim();
  } else if (raw.auditor && typeof raw.auditor === 'string') {
    assignedAuditor = raw.auditor.trim();
  } else if (raw.auditorName && typeof raw.auditorName === 'string') {
    assignedAuditor = raw.auditorName.trim();
  } else if (raw['ผู้ตรวจ'] && typeof raw['ผู้ตรวจ'] === 'string') {
    assignedAuditor = raw['ผู้ตรวจ'].trim();
  } else if (raw['ชื่อผู้ตรวจ'] && typeof raw['ชื่อผู้ตรวจ'] === 'string') {
    assignedAuditor = raw['ชื่อผู้ตรวจ'].trim();
  }

  if (assignedAuditor === '[]' || assignedAuditor === '{}' || assignedAuditor === 'undefined' || assignedAuditor === 'null') {
    assignedAuditor = '';
  }

  let auditStatusRaw = String(
    raw.auditStatus ?? raw.status ?? raw['สถานะ'] ?? raw['สถานะการตรวจนับ'] ?? ''
  ).trim();

  // --- INTELLIGENT SHIFT & SWAP RECOVERY ---

  // Check if auditStatus contains auditor name (e.g. "อาวาตีฟ", "ซัลวา")
  if (auditStatusRaw && !isStatusValue(auditStatusRaw) && auditStatusRaw !== '[]' && auditStatusRaw !== '{}') {
    if (!assignedAuditor || assignedAuditor === 'เจ้าหน้าที่ Audit') {
      assignedAuditor = auditStatusRaw;
      auditStatusRaw = '';
    }
  }

  // Check if region contains audit status (e.g. "NOT_STARTED")
  if (isStatusValue(region)) {
    if (!auditStatusRaw || !isStatusValue(auditStatusRaw)) {
      auditStatusRaw = region;
    }
    region = '';
  }

  // Check if code contains branch name (e.g. "สาขา ดิจิตอล" / "สาขา ปัตตานี")
  const codeHasBranchWord = code.includes('สาขา') || code.toLowerCase().includes('branch');
  const nameHasBranchWord = name.includes('สาขา') || name.toLowerCase().includes('branch');

  if (codeHasBranchWord && !nameHasBranchWord) {
    if (region && (!assignedAuditor || assignedAuditor === 'เจ้าหน้าที่ Audit') && !isStatusValue(region)) {
      assignedAuditor = region;
    }
    if (name) {
      region = name;
    }
    name = code;

    // Restore real code if id has a number or clean code
    if (raw.id && !String(raw.id).includes('สาขา') && String(raw.id).trim().length > 0) {
      code = String(raw.id).trim();
    } else {
      code = `BR-00${fallbackIndex + 1}`;
    }
  } else if (!nameHasBranchWord && (region.includes('สาขา') || region.toLowerCase().includes('branch'))) {
    const temp = name;
    name = region;
    region = temp;
  }

  // Specific overrides for known demo branch codes
  if (name.includes('ดิจิตอล') && (code === '8' || code === 'BR-001' || !code || code.includes('สาขา'))) {
    code = '008';
    if (!region || region === 'ทั่วไป' || isStatusValue(region)) region = 'นราธิวาส';
    if (!assignedAuditor || assignedAuditor === 'เจ้าหน้าที่ Audit') assignedAuditor = 'อาวาตีฟ';
  } else if (name.includes('ปัตตานี') && (!code || code.includes('สาขา'))) {
    code = 'PTN-001';
    if (!region || region === 'ทั่วไป' || isStatusValue(region)) region = 'ปัตตานี';
    if (!assignedAuditor || assignedAuditor === 'เจ้าหน้าที่ Audit') assignedAuditor = 'ซัลวา';
  }

  // Final Defaults
  if (!code || code.includes('สาขา')) {
    code = id && !id.includes('สาขา') ? id : `BR-00${fallbackIndex + 1}`;
  }
  if (!id) {
    id = code;
  }
  if (!name) {
    name = `สาขา ${code}`;
  }
  if (!region || isStatusValue(region)) {
    region = 'ทั่วไป';
  }
  if (!assignedAuditor) {
    assignedAuditor = 'เจ้าหน้าที่ Audit';
  }

  const finalAuditStatus: AuditStatus = parseAuditStatus(auditStatusRaw);

  return {
    id: id || code,
    code,
    name,
    region,
    assignedAuditor,
    auditStatus: finalAuditStatus,
    startedAt: raw.startedAt ? String(raw.startedAt) : undefined,
    submittedAt: raw.submittedAt ? String(raw.submittedAt) : undefined,
    items: safeParseItems(raw.items),
  };
}

/**
 * Normalizes a list of branches, filters out corrupted phantom rows, and deduplicates cleanly.
 */
export function normalizeBranchesList(rawList: any[]): Branch[] {
  if (!Array.isArray(rawList)) return [];

  const parsedList = rawList
    .filter(Boolean)
    .map((b, idx) => normalizeBranchData(b, idx));

  // Deduplicate and filter out ghost/corrupted records
  const result: Branch[] = [];
  const seenKeys = new Set<string>();

  for (const b of parsedList) {
    // Check if item is an invalid phantom branch (e.g., name is a status or invalid string)
    if (!b.name || isStatusValue(b.name)) {
      continue;
    }

    // Key by normalized name and code
    const nameKey = b.name.trim().toLowerCase();
    const codeKey = b.code.trim().toUpperCase();

    if (seenKeys.has(nameKey) || seenKeys.has(codeKey)) {
      // Find existing branch to merge items if needed
      const existingIdx = result.findIndex(
        (e) => e.name.trim().toLowerCase() === nameKey || e.code.trim().toUpperCase() === codeKey
      );
      if (existingIdx >= 0) {
        // Keep the one with items or more detailed auditor
        const existing = result[existingIdx];
        if ((!existing.items || existing.items.length === 0) && b.items && b.items.length > 0) {
          result[existingIdx] = b;
        } else if (
          (!existing.assignedAuditor || existing.assignedAuditor === 'เจ้าหน้าที่ Audit') &&
          b.assignedAuditor &&
          b.assignedAuditor !== 'เจ้าหน้าที่ Audit'
        ) {
          result[existingIdx].assignedAuditor = b.assignedAuditor;
        }
      }
      continue;
    }

    seenKeys.add(nameKey);
    seenKeys.add(codeKey);
    result.push(b);
  }

  return result;
}
