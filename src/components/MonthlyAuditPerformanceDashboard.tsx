import React, { useState, useMemo } from 'react';
import { Branch, MonthlyAuditScorecard, MonthlyCategoryBreakdown } from '../types';
import {
  computeMonthlyPerformance,
  generateMonthOptions,
  formatThaiMonth,
} from '../utils/monthlyAuditCalculations';
import { exportMonthlyPerformanceToExcel } from '../utils/excelParser';
import {
  Calendar,
  Award,
  TrendingUp,
  AlertTriangle,
  Package,
  Download,
  Building2,
  CheckCircle2,
  Tag,
  BarChart3,
  Layers,
  ChevronLeft,
  ChevronRight,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Clock,
  Sparkles,
  Target,
  FileCheck,
  Activity,
  Check,
  ArrowRight,
  TrendingDown,
  Percent,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

interface MonthlyAuditPerformanceDashboardProps {
  branches: Branch[];
  onSelectBranchForReconciliation: (branchId: string) => void;
  onOpenPdaScanner?: (branchId: string) => void;
}

export const MonthlyAuditPerformanceDashboard: React.FC<MonthlyAuditPerformanceDashboardProps> = ({
  branches,
  onSelectBranchForReconciliation,
  onOpenPdaScanner,
}) => {
  const currentYearMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-08"
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<'ALL' | 'A' | 'B' | 'C' | 'D'>('ALL');
  const [activeSubTab, setActiveSubTab] = useState<'scorecard' | 'category' | 'kpi' | 'charts'>('scorecard');

  const monthOptions = useMemo(() => generateMonthOptions(currentYearMonth), [currentYearMonth]);

  // Compute monthly data for selected month
  const { scorecards, categoryBreakdowns, summary } = useMemo(
    () => computeMonthlyPerformance(branches, selectedMonth),
    [branches, selectedMonth]
  );

  // Filtered scorecards based on search and grade
  const filteredScorecards = useMemo(() => {
    return scorecards.filter((s) => {
      const matchGrade = gradeFilter === 'ALL' || s.grade === gradeFilter;
      const matchSearch =
        s.branchName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.branchCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.assignedAuditor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.categoriesAudited.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchGrade && matchSearch;
    });
  }, [scorecards, gradeFilter, searchQuery]);

  // Handle Export
  const handleExportExcel = () => {
    exportMonthlyPerformanceToExcel(summary.monthLabel, scorecards, categoryBreakdowns, summary);
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-');
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 2, 1);
    const prev = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(prev);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-');
    const d = new Date(parseInt(y, 10), parseInt(m, 10), 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(next);
  };

  // Chart Data for Category Accuracy & Variance
  const categoryChartData = useMemo(() => {
    return categoryBreakdowns.slice(0, 10).map((c) => ({
      name: c.categoryCode || c.category,
      fullName: c.categoryLabel || c.category,
      accuracy: c.accuracyRate,
      shortageUnits: c.shortageQty,
      overUnits: c.overQty,
      totalUnits: c.totalScannedQty,
    }));
  }, [categoryBreakdowns]);

  // KPI Pillars helper data
  const kpiPillarsList = useMemo(() => {
    return [
      {
        id: 'accuracy',
        title: 'ความแม่นยำการตรวจนับสต็อก (Stock Accuracy Rate)',
        weight: 40,
        target: '≥ 95% (เกรด A)',
        actual: `${summary.overallAccuracyRate}% (SKUA) / ${summary.overallQaAccuracyRate ?? summary.overallAccuracyRate}% (QA)`,
        score: summary.kpiPillars.stockAccuracyScore,
        desc: 'คำนวณจากสัดส่วนรายการ SKU และจำนวนชิ้นที่ตรงตามระบบจริง 100%',
        color: summary.kpiPillars.stockAccuracyScore >= 35 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200',
        badgeBg: 'bg-emerald-600',
      },
      {
        id: 'submission',
        title: 'อัตราการส่งรายงานตรงเวลา & ครบถ้วน (Audit & Submission Compliance)',
        weight: 30,
        target: '100% ตามรอบประจำสัปดาห์/เดือน',
        actual: `${summary.overallSubmissionRate}% (${summary.activeBranches}/${summary.totalBranches} สาขา)`,
        score: summary.kpiPillars.submissionScore,
        desc: 'การส่งรายงานกระทบยอดตรงตามกำหนดรอบวันพฤหัสบดี/วันศุกร์ และรอบประจำเดือน',
        color: summary.kpiPillars.submissionScore >= 25 ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-amber-700 bg-amber-50 border-amber-200',
        badgeBg: 'bg-blue-600',
      },
      {
        id: 'variance',
        title: 'การควบคุมความคลาดเคลื่อนสต็อกขาด/เกิน (Variance Volume Control)',
        weight: 20,
        target: 'ผลต่างรวม < 1.0% ของสต็อกระบบ',
        actual: `ขาด ${summary.totalShortageUnits.toLocaleString()} ชิ้น / เกิน ${summary.totalOverUnits.toLocaleString()} ชิ้น`,
        score: summary.kpiPillars.varianceControlScore,
        desc: 'การควบคุมปริมาณชิ้นสินค้าที่ขาดหรือเกินให้อยู่ในเกณฑ์ความเสี่ยงต่ำ',
        color: summary.kpiPillars.varianceControlScore >= 16 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200',
        badgeBg: 'bg-indigo-600',
      },
      {
        id: 'governance',
        title: 'การกระทบยอดและตรวจสอบส่วนต่าง (Discrepancy Resolution & Audit Governance)',
        weight: 10,
        target: 'ครอบคลุมทุกหมวดหมู่หลัก ≥ 3 หมวด',
        actual: `ตรวจครอบคลุม ${categoryBreakdowns.length} หมวดหมู่สินค้า`,
        score: summary.kpiPillars.auditResolutionScore,
        desc: 'ความครอบคลุมการตรวจสอบและการระบุสาเหตุสินค้าสลับรหัส/ขาด-สลับในระบบ',
        color: summary.kpiPillars.auditResolutionScore >= 8 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-700 bg-slate-50 border-slate-200',
        badgeBg: 'bg-purple-600',
      },
    ];
  }, [summary, categoryBreakdowns]);

  return (
    <div className="space-y-5 pb-12">
      {/* 1. Top Executive Control & Month Selector Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-blue-600 text-white shadow-xs">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <span>AUDIT SCORECARD & MONTHLY CYCLE COUNT PERFORMANCE</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                    HQ Executive
                  </span>
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  รายงานสรุปผลการตรวจนับประจำสัปดาห์/เดือน คะแนนความแม่นยำ QA/SKUA และ TOTAL KPI STOCK (100)
                </p>
              </div>
            </div>
          </div>

          {/* Month Selector & Export Action */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Month Navigation & Dropdown */}
            <div className="flex items-center bg-slate-50 border border-slate-300 rounded p-1 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                title="เดือนก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 px-2">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-800 focus:outline-none cursor-pointer pr-1"
                >
                  {monthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} className="text-slate-800 font-medium">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                title="เดือนถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Export Monthly Report Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-2xs active:scale-95 border border-emerald-600 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export รายงานสรุป (Excel)</span>
            </button>
          </div>
        </div>

        {/* 2. Executive Key Metric Cards & Total KPI Stock Hero */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-slate-100">
          {/* Hero Card: TOTAL KPI STOCK (100) */}
          <div className="col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-lg p-3.5 border border-slate-800 shadow-md relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-amber-400" />
                TOTAL KPI STOCK (100)
              </span>
              <span
                className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${
                  summary.kpiGrade === 'A+' || summary.kpiGrade === 'A'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : summary.kpiGrade === 'B'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                }`}
              >
                เกรด {summary.kpiGrade}
              </span>
            </div>

            <div className="flex items-baseline gap-2 my-2">
              <span className="text-3xl font-black text-amber-400 tracking-tight">
                {summary.totalKpiStockScore}
              </span>
              <span className="text-xs text-slate-400 font-semibold">/ 100 คะแนนเต็ม</span>
            </div>

            <div className="space-y-1">
              <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, summary.totalKpiStockScore)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                <span>ความแม่นยำ {summary.kpiPillars.stockAccuracyScore}/40</span>
                <span>ส่งตรงเวลา {summary.kpiPillars.submissionScore}/30</span>
                <span>คุมยอดขาดเกิน {summary.kpiPillars.varianceControlScore}/20</span>
              </div>
            </div>
          </div>

          {/* Card 2: QA Accuracy Rate */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              % ความแม่นยำ QA (Unit Level)
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-emerald-700">
                {summary.overallQaAccuracyRate ?? summary.overallAccuracyRate}%
              </span>
              <span className="text-[10px] text-emerald-600 font-bold">ชิ้นสินค้า</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${summary.overallQaAccuracyRate ?? summary.overallAccuracyRate}%` }}
              />
            </div>
          </div>

          {/* Card 3: SKUA Accuracy Rate */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              % ความแม่นยำ SKUA (SKU Level)
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-blue-700">
                {summary.overallAccuracyRate}%
              </span>
              <span className="text-[10px] text-blue-600 font-bold">รายการ SKU</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${summary.overallAccuracyRate}%` }}
              />
            </div>
          </div>

          {/* Card 4: Submission Rate */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              อัตราส่งรายงานตรงเวลา
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-slate-900">
                {summary.overallSubmissionRate}%
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                ({summary.activeBranches}/{summary.totalBranches} สาขา)
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${summary.overallSubmissionRate}%` }}
              />
            </div>
          </div>

          {/* Card 5: Shortage & Over Units */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                ผลต่างสต็อกรวม (Variance)
              </span>
              <div className="flex items-center justify-between text-xs mt-1 font-mono font-bold">
                <span className="text-rose-600">ขาด: -{summary.totalShortageUnits.toLocaleString()}</span>
                <span className="text-amber-600">เกิน: +{summary.totalOverUnits.toLocaleString()}</span>
              </div>
            </div>
            <span className="text-[9px] text-slate-400 block mt-1">
              ระบบ: {summary.totalSystemUnits.toLocaleString()} / สแกน: {summary.totalScannedUnits.toLocaleString()} ชิ้น
            </span>
          </div>
        </div>
      </div>

      {/* 3. Sub Navigation Tabs (Table 1: Scorecard, Table 2: Category, Table 3: KPI Stock, Table 4: Charts) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          {/* Tab 1 */}
          <button
            type="button"
            onClick={() => setActiveSubTab('scorecard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'scorecard'
                ? 'bg-white text-blue-700 shadow-2xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>1. ตารางคะแนนรายสาขา (QA/SKUA)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800">
              {filteredScorecards.length}
            </span>
          </button>

          {/* Tab 2 */}
          <button
            type="button"
            onClick={() => setActiveSubTab('category')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'category'
                ? 'bg-white text-blue-700 shadow-2xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2. สรุปหมวดหมู่สินค้า (Category Breakdown)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800">
              {categoryBreakdowns.length}
            </span>
          </button>

          {/* Tab 3 */}
          <button
            type="button"
            onClick={() => setActiveSubTab('kpi')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'kpi'
                ? 'bg-white text-blue-700 shadow-2xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-amber-600" />
            <span>3. สรุปผล KPI STOCK (100)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-bold">
              {summary.totalKpiStockScore} คะแนน
            </span>
          </button>

          {/* Tab 4 */}
          <button
            type="button"
            onClick={() => setActiveSubTab('charts')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'charts'
                ? 'bg-white text-blue-700 shadow-2xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>4. กราฟวิเคราะห์แนวโน้ม (Charts)</span>
          </button>
        </div>

        {/* Quick Search & Grade Filter (when in Scorecard tab) */}
        {activeSubTab === 'scorecard' && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="ค้นหารหัสสาขา, ชื่อสาขา, ผู้ตรวจ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 sm:w-56 px-2.5 py-1 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
              />
            </div>

            {/* Grade Filter */}
            <div className="inline-flex rounded border border-slate-200 p-0.5 bg-slate-100 text-xs">
              {(['ALL', 'A', 'B', 'C', 'D'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGradeFilter(g)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                    gradeFilter === g
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {g === 'ALL' ? 'ทุกเกรด' : `เกรด ${g}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. TABLE 1: ตารางคะแนนและเปอร์เซ็นต์ความแม่นยำ QA และ SKUA แยกตามรหัสสาขา */}
      {activeSubTab === 'scorecard' && (
        <div className="space-y-3">
          <div className="bg-blue-50/60 border border-blue-200 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-2">
            <div className="flex items-center gap-2 text-blue-950 font-bold">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                ตารางคะแนนและเปอร์เซ็นต์ความแม่นยำ QA และ SKUA แยกตามรหัสสาขา (PTN, NRW, YL, HDY, DG, MT, KB ฯลฯ)
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-blue-800">
              <span className="font-bold">QA = Unit Level Accuracy</span>
              <span>•</span>
              <span className="font-bold">SKUA = SKU Line Accuracy</span>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-2xs bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs text-slate-700">
              <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider sticky top-0">
                <tr>
                  <th scope="col" className="py-3 px-3 text-center w-10">ลำดับ</th>
                  <th scope="col" className="py-3 px-3.5">รหัส & ชื่อสาขา</th>
                  <th scope="col" className="py-3 px-3">ผู้ตรวจนับ & วันที่</th>
                  <th scope="col" className="py-3 px-3 text-center">การส่งงาน</th>
                  <th scope="col" className="py-3 px-3 text-center">SKU / ชิ้นสแกน</th>
                  <th scope="col" className="py-3 px-3 text-center bg-slate-800 text-emerald-400">MATCH (ตรง)</th>
                  <th scope="col" className="py-3 px-3 text-center bg-slate-800 text-rose-400">SHORTAGE (ขาด)</th>
                  <th scope="col" className="py-3 px-3 text-center bg-slate-800 text-amber-400">OVER (เกิน)</th>
                  <th scope="col" className="py-3 px-3 text-center bg-blue-950 text-blue-200">% QA</th>
                  <th scope="col" className="py-3 px-3 text-center bg-blue-950 text-emerald-300">% SKUA</th>
                  <th scope="col" className="py-3 px-3 text-center">เกรด</th>
                  <th scope="col" className="py-3 px-3.5 text-right">การกระทำ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {filteredScorecards.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-10 text-center text-slate-400 font-medium">
                      ไม่พบข้อมูลสาขาในเงื่อนไขการค้นหาประจำเดือน {summary.monthLabel}
                    </td>
                  </tr>
                ) : (
                  filteredScorecards.map((sc, index) => {
                    const isGradeA = sc.grade === 'A';
                    const isGradeB = sc.grade === 'B';

                    return (
                      <tr key={`scorecard-${sc.branchId}-${index}`} className="hover:bg-slate-50 transition-colors">
                        {/* No. */}
                        <td className="py-3 px-3 text-center font-mono text-slate-400 font-bold">
                          {index + 1}
                        </td>

                        {/* Branch Code & Name */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono font-black px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded border border-blue-200">
                              {sc.branchCode}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">{sc.region}</span>
                          </div>
                          <div className="text-xs font-black text-slate-900 mt-0.5">{sc.branchName}</div>
                        </td>

                        {/* Auditor & Last Audit Date */}
                        <td className="py-3 px-3">
                          <span className="text-xs font-semibold text-slate-800 block">{sc.assignedAuditor}</span>
                          <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                            {sc.lastAuditDate || '-'}
                          </span>
                        </td>

                        {/* Submission Rounds & Rate */}
                        <td className="py-3 px-3 text-center">
                          <span className="text-xs font-black font-mono text-slate-900 block">
                            {sc.submittedRounds}/{sc.requiredRounds} ({sc.submissionRate}%)
                          </span>
                          <div className="w-16 bg-slate-200 h-1.5 rounded-full mx-auto mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                sc.submissionRate >= 100
                                  ? 'bg-emerald-600'
                                  : sc.submissionRate >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${sc.submissionRate}%` }}
                            />
                          </div>
                        </td>

                        {/* Counted SKUs & Scanned Units */}
                        <td className="py-3 px-3 text-center font-mono">
                          <div className="text-xs font-bold text-slate-900">{sc.totalItems} SKU</div>
                          <div className="text-[10px] text-slate-500">({sc.totalScannedQty.toLocaleString()} ชิ้น)</div>
                        </td>

                        {/* MATCH (SKU / Units) */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700 bg-emerald-50/20">
                          <div>{sc.matchCount} SKU</div>
                          <div className="text-[10px] font-normal text-emerald-600 font-sans">ตรงตามระบบ</div>
                        </td>

                        {/* SHORTAGE (SKU / Units) */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-rose-700 bg-rose-50/20">
                          <div>{sc.shortageCount} SKU</div>
                          <div className="text-[10px] font-semibold text-rose-600">(-{sc.shortageQty} ชิ้น)</div>
                        </td>

                        {/* OVER (SKU / Units) */}
                        <td className="py-3 px-3 text-center font-mono font-bold text-amber-700 bg-amber-50/20">
                          <div>{sc.overCount} SKU</div>
                          <div className="text-[10px] font-semibold text-amber-600">(+{sc.overQty} ชิ้น)</div>
                        </td>

                        {/* % QA Accuracy */}
                        <td className="py-3 px-3 text-center font-mono font-bold bg-blue-50/40">
                          <span
                            className={`text-xs ${
                              (sc.qaAccuracyRate ?? sc.accuracyRate) >= 95
                                ? 'text-emerald-700'
                                : (sc.qaAccuracyRate ?? sc.accuracyRate) >= 85
                                ? 'text-blue-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {sc.qaAccuracyRate ?? sc.accuracyRate}%
                          </span>
                        </td>

                        {/* % SKUA Accuracy */}
                        <td className="py-3 px-3 text-center font-mono font-black bg-blue-50/40">
                          <span
                            className={`text-xs ${
                              sc.accuracyRate >= 95
                                ? 'text-emerald-700'
                                : sc.accuracyRate >= 85
                                ? 'text-blue-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {sc.accuracyRate}%
                          </span>
                        </td>

                        {/* Grade */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black border ${
                              isGradeA
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : isGradeB
                                ? 'bg-blue-100 text-blue-900 border-blue-300'
                                : 'bg-amber-100 text-amber-900 border-amber-300'
                            }`}
                          >
                            {isGradeA && <Sparkles className="w-2.5 h-2.5 text-emerald-600" />}
                            <span>{sc.grade}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3.5 text-right">
                          <div className="inline-flex items-center gap-1 justify-end">
                            {onOpenPdaScanner && (
                              <button
                                type="button"
                                onClick={() => onOpenPdaScanner(sc.branchId)}
                                className="px-2 py-1 rounded text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition border border-slate-200 cursor-pointer"
                                title="เปิดสแกนเนอร์ PDA"
                              >
                                สแกนต่อ
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onSelectBranchForReconciliation(sc.branchId)}
                              className="px-2.5 py-1 rounded text-[11px] font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-2xs flex items-center gap-1 cursor-pointer"
                            >
                              <span>ดูกระทบยอด</span>
                              <ExternalLink className="w-3 h-3" />
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
      )}

      {/* 5. TABLE 2: สรุปการส่งข้อมูลและสถานะสินค้า แยกตามหมวดหมู่สินค้า */}
      {activeSubTab === 'category' && (
        <div className="space-y-3">
          <div className="bg-purple-50/60 border border-purple-200 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-2">
            <div className="flex items-center gap-2 text-purple-950 font-bold">
              <Layers className="w-4 h-4 text-purple-600 shrink-0" />
              <span>
                สรุปการส่งข้อมูลและสถานะสินค้า (ส่งข้อมูลครบ / ขาด / เกิน / ขาด-สลับ) แยกตามหมวดหมู่สินค้า
              </span>
            </div>
            <span className="text-[11px] text-purple-800 font-semibold">
              หมวดหมู่มาตรฐาน: SK, SKMC, HT, PN/SY/SLT/TS, HJ, PP, INN, KK, JB, KM, SPORT, BOX/BAG, GIFT
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-2xs bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs text-slate-700">
              <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider sticky top-0">
                <tr>
                  <th scope="col" className="py-3 px-3.5">หมวดหมู่สินค้า (Category)</th>
                  <th scope="col" className="py-3 px-3 text-center">สถานะส่งข้อมูล</th>
                  <th scope="col" className="py-3 px-3 text-center">จำนวน SKU</th>
                  <th scope="col" className="py-3 px-3 text-center">ระบบ vs สแกนจริง</th>
                  <th scope="col" className="py-3 px-3 text-center bg-slate-800 text-emerald-400">ตรงตามระบบ (MATCH)</th>
                  <th scope="col" className="py-3 px-3 text-center bg-slate-800 text-rose-400">สินค้าขาด (SHORTAGE)</th>
                  <th scope="col" className="py-3 px-3 text-center bg-slate-800 text-amber-400">สินค้าเกิน (OVER)</th>
                  <th scope="col" className="py-3 px-3 text-center bg-slate-800 text-purple-300">ขาด-สลับ (SWAP)</th>
                  <th scope="col" className="py-3 px-3 text-center">% ความแม่นยำ</th>
                  <th scope="col" className="py-3 px-3 text-center">ระดับความเสี่ยง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {categoryBreakdowns.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 font-medium">
                      ไม่มีรายการหมวดหมู่สินค้าในเดือน {summary.monthLabel}
                    </td>
                  </tr>
                ) : (
                  categoryBreakdowns.map((cat, cIdx) => (
                    <tr key={`cat-${cIdx}`} className="hover:bg-slate-50 transition-colors">
                      {/* Category Badge & Name */}
                      <td className="py-3 px-3.5 font-black text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-black px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded border border-purple-200">
                            {cat.categoryCode || 'CAT'}
                          </span>
                          <span className="text-xs text-slate-800">{cat.categoryLabel || cat.category}</span>
                        </div>
                      </td>

                      {/* Submission Status */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Check className="w-2.5 h-2.5 text-emerald-600" />
                          <span>
                            {cat.completedBranchesCount && cat.totalBranchesAuditing
                              ? `${cat.completedBranchesCount}/${cat.totalBranchesAuditing} สาขา`
                              : 'ส่งครบแล้ว'}
                          </span>
                        </span>
                      </td>

                      {/* Counted SKUs */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                        {cat.itemsCount} SKU
                      </td>

                      {/* System vs Scanned Units */}
                      <td className="py-3 px-3 text-center font-mono text-[11px]">
                        <span className="text-slate-600">ระบบ: {cat.totalSystemQty}</span>
                        <span className="mx-1 text-slate-300">/</span>
                        <span className="font-bold text-slate-900">สแกน: {cat.totalScannedQty}</span>
                      </td>

                      {/* MATCH */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700 bg-emerald-50/20">
                        {cat.matchCount} SKU
                      </td>

                      {/* SHORTAGE */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-rose-700 bg-rose-50/20">
                        <div>{cat.shortageCount} SKU</div>
                        <div className="text-[10px] text-rose-600">(-{cat.shortageQty} ชิ้น)</div>
                      </td>

                      {/* OVER */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-amber-700 bg-amber-50/20">
                        <div>{cat.overCount} SKU</div>
                        <div className="text-[10px] text-amber-600">(+{cat.overQty} ชิ้น)</div>
                      </td>

                      {/* SWAP / Mismatch */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-purple-700 bg-purple-50/20">
                        {cat.mismatchSwapCount ?? 0} SKU
                      </td>

                      {/* Accuracy % */}
                      <td className="py-3 px-3 text-center font-mono font-black">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                            cat.accuracyRate >= 95
                              ? 'bg-emerald-100 text-emerald-800'
                              : cat.accuracyRate >= 85
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {cat.accuracyRate}%
                        </span>
                      </td>

                      {/* Risk Level */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            cat.riskLevel === 'LOW'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : cat.riskLevel === 'MEDIUM'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {cat.riskLevel === 'LOW' ? 'ความเสี่ยงต่ำ' : cat.riskLevel === 'MEDIUM' ? 'ปานกลาง' : 'ความเสี่ยงสูง'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TABLE 3: สรุปผลคะแนน KPI คงคลัง และคำนวณ TOTAL KPI STOCK (100) แบบ Real-Time */}
      {activeSubTab === 'kpi' && (
        <div className="space-y-5">
          {/* KPI Stock Executive Summary Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-xl p-5 border border-slate-700 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  REAL-TIME TOTAL KPI STOCK EVALUATION (100 คะแนนเต็ม)
                </span>
                <h3 className="text-xl font-black text-white">
                  ผลการประเมินประสิทธิภาพการบริหารสต็อกและตรวจนับประจำเดือน {summary.monthLabel}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  คำนวณแบบ Real-Time จาก 4 เสาหลัก: ความแม่นยำตรวจนับ (40) + การส่งรายงานตรงเวลา (30) + ควบคุมสต็อกขาด/เกิน (20) + การกระทบยอด & ธรรมาภิบาล (10)
                </p>
              </div>

              <div className="flex items-center gap-4 bg-slate-800/80 p-3.5 rounded-lg border border-slate-700 shrink-0">
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">คะแนนสุทธิ</span>
                  <span className="text-3xl font-black text-amber-400">{summary.totalKpiStockScore}</span>
                  <span className="text-[10px] text-slate-400 block font-mono">/ 100</span>
                </div>
                <div className="h-10 w-px bg-slate-700" />
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">เกรดประเมิน</span>
                  <span
                    className={`text-2xl font-black ${
                      summary.kpiGrade === 'A+' || summary.kpiGrade === 'A'
                        ? 'text-emerald-400'
                        : summary.kpiGrade === 'B'
                        ? 'text-blue-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {summary.kpiGrade}
                  </span>
                  <span className="text-[9px] text-slate-400 block">
                    {summary.kpiGrade === 'A+' ? 'ดีเยี่ยม' : summary.kpiGrade === 'A' ? 'ดีมาก' : summary.kpiGrade === 'B' ? 'ผ่านเกณฑ์ดี' : 'ต้องปรับปรุง'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Pillars Breakdown Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-2xs bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs text-slate-700">
              <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th scope="col" className="py-3 px-3.5">เสาหลักเกณฑ์ KPI (Pillar & Criteria)</th>
                  <th scope="col" className="py-3 px-3 text-center">น้ำหนัก (Weight)</th>
                  <th scope="col" className="py-3 px-3 text-center">เป้าหมาย (Target)</th>
                  <th scope="col" className="py-3 px-3 text-center">ผลลัพธ์จริง (Actual Value)</th>
                  <th scope="col" className="py-3 px-3.5 text-center">คะแนนที่ได้ (Score)</th>
                  <th scope="col" className="py-3 px-3.5">รายละเอียดและการประเมิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {kpiPillarsList.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    {/* Title */}
                    <td className="py-3.5 px-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${p.badgeBg}`}>
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{p.title}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{p.desc}</div>
                        </div>
                      </div>
                    </td>

                    {/* Weight */}
                    <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-900">
                      {p.weight} คะแนน
                    </td>

                    {/* Target */}
                    <td className="py-3.5 px-3 text-center font-semibold text-slate-600 text-[11px]">
                      {p.target}
                    </td>

                    {/* Actual */}
                    <td className="py-3.5 px-3 text-center font-mono font-bold text-blue-700 text-[11px]">
                      {p.actual}
                    </td>

                    {/* Calculated Score */}
                    <td className="py-3.5 px-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-black font-mono text-xs border ${p.color}`}>
                        <span>{p.score}</span>
                        <span className="text-[10px] opacity-70">/ {p.weight}</span>
                      </span>
                    </td>

                    {/* Progress status */}
                    <td className="py-3.5 px-3.5">
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (p.score / p.weight) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono mt-1 block text-right">
                        {Math.round((p.score / p.weight) * 100)}% ของเป้าหมาย
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-300">
                <tr>
                  <td className="py-3 px-3.5 uppercase text-xs">รวมผลคะแนน TOTAL KPI STOCK (100 คะแนน)</td>
                  <td className="py-3 px-3 text-center font-mono text-xs">100 คะแนน</td>
                  <td className="py-3 px-3 text-center text-xs">เกณฑ์ผ่าน ≥ 80</td>
                  <td className="py-3 px-3 text-center font-mono text-xs text-blue-800">
                    เกรดประเมิน {summary.kpiGrade}
                  </td>
                  <td className="py-3 px-3.5 text-center font-mono text-sm text-amber-700">
                    {summary.totalKpiStockScore} / 100
                  </td>
                  <td className="py-3 px-3.5 text-xs text-slate-600">
                    {summary.totalKpiStockScore >= 90
                      ? 'ผ่านเกณฑ์มาตรฐานระดับสูงมาก (Excellent)'
                      : summary.totalKpiStockScore >= 80
                      ? 'ผ่านเกณฑ์มาตรฐานระดับดี (Good)'
                      : 'ควรเร่งรัดการตรวจนับและกระทบยอดสต็อก'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Actionable Recommendations Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs space-y-3">
            <h4 className="text-xs font-black uppercase text-slate-900 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>ข้อเสนอแนะเชิงปฏิบัติการสำหรับการปรับปรุงผลตรวจนับ (Audit Action Plan)</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded border border-slate-200">
                <span className="font-bold text-slate-900 block mb-1">1. ติดตามสาขาที่ยังไม่ส่งงาน</span>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  ประสานงานกับผู้ตรวจนับของสาขาที่สถานะยังไม่ส่งรายงาน หรือส่งไม่ครบตามรอบสัปดาห์ เพื่อให้ได้ข้อมูลกระทบยอด 100%
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded border border-slate-200">
                <span className="font-bold text-slate-900 block mb-1">2. ตรวจสอบหมวดสินค้าเสี่ยงสูง</span>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  มุ่งเน้นการตรวจนับซ้ำในหมวดหมู่ที่มีสินค้าขาดสูง ({summary.highestShortageCategory}) และสินค้าที่มีการสลับรหัสบาร์โค้ด
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded border border-slate-200">
                <span className="font-bold text-slate-900 block mb-1">3. ปรับปรุงสต็อกด้วย Overwrite/Append</span>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  ใช้ระบบนำเข้าไฟล์แบบ Overwrite Mode เมื่อตรวจนับครบทั้งสาขาเพื่ออัปเดตฐานข้อมูลให้ตรงกับยอดทางกายภาพ
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. TABLE 4: กราฟวิเคราะห์แนวโน้ม (Visual Analytics Charts) */}
      {activeSubTab === 'charts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chart 1: Category Accuracy Rate */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-tight flex items-center gap-1.5 mb-3">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              อัตราความแม่นยำแยกตามหมวดหมู่สินค้า (Accuracy % by Category)
            </h3>
            <div className="h-64 w-full">
              {categoryChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  ไม่มีข้อมูลสำหรับแสดงกราฟ
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-25} textAnchor="end" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} unit="%" />
                    <Tooltip
                      formatter={(val: any, name: any, item: any) => [`${val}% (${item.payload.fullName})`, 'Accuracy']}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '6px', color: '#fff', fontSize: '11px' }}
                    />
                    <Bar dataKey="accuracy" fill="#2563eb" radius={[4, 4, 0, 0]}>
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.accuracy >= 95 ? '#059669' : entry.accuracy >= 85 ? '#2563eb' : '#e11d48'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 2: Category Shortage & Over Units Volume */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-tight flex items-center gap-1.5 mb-3">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              เปรียบเทียบยอดขาด vs ยอดเกินแยกตามหมวดหมู่ (Shortage vs Over Units)
            </h3>
            <div className="h-64 w-full">
              {categoryChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  ไม่มีข้อมูลสำหรับแสดงกราฟ
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-25} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '6px', color: '#fff', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="shortageUnits" name="สต็อกขาด (ชิ้น)" fill="#e11d48" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="overUnits" name="สต็อกเกิน (ชิ้น)" fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
