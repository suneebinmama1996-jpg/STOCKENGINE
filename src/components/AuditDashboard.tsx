import React, { useState } from 'react';
import { Branch, AuditSummary, AuditStatus } from '../types';
import { safeParseItems } from '../utils/safeJsonParser';
import { normalizeBranchesList } from '../utils/branchNormalizer';
import {
  Building2,
  CheckCircle2,
  Clock,
  Send,
  QrCode,
  Layers,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Plus,
  Trash2,
  List,
  LayoutGrid,
  AlertCircle,
  Check,
  Lock,
  Unlock,
  Tag,
  Calendar,
  CalendarDays,
  ShieldCheck,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface AuditDashboardProps {
  branches: Branch[];
  summary: AuditSummary;
  onSelectBranchForReconciliation: (branchId: string) => void;
  onOpenPdaScanner: (branchId: string) => void;
  onUpdateBranchStatus: (branchId: string, status: AuditStatus) => void;
  onOpenBranchManager?: (mode?: 'ADD' | 'LIST') => void;
  onDeleteBranch?: (branchId: string) => void;
  onForceRecoverDigital?: () => void;
  recoveryLog?: string | null;
  isSubmitting?: boolean;
  isOffline?: boolean;
}

export const AuditDashboard: React.FC<AuditDashboardProps> = ({
  branches,
  summary,
  onSelectBranchForReconciliation,
  onOpenPdaScanner,
  onUpdateBranchStatus,
  onOpenBranchManager,
  onDeleteBranch,
  onForceRecoverDigital,
  recoveryLog,
  isSubmitting = false,
  isOffline = false,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | AuditStatus>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'THURSDAY' | 'FRIDAY' | 'CUSTOM'>('ALL');
  const [customDate, setCustomDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'matrix' | 'table' | 'cards'>('matrix');

  // Dates calculation
  const todayStr = new Date().toISOString().slice(0, 10);
  
  const getThursdayOfWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = 4 - day;
    const d = new Date(now);
    d.setDate(now.getDate() + diff);
    return d.toISOString().slice(0, 10);
  };

  const getFridayOfWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = 5 - day;
    const d = new Date(now);
    d.setDate(now.getDate() + diff);
    return d.toISOString().slice(0, 10);
  };

  const thursdayDateStr = getThursdayOfWeek();
  const fridayDateStr = getFridayOfWeek();

  const cleanBranches = normalizeBranchesList(branches);

  const getBranchEffectiveAuditDate = (b: Branch): string => {
    if (b.auditDate) return b.auditDate;
    if (b.items && b.items[0]?.auditDate) return b.items[0].auditDate;
    if (b.submittedAt) return b.submittedAt.slice(0, 10);
    return todayStr;
  };

  const filteredBranches = cleanBranches.filter((b) => {
    // 1. Status Filter
    const matchesStatus = statusFilter === 'ALL' || b.auditStatus === statusFilter;

    // 2. Date Filter
    let matchesDate = true;
    const branchDate = getBranchEffectiveAuditDate(b);
    if (dateFilter === 'TODAY') {
      matchesDate = branchDate === todayStr;
    } else if (dateFilter === 'THURSDAY') {
      matchesDate = branchDate === thursdayDateStr || b.auditScheduleDay === 'THURSDAY';
    } else if (dateFilter === 'FRIDAY') {
      matchesDate = branchDate === fridayDateStr || b.auditScheduleDay === 'FRIDAY';
    } else if (dateFilter === 'CUSTOM') {
      matchesDate = branchDate === customDate;
    }

    // 3. Search Filter
    const matchesSearch =
      (b.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.region || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.assignedAuditor || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesDate && matchesSearch;
  });

  const branchReports = filteredBranches.map((branch) => {
    const items = safeParseItems(branch.items);
    const totalItems = items.length;

    const matchItems = items.filter((i) => i && i.status === 'MATCH');
    const shortageItems = items.filter((i) => i && i.status === 'SHORTAGE');
    const overItems = items.filter((i) => i && i.status === 'OVER');

    const matchCount = matchItems.length;
    const shortageCount = shortageItems.length;
    const overCount = overItems.length;

    const totalSystemQty = items.reduce((sum, i) => sum + (i.systemQty || 0), 0);
    const totalScannedQty = items.reduce((sum, i) => sum + (i.scannedQty || 0), 0);
    const netVariance = totalScannedQty - totalSystemQty;

    const totalShortageQty = shortageItems.reduce((sum, i) => sum + Math.abs(i.variance || 0), 0);
    const totalOverQty = overItems.reduce((sum, i) => sum + (i.variance || 0), 0);

    const accuracy = totalItems > 0 ? Math.round((matchCount / totalItems) * 100) : 100;

    const countedCategories = Array.from(
      new Set(items.filter((i) => (i.scannedQty || 0) > 0).map((i) => i.category))
    ).filter(Boolean);

    const allCategories = Array.from(new Set(items.map((i) => i.category))).filter(Boolean);
    const auditDateStr = getBranchEffectiveAuditDate(branch);

    return {
      ...branch,
      items,
      totalItems,
      matchCount,
      shortageCount,
      overCount,
      totalSystemQty,
      totalScannedQty,
      netVariance,
      totalShortageQty,
      totalOverQty,
      accuracy,
      countedCategories,
      allCategories,
      auditDateStr,
    };
  });

  // Calculate Thursday and Friday compliance stats for Matrix
  const thursBranches = cleanBranches.filter(b => getBranchEffectiveAuditDate(b) === thursdayDateStr || b.auditScheduleDay === 'THURSDAY');
  const friBranches = cleanBranches.filter(b => getBranchEffectiveAuditDate(b) === fridayDateStr || b.auditScheduleDay === 'FRIDAY');
  const submittedCount = cleanBranches.filter(b => b.auditStatus === 'SUBMITTED').length;
  const complianceRate = cleanBranches.length > 0 ? Math.round((submittedCount / cleanBranches.length) * 100) : 0;

  return (
    <div className="space-y-4 pb-10">
      {/* Top Banner KPI Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Branch Progress */}
        <div className="bg-white rounded border border-slate-200 p-3.5 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                สถานะสาขา (Branches Audit Status)
              </span>
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black text-slate-900 tracking-tight">{summary.totalBranches}</span>
                <span className="text-[11px] text-slate-500 ml-1 font-medium">สาขา ทั้งหมด</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-extrabold text-blue-600">
                  {summary.submittedBranches} / {summary.totalBranches}
                </span>
                <p className="text-[10px] text-slate-400 font-medium">ส่งงานสำเร็จ (SUBMITTED)</p>
              </div>
            </div>
          </div>
          {/* Status Breakdown Pills */}
          <div className="mt-2.5 grid grid-cols-3 gap-1 text-center text-[10px] font-semibold pt-2 border-t border-slate-100">
            <div className="bg-slate-100 text-slate-700 rounded py-1 border border-slate-200">
              <span className="block font-bold">{summary.notStartedBranches}</span>
              <span className="text-[9px] text-slate-500">NOT_STARTED</span>
            </div>
            <div className="bg-blue-50 text-blue-700 rounded py-1 border border-blue-200">
              <span className="block font-bold">{summary.inProgressBranches}</span>
              <span className="text-[9px] text-blue-600">IN_PROGRESS</span>
            </div>
            <div className="bg-emerald-50 text-emerald-800 rounded py-1 border border-emerald-200">
              <span className="block font-bold">{summary.submittedBranches}</span>
              <span className="text-[9px] text-emerald-700">SUBMITTED</span>
            </div>
          </div>
        </div>

        {/* Card 2: System Qty vs Scanned Qty */}
        <div className="bg-white rounded border border-slate-200 p-3.5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                ยอดรวมตามระบบ vs สแกนจริง
              </span>
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-slate-500 font-medium">จำนวนตามระบบ (System)</p>
                <p className="text-lg font-black text-slate-800 tracking-tight">{summary.totalSystemQty.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-medium">สแกนจริง (Scanned)</p>
                <p className="text-lg font-black text-blue-600 tracking-tight">{summary.totalScannedQty.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">ผลต่างสุทธิ (Net Variance):</span>
            <span
              className={`text-xs font-extrabold px-1.5 py-0.5 rounded ${
                summary.totalVariance === 0
                  ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                  : summary.totalVariance < 0
                  ? 'text-rose-700 bg-rose-50 border border-rose-200'
                  : 'text-amber-800 bg-amber-50 border border-amber-200'
              }`}
            >
              {summary.totalVariance > 0 ? `+${summary.totalVariance}` : summary.totalVariance} ชิ้น
            </span>
          </div>
        </div>

        {/* Card 3: Reconciliation Status Breakdown */}
        <div className="bg-white rounded border border-slate-200 p-3.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              ผลการเปรียบเทียบรายการ (SKU)
            </span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
            {/* MATCH / GREEN */}
            <div className="bg-emerald-50 text-emerald-900 p-1.5 rounded border border-emerald-200">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] font-black text-emerald-800">MATCH</span>
              </div>
              <p className="text-base font-black text-emerald-900">{summary.matchCount}</p>
              <p className="text-[9px] text-emerald-700 font-medium">ครบเท่าระบบ</p>
            </div>

            {/* SHORTAGE / RED */}
            <div className="bg-rose-50 text-rose-900 p-1.5 rounded border border-rose-200">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span className="text-[10px] font-black text-rose-800">SHORTAGE</span>
              </div>
              <p className="text-base font-black text-rose-900">{summary.shortageCount}</p>
              <p className="text-[9px] text-rose-700 font-medium">ขาด/ไม่ครบ</p>
            </div>

            {/* OVER / YELLOW */}
            <div className="bg-amber-50 text-amber-900 p-1.5 rounded border border-amber-200">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span className="text-[10px] font-black text-amber-800">OVER</span>
              </div>
              <p className="text-base font-black text-amber-900">{summary.overCount}</p>
              <p className="text-[9px] text-amber-700 font-medium">เกินระบบ</p>
            </div>
          </div>
        </div>

        {/* Card 4: Accuracy & Overall Performance */}
        <div className="bg-slate-900 text-white rounded border border-slate-800 p-3.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              ความแม่นยำสต็อก (Accuracy)
            </span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-1.5">
            <p className="text-3xl font-black text-blue-400 tracking-tight">{summary.accuracyRate}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
              คำนวณจาก SKU ที่สแกน MATCH ครบเท่ากับระบบ
            </p>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex justify-between font-mono">
            <span>ขาด: ฿{summary.totalShortageValue.toLocaleString()}</span>
            <span>เกิน: ฿{summary.totalOverValue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Main Section Header & Filters */}
      <div className="bg-white rounded border border-slate-200 p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              AUDIT DASHBOARD ติดตามการตรวจนับรายสาขา & รอบประจำวัน
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              ตารางสรุปสถานะการส่งงานรายวัน / สัปดาห์ (Compliance Matrix) และผลการเปรียบเทียบสต็อก
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <input
              type="text"
              placeholder="ค้นหาชื่อสาขา, รหัสสาขา, ภูมิภาค..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-800"
            />

            {/* View Mode Toggle Buttons */}
            <div className="inline-flex rounded border border-slate-200 p-0.5 bg-slate-50 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition flex items-center gap-1.5 ${
                  viewMode === 'matrix'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="ตารางสรุปสถานะการส่งงานรายสัปดาห์ (Weekly Audit Compliance Matrix)"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>ตารางรอบส่งงาน (Matrix)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition flex items-center gap-1.5 ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="มุมมองตารางสรุปรายงาน"
              >
                <List className="w-3.5 h-3.5" />
                <span>ตารางรายงานสรุป</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition flex items-center gap-1.5 ${
                  viewMode === 'cards'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="มุมมองการ์ดจัดการรายสาขา"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>การ์ดสาขา</span>
              </button>
            </div>

            {/* Add Branch Button */}
            {onOpenBranchManager && (
              <button
                onClick={() => onOpenBranchManager('ADD')}
                className="inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-2xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มสาขาใหม่</span>
              </button>
            )}

            {/* Force Recover Button - Only shown when Offline or recovering */}
            {isOffline && onForceRecoverDigital && (
              <button
                onClick={onForceRecoverDigital}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-black bg-rose-600 hover:bg-rose-500 text-white transition shadow-xs active:scale-95 border border-rose-500 animate-pulse"
                title="ดึงข้อมูลเดิมของ สาขา ดิจิตอล และการตรวจนับที่พนักงานสแกนไว้ กลับมาทันที"
              >
                🔴 ดึงข้อมูลสาขาดิจิตอลคืน (Force Recover Digital Branch)
              </button>
            )}
          </div>
        </div>

        {/* Dual Filters Bar: Date/Cycle Filter & Status Filter */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded border border-slate-200">
          {/* Date / Cycle Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>รอบตรวจนับ:</span>
            </span>

            <div className="inline-flex rounded border border-slate-200 p-0.5 bg-white text-xs shadow-2xs">
              <button
                onClick={() => setDateFilter('ALL')}
                className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition ${
                  dateFilter === 'ALL'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ทุกรอบ ({cleanBranches.length})
              </button>
              <button
                onClick={() => setDateFilter('TODAY')}
                className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition ${
                  dateFilter === 'TODAY'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                วันนี้ ({todayStr})
              </button>
              <button
                onClick={() => setDateFilter('THURSDAY')}
                className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition ${
                  dateFilter === 'THURSDAY'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                รอบวันพฤหัสบดี
              </button>
              <button
                onClick={() => setDateFilter('FRIDAY')}
                className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition ${
                  dateFilter === 'FRIDAY'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                รอบวันศุกร์
              </button>
            </div>

            {/* Custom Date Input */}
            <div className="flex items-center gap-1 ml-1">
              <span className="text-[10px] text-slate-500 font-semibold">หรือระบุวันที่:</span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setDateFilter('CUSTOM');
                }}
                className={`px-2 py-0.5 text-xs rounded border font-mono ${
                  dateFilter === 'CUSTOM'
                    ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold'
                    : 'bg-white border-slate-300 text-slate-700'
                }`}
              />
            </div>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 self-end lg:self-auto">
            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-500" />
              <span>สถานะ:</span>
            </span>

            <div className="inline-flex rounded border border-slate-200 p-0.5 bg-white text-xs shadow-2xs">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                  statusFilter === 'ALL'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => setStatusFilter('NOT_STARTED')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                  statusFilter === 'NOT_STARTED'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ยังไม่เริ่ม
              </button>
              <button
                onClick={() => setStatusFilter('IN_PROGRESS')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                  statusFilter === 'IN_PROGRESS'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                กำลังสแกน
              </button>
              <button
                onClick={() => setStatusFilter('SUBMITTED')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                  statusFilter === 'SUBMITTED'
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ส่งงานแล้ว
              </button>
            </div>
          </div>
        </div>

        {isOffline && recoveryLog && (
          <div className="mt-3 p-3 bg-slate-900 border border-slate-800 rounded text-xs font-semibold font-mono text-slate-200">
            <div className="flex items-center space-x-2 text-rose-400 font-bold mb-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              <span>[SYSTEM DATA RECOVERY LOG]:</span>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed">{recoveryLog}</p>
          </div>
        )}

        {/* Conditional View Rendering */}
        {branches.length === 0 ? (
          <div className="bg-white rounded border border-slate-200 p-12 text-center space-y-4">
            <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h4 className="text-sm font-bold text-slate-800">ยังไม่มีข้อมูลสาขา กรุณานำเข้าไฟล์ Excel/JSON</h4>
              <p className="text-xs text-slate-500">
                ขณะนี้ระบบว่างเปล่าและไม่มีการสุ่มสร้างหรือโหลดข้อมูลตัวอย่างใดๆ แล้วค่ะ กรุณากดปุ่ม <strong>"นำเข้า Excel/JSON"</strong> หรือ <strong>"เพิ่มสาขาใหม่"</strong> เพื่อบันทึกสต็อกจริงได้ทันทีค่ะ
              </p>
            </div>
          </div>
        ) : viewMode === 'matrix' ? (
          /* ========================================================================= */
          /* WEEKLY AUDIT COMPLIANCE MATRIX VIEW                                       */
          /* ========================================================================= */
          <div className="space-y-3">
            {/* Matrix Executive Summary Banner */}
            <div className="bg-linear-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded p-4 border border-slate-800 shadow-md">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                      HQ Weekly Audit Compliance Matrix (ตารางตรวจสอบการส่งงานประจำรอบ)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300">
                    ติดตามการส่งงานแยกตามรอบวันพฤหัสบดี, วันศุกร์ และรอบประจำวัน สำหรับฝ่ายบัญชีและตรวจสอบ
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Thursday Cycle Stat */}
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded px-3 py-1.5 text-center">
                    <span className="text-[10px] text-amber-400 font-bold block uppercase">รอบ พฤหัสฯ ({thursdayDateStr})</span>
                    <span className="text-sm font-black text-white">
                      {thursBranches.filter(b => b.auditStatus === 'SUBMITTED').length} / {thursBranches.length} สาขา
                    </span>
                  </div>

                  {/* Friday Cycle Stat */}
                  <div className="bg-slate-800/80 border border-slate-700/80 rounded px-3 py-1.5 text-center">
                    <span className="text-[10px] text-emerald-400 font-bold block uppercase">รอบ ศุกร์ ({fridayDateStr})</span>
                    <span className="text-sm font-black text-white">
                      {friBranches.filter(b => b.auditStatus === 'SUBMITTED').length} / {friBranches.length} สาขา
                    </span>
                  </div>

                  {/* Overall Compliance */}
                  <div className="bg-blue-600/90 border border-blue-400/50 rounded px-3.5 py-1.5 text-center shadow-xs">
                    <span className="text-[10px] text-blue-100 font-bold block uppercase">ความสำเร็จรวม</span>
                    <span className="text-base font-black text-white tracking-tight">
                      {complianceRate}% ({submittedCount}/{cleanBranches.length})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto border border-slate-200 rounded shadow-2xs bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th scope="col" className="py-3 px-3.5">รหัส & ชื่อสาขา</th>
                    <th scope="col" className="py-3 px-3.5">ผู้ตรวจนับที่รับผิดชอบ</th>
                    <th scope="col" className="py-3 px-3.5 text-center bg-amber-50/50">
                      รอบ พฤหัสบดี ({thursdayDateStr})
                    </th>
                    <th scope="col" className="py-3 px-3.5 text-center bg-emerald-50/50">
                      รอบ ศุกร์ ({fridayDateStr})
                    </th>
                    <th scope="col" className="py-3 px-3.5 text-center">วันที่นับจริง</th>
                    <th scope="col" className="py-3 px-3.5 text-center">สถานะปัจจุบัน</th>
                    <th scope="col" className="py-3 px-3.5 text-right">การเข้าถึง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {branchReports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                        ไม่พบข้อมูลสาขาที่ตรงกับเงื่อนไขการกรอง
                      </td>
                    </tr>
                  ) : (
                    branchReports.map((bReport, index) => {
                      const isSubmitted = bReport.auditStatus === 'SUBMITTED';
                      const isThursdayScheduled = bReport.auditScheduleDay === 'THURSDAY' || bReport.auditDateStr === thursdayDateStr;
                      const isFridayScheduled = bReport.auditScheduleDay === 'FRIDAY' || bReport.auditDateStr === fridayDateStr;

                      return (
                        <tr key={`matrix-${bReport.id}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                          {/* Branch Name & Code */}
                          <td className="py-3 px-3.5 font-medium">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-black px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200">
                                {bReport.code}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">{bReport.region}</span>
                            </div>
                            <div className="text-xs font-black text-slate-900 mt-1">{bReport.name}</div>
                          </td>

                          {/* Auditor */}
                          <td className="py-3 px-3.5 font-medium">
                            <span className="text-xs text-slate-800 font-semibold">{bReport.assignedAuditor || 'ยังไม่ระบุ'}</span>
                            <div className="text-[10px] text-slate-400">{bReport.totalItems} รายการ</div>
                          </td>

                          {/* Thursday Column */}
                          <td className="py-3 px-3.5 text-center bg-amber-50/20">
                            {isThursdayScheduled ? (
                              isSubmitted ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  ส่งแล้ว (100%)
                                </span>
                              ) : bReport.auditStatus === 'IN_PROGRESS' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">
                                  <Clock className="w-3 h-3 text-blue-600" />
                                  กำลังสแกน
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <AlertCircle className="w-3 h-3 text-rose-500" />
                                  ค้างส่ง
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">-</span>
                            )}
                          </td>

                          {/* Friday Column */}
                          <td className="py-3 px-3.5 text-center bg-emerald-50/20">
                            {isFridayScheduled ? (
                              isSubmitted ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  ส่งแล้ว (100%)
                                </span>
                              ) : bReport.auditStatus === 'IN_PROGRESS' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">
                                  <Clock className="w-3 h-3 text-blue-600" />
                                  กำลังสแกน
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <AlertCircle className="w-3 h-3 text-rose-500" />
                                  ค้างส่ง
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">-</span>
                            )}
                          </td>

                          {/* Audit Date */}
                          <td className="py-3 px-3.5 text-center">
                            <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {bReport.auditDateStr || todayStr}
                            </span>
                            {bReport.submittedAt && (
                              <div className="text-[9px] text-slate-400 mt-0.5">
                                {new Date(bReport.submittedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                              </div>
                            )}
                          </td>

                          {/* Current Status Badge */}
                          <td className="py-3 px-3.5 text-center">
                            {isSubmitted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                🟢 SUBMITTED
                              </span>
                            ) : bReport.auditStatus === 'IN_PROGRESS' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                <Clock className="w-3 h-3 text-blue-600" />
                                🟡 IN PROGRESS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                ⚪ NOT STARTED
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3.5 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <button
                                type="button"
                                onClick={() => onOpenPdaScanner(bReport.id)}
                                className="px-2.5 py-1 rounded text-[11px] font-bold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition border border-slate-200 flex items-center gap-1"
                                title="เปิด PDA สแกนบาร์โค้ด"
                              >
                                <QrCode className="w-3 h-3 text-blue-600" />
                                <span>สแกน</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onSelectBranchForReconciliation(bReport.id)}
                                className="px-2.5 py-1 rounded text-[11px] font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-2xs flex items-center gap-1"
                                title="เปิดหน้าตรวจนับและกระทบยอด"
                              >
                                <span>ตรวจนับ</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto border border-slate-200 rounded shadow-2xs bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th scope="col" className="py-3 px-3.5">สาขา / ภูมิภาค</th>
                  <th scope="col" className="py-3 px-3.5 text-center">สถานะส่งรายงาน</th>
                  <th scope="col" className="py-3 px-3.5">หมวดหมู่ที่ตรวจนับ</th>
                  <th scope="col" className="py-3 px-3.5 text-center">สต็อกขาด (SHORTAGE)</th>
                  <th scope="col" className="py-3 px-3.5 text-center">สต็อกเกิน (OVER)</th>
                  <th scope="col" className="py-3 px-3.5 text-center">Cycle Count Accuracy</th>
                  <th scope="col" className="py-3 px-3.5 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {branchReports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                      ไม่พบข้อมูลสาขาที่ตรงกับการค้นหา
                    </td>
                  </tr>
                ) : (
                  branchReports.map((bReport, index) => {
                    const isSubmitted = bReport.auditStatus === 'SUBMITTED';
                    return (
                      <tr key={`${bReport.id}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                        {/* Branch / Region */}
                        <td className="py-3.5 px-3.5 font-medium">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                              {bReport.code}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{bReport.region}</span>
                          </div>
                          <div className="text-xs font-black text-slate-900 mt-1">{bReport.name}</div>
                          <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                            ผู้ตรวจ: {bReport.assignedAuditor || 'ยังไม่ได้ระบุ'}
                          </div>
                        </td>

                        {/* Submission Status */}
                        <td className="py-3.5 px-3.5 text-center">
                          {isSubmitted ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                ส่งงานแล้ว
                              </span>
                              {bReport.submittedAt && (
                                <span className="text-[9px] text-slate-400 font-mono mt-1">
                                  {new Date(bReport.submittedAt).toLocaleDateString('th-TH', {
                                    day: 'numeric',
                                    month: 'short',
                                  })}{' '}
                                  {new Date(bReport.submittedAt).toLocaleTimeString('th-TH', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                <Clock className="w-3 h-3 text-slate-400" />
                                ยังไม่ส่ง
                              </span>
                              <span className="text-[9px] text-slate-400 font-medium mt-1">
                                {bReport.auditStatus === 'IN_PROGRESS' ? 'กำลังดำเนินการ' : 'ยังไม่เริ่มนับ'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Counted Categories */}
                        <td className="py-3.5 px-3.5 max-w-xs">
                          {bReport.countedCategories.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {bReport.countedCategories.map((cat, index) => {
                                const catItems = bReport.items.filter((i) => i.category === cat);
                                const catScanned = catItems.filter((i) => (i.scannedQty || 0) > 0).length;
                                return (
                                  <span
                                    key={index}
                                    className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium whitespace-nowrap"
                                    title={`${cat}: สแกนแล้ว ${catScanned}/${catItems.length} SKU`}
                                  >
                                    <Tag className="w-2.5 h-2.5 text-blue-400" />
                                    <span>{cat}</span>
                                    <span className="text-[8px] bg-blue-200/50 px-1 rounded-full font-bold ml-0.5">
                                      {catScanned}/{catItems.length}
                                    </span>
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium italic">
                              ไม่มีการสแกนตรวจนับ
                            </span>
                          )}
                        </td>

                        {/* Shortage Count and Qty */}
                        <td className="py-3.5 px-3.5 text-center">
                          {bReport.shortageCount > 0 ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                {bReport.shortageCount} SKU
                              </span>
                              <div className="text-[10px] text-rose-600 font-bold font-mono">
                                ขาด: -{bReport.totalShortageQty} ชิ้น
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-bold flex items-center justify-center gap-0.5">
                              <Check className="w-3.5 h-3.5" />
                              ไม่มีขาด
                            </span>
                          )}
                        </td>

                        {/* Over Count and Qty */}
                        <td className="py-3.5 px-3.5 text-center">
                          {bReport.overCount > 0 ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                                {bReport.overCount} SKU
                              </span>
                              <div className="text-[10px] text-amber-700 font-bold font-mono">
                                เกิน: +{bReport.totalOverQty} ชิ้น
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">
                              ไม่มีเกิน
                            </span>
                          )}
                        </td>

                        {/* Cycle Count Accuracy */}
                        <td className="py-3.5 px-3.5">
                          <div className="flex flex-col items-center justify-center space-y-1">
                            <div className="flex items-baseline gap-1">
                              <span className={`text-sm font-black ${
                                bReport.accuracy >= 95
                                  ? 'text-emerald-600'
                                  : bReport.accuracy >= 80
                                  ? 'text-blue-600'
                                  : 'text-rose-600'
                              }`}>
                                {bReport.accuracy}%
                              </span>
                              <span className="text-[8px] text-slate-400 font-medium">accuracy</span>
                            </div>
                            <div className="w-24 h-1.5 bg-slate-100 rounded overflow-hidden flex">
                              <div
                                className={`h-full transition-all ${
                                  bReport.accuracy >= 95
                                    ? 'bg-emerald-500'
                                    : bReport.accuracy >= 80
                                    ? 'bg-blue-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${bReport.accuracy}%` }}
                              ></div>
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono">
                              (Match {bReport.matchCount}/{bReport.totalItems} SKU)
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onSelectBranchForReconciliation(bReport.id)}
                              className="px-2 py-1 rounded text-[10px] font-extrabold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition active:scale-95 whitespace-nowrap"
                              title="ดูรายการกระทบยอดสต็อกของสาขานี้"
                            >
                              ดูรายการนับ
                            </button>

                            {isSubmitted ? (
                              <button
                                onClick={() => onUpdateBranchStatus(bReport.id, 'IN_PROGRESS')}
                                className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition"
                                title="ปลดล็อกแก้ไข"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => onUpdateBranchStatus(bReport.id, 'SUBMITTED')}
                                className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition"
                                title="ส่งรายงานกระทบยอด"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Original Branch Cards Grid */
          branchReports.length === 0 ? (
            <div className="bg-white rounded border border-slate-200 p-8 text-center space-y-4">
              <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h4 className="text-sm font-bold text-slate-800">ยังไม่มีการเพิ่มสาขาเพื่อตรวจนับ</h4>
                <p className="text-xs text-slate-500">
                  ขณะนี้ฐานข้อมูลคลาวด์ว่างสมบูรณ์และไม่มีข้อมูลตัวอย่างเลียนแบบแล้วค่ะ กรุณากดปุ่ม <strong>"เพิ่มสาขาใหม่"</strong> เพื่อระบุรหัสและสาขาตรวจนับจริง หรืออัปโหลดไฟล์สินค้า Master เพื่อเปิดระบบในทันทีค่ะ
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {branchReports.map((bReport, index) => {
              return (
                <div
                  key={`${bReport.id}-${index}`}
                  className="bg-white rounded border border-slate-200 shadow-2xs hover:border-slate-300 transition flex flex-col justify-between overflow-hidden"
                >
                  {/* Branch Card Top Header */}
                  <div className="p-3 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                            {bReport.code}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">{bReport.region}</span>
                        </div>
                        <h3 className="text-xs font-black text-slate-900 mt-1">{bReport.name}</h3>
                      </div>

                      {/* Audit Status Badge & Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {bReport.auditStatus === 'NOT_STARTED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <Clock className="w-3 h-3" />
                            NOT_STARTED
                          </span>
                        )}
                        {bReport.auditStatus === 'IN_PROGRESS' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                            IN_PROGRESS
                          </span>
                        )}
                        {bReport.auditStatus === 'SUBMITTED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            SUBMITTED
                          </span>
                        )}

                        {onDeleteBranch && (
                          <button
                            onClick={() => !isSubmitting && onDeleteBranch(bReport.id)}
                            disabled={isSubmitting}
                            className={`p-1 rounded transition ${
                              isSubmitting ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                            title={`ลบสาขา ${bReport.code} - ${bReport.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Auditor Info & Timestamp */}
                    <div className="text-[10px] text-slate-500 bg-slate-50 rounded p-1.5 border border-slate-100 flex items-center justify-between font-mono">
                      <div className="flex items-center gap-1">
                        <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                          {bReport.auditDateStr || todayStr}
                        </span>
                        <span>{bReport.assignedAuditor || 'ยังไม่ได้ระบุ'}</span>
                      </div>
                      <span>
                        {bReport.submittedAt
                          ? `ส่ง: ${new Date(bReport.submittedAt).toLocaleTimeString('th-TH', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : bReport.startedAt
                          ? `เริ่ม: ${new Date(bReport.startedAt).toLocaleTimeString('th-TH', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : 'รอเปิดรอบนับ'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-medium text-slate-600">
                        <span>ความคืบหน้านับ MATCH</span>
                        <span className="font-bold text-slate-900">{bReport.accuracy}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded overflow-hidden flex">
                        <div
                          className="bg-blue-600 h-full transition-all"
                          style={{ width: `${bReport.accuracy}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Status Breakdown Statistics Badges */}
                    <div className="grid grid-cols-3 gap-1 pt-0.5 text-center">
                      <div className="p-1 rounded bg-emerald-50 border border-emerald-200">
                        <p className="text-[9px] text-emerald-800 font-bold">MATCH</p>
                        <p className="text-xs font-black text-emerald-900">{bReport.matchCount} SKU</p>
                      </div>

                      <div className="p-1 rounded bg-rose-50 border border-rose-200">
                        <p className="text-[9px] text-rose-800 font-bold">SHORTAGE</p>
                        <p className="text-xs font-black text-rose-900">{bReport.shortageCount} SKU</p>
                      </div>

                      <div className="p-1 rounded bg-amber-50 border border-amber-200">
                        <p className="text-[9px] text-amber-800 font-bold">OVER</p>
                        <p className="text-xs font-black text-amber-900">{bReport.overCount} SKU</p>
                      </div>
                    </div>

                    {/* System Qty & Scanned Qty Row */}
                    <div className="flex items-center justify-between text-[11px] pt-0.5 text-slate-600">
                      <span>
                        ระบบ: <strong className="text-slate-900 font-bold">{bReport.totalSystemQty}</strong> | สแกน:{' '}
                        <strong className="text-slate-900 font-bold">{bReport.totalScannedQty}</strong>
                      </span>
                      <span className="font-bold flex items-center gap-0.5">
                        ผลต่าง:{' '}
                        <span
                          className={
                            bReport.netVariance === 0
                              ? 'text-emerald-700'
                              : bReport.netVariance < 0
                              ? 'text-rose-700'
                              : 'text-amber-800'
                          }
                        >
                          {bReport.netVariance > 0 ? `+${bReport.netVariance}` : bReport.netVariance}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Card Bottom Actions Footer */}
                  <div className="bg-slate-50 border-t border-slate-100 p-2.5 space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => onOpenPdaScanner(bReport.id)}
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-1.2 rounded text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-white transition active:scale-95"
                      >
                        <QrCode className="w-3.5 h-3.5 text-blue-400" />
                        <span>สแกนกล้องมือถือ</span>
                      </button>

                      <button
                        onClick={() => onSelectBranchForReconciliation(bReport.id)}
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-1.2 rounded text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 transition active:scale-95"
                      >
                        <span>ดูรายการ</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                      </button>
                    </div>

                    {/* Submission Action & Copy Link */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {bReport.auditStatus !== 'SUBMITTED' ? (
                        <button
                          onClick={() => onUpdateBranchStatus(bReport.id, 'SUBMITTED')}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-2xs active:scale-95"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>ส่งรายงานกระทบยอด</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onUpdateBranchStatus(bReport.id, 'IN_PROGRESS')}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition active:scale-95"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>ปลดล็อกแก้ไข</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          const url = new URL(window.location.href);
                          url.searchParams.set('branch', bReport.id);
                          url.searchParams.set('tab', 'reconciliation');
                          navigator.clipboard.writeText(url.toString());
                          alert(`คัดลอกลิงค์สำหรับสาขา "${bReport.name}" เรียบร้อยแล้ว!\n\n${url.toString()}`);
                        }}
                        className="px-2 py-1.5 rounded text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition shrink-0"
                        title="คัดลอกลิงค์ตรงประจำสาขานี้"
                      >
                        🔗 ลิงค์สาขา
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

