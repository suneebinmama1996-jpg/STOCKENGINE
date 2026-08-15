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
  Filter,
  Search,
  ArrowUpDown,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Clock,
  Sparkles,
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
  const [activeSubTab, setActiveSubTab] = useState<'scorecard' | 'category' | 'charts'>('scorecard');

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
      name: c.category,
      accuracy: c.accuracyRate,
      shortageUnits: c.shortageQty,
      overUnits: c.overQty,
      totalUnits: c.totalScannedQty,
    }));
  }, [categoryBreakdowns]);

  return (
    <div className="space-y-5 pb-12">
      {/* 1. Header & Monthly Selection Controls */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded bg-blue-600 text-white shadow-xs">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  MONTHLY AUDIT & CYCLE COUNT PERFORMANCE SCORECARD
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  รายงานสรุปและคะแนนตรวจนับประจำเดือนสำหรับฝ่ายตรวจสอบ (HQ Executive & Audit Report)
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
                className="p-1 rounded hover:bg-slate-200 text-slate-600 transition"
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
                className="p-1 rounded hover:bg-slate-200 text-slate-600 transition"
                title="เดือนถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Export Monthly Report Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-2xs active:scale-95 border border-emerald-600"
            >
              <Download className="w-4 h-4" />
              <span>Export Monthly Report (Excel)</span>
            </button>
          </div>
        </div>

        {/* 2. Executive Key Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-slate-100">
          {/* Card 1: Submission Rate */}
          <div className="bg-slate-50 rounded p-3 border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              อัตราส่งงานรวม
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
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${summary.overallSubmissionRate}%` }}
              />
            </div>
          </div>

          {/* Card 2: Overall Accuracy */}
          <div className="bg-slate-50 rounded p-3 border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              ความแม่นยำรวม (Accuracy)
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-emerald-700">
                {summary.overallAccuracyRate}%
              </span>
              <span className="text-[10px] text-emerald-600 font-bold">Cycle Count</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${summary.overallAccuracyRate}%` }}
              />
            </div>
          </div>

          {/* Card 3: Grade Distribution */}
          <div className="bg-slate-50 rounded p-3 border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              เกรดประเมินสาขา
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                A: {summary.gradeACount}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                B: {summary.gradeBCount}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                C: {summary.gradeCCount}
              </span>
            </div>
            <span className="text-[9px] text-slate-400 mt-1 block">A $\ge$95%, B 85-94%</span>
          </div>

          {/* Card 4: Top Audited Category */}
          <div className="bg-slate-50 rounded p-3 border border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block flex items-center gap-1">
              <Package className="w-3 h-3 text-blue-600" />
              หมวดหมู่นับบ่อยสุด
            </span>
            <div className="text-xs font-black text-slate-900 mt-1 truncate" title={summary.topAuditedCategory}>
              {summary.topAuditedCategory}
            </div>
            <span className="text-[9px] text-blue-600 font-semibold mt-0.5 block">ตรวจนับครอบคลุม</span>
          </div>

          {/* Card 5: Highest Shortage */}
          <div className="bg-rose-50/70 rounded p-3 border border-rose-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-600" />
              สต็อกขาดสูงสุด (Shortage)
            </span>
            <div className="text-xs font-black text-rose-900 mt-1 truncate" title={summary.highestShortageCategory}>
              {summary.highestShortageCategory}
            </div>
            <span className="text-[9px] text-rose-600 font-semibold mt-0.5 block">
              รวมขาด: {summary.totalShortageUnits.toLocaleString()} ชิ้น
            </span>
          </div>

          {/* Card 6: Highest Over */}
          <div className="bg-amber-50/70 rounded p-3 border border-amber-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-amber-600" />
              สต็อกเกินสูงสุด (Over)
            </span>
            <div className="text-xs font-black text-amber-900 mt-1 truncate" title={summary.highestOverCategory}>
              {summary.highestOverCategory}
            </div>
            <span className="text-[9px] text-amber-600 font-semibold mt-0.5 block">
              รวมเกิน: {summary.totalOverUnits.toLocaleString()} ชิ้น
            </span>
          </div>
        </div>
      </div>

      {/* 3. Sub Navigation Tabs (Scorecard vs Category Breakdown vs Visual Charts) */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveSubTab('scorecard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
              activeSubTab === 'scorecard'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>ตารางคะแนนรายสาขา (Branch Scorecard)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800">
              {filteredScorecards.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('category')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
              activeSubTab === 'category'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>สรุปหมวดหมู่สินค้า (Category Breakdown)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800">
              {categoryBreakdowns.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('charts')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
              activeSubTab === 'charts'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>กราฟวิเคราะห์แนวโน้ม (Analytics Charts)</span>
          </button>
        </div>

        {/* Quick Search & Grade Filter (when in Scorecard tab) */}
        {activeSubTab === 'scorecard' && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="ค้นหาสาขา, ผู้ตรวจ, หมวดหมู่..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 sm:w-60 px-2.5 py-1 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
              />
            </div>

            {/* Grade Filter */}
            <div className="inline-flex rounded border border-slate-200 p-0.5 bg-slate-100 text-xs">
              {(['ALL', 'A', 'B', 'C', 'D'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGradeFilter(g)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
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

      {/* 4. TAB 1: Branch Performance Scorecard Table */}
      {activeSubTab === 'scorecard' && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-2xs bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th scope="col" className="py-3 px-3.5">สาขา & ภูมิภาค</th>
                <th scope="col" className="py-3 px-3.5">ผู้ตรวจนับ</th>
                <th scope="col" className="py-3 px-3.5 text-center">
                  การส่งงาน (Submission Rate)
                </th>
                <th scope="col" className="py-3 px-3.5">
                  หมวดหมู่ที่ตรวจนับ (Categories)
                </th>
                <th scope="col" className="py-3 px-3.5 text-center">
                  รายการสแกน & สต็อกขาด/เกิน
                </th>
                <th scope="col" className="py-3 px-3.5 text-center">
                  ความแม่นยำ (Accuracy %)
                </th>
                <th scope="col" className="py-3 px-3.5 text-center">
                  เกรดประเมิน
                </th>
                <th scope="col" className="py-3 px-3.5 text-right">
                  การกระทำ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredScorecards.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 font-medium">
                    ไม่พบข้อมูลสาขาในเงื่อนไขการค้นหาประจำเดือน {summary.monthLabel}
                  </td>
                </tr>
              ) : (
                filteredScorecards.map((sc, index) => {
                  const isGradeA = sc.grade === 'A';
                  const isGradeB = sc.grade === 'B';

                  return (
                    <tr key={`scorecard-${sc.branchId}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                      {/* Branch Info */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-black px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200">
                            {sc.branchCode}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">{sc.region}</span>
                        </div>
                        <div className="text-xs font-black text-slate-900 mt-1">{sc.branchName}</div>
                      </td>

                      {/* Auditor */}
                      <td className="py-3 px-3.5">
                        <span className="text-xs font-semibold text-slate-800">{sc.assignedAuditor}</span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          ตรวจล่าสุด: {sc.lastAuditDate || '-'}
                        </div>
                      </td>

                      {/* Submission Rate */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-xs font-black text-slate-900">
                            {sc.submittedRounds}/{sc.requiredRounds} รอบ ({sc.submissionRate}%)
                          </span>
                          <div className="w-16 bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
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
                        </div>
                      </td>

                      {/* Categories Audited */}
                      <td className="py-3 px-3.5 max-w-[200px]">
                        <div className="flex flex-wrap gap-1">
                          {sc.categoriesAudited.length > 0 ? (
                            sc.categoriesAudited.map((cat, cIdx) => (
                              <span
                                key={cIdx}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                              >
                                <Tag className="w-2.5 h-2.5 text-blue-500" />
                                <span>{cat}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">ไม่มีหมวดหมู่</span>
                          )}
                        </div>
                      </td>

                      {/* Scan & Variance Breakdown */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="text-[11px] font-mono text-slate-800">
                          <span className="font-bold">{sc.totalItems}</span> SKU ({sc.totalScannedQty} ชิ้น)
                        </div>
                        <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono mt-0.5">
                          <span className="text-emerald-700 font-bold">ตรง: {sc.matchCount}</span>
                          <span className="text-rose-600 font-bold">ขาด: {sc.shortageCount}</span>
                          <span className="text-amber-600 font-bold">เกิน: {sc.overCount}</span>
                        </div>
                      </td>

                      {/* Cycle Count Accuracy % */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`text-sm font-black tracking-tight ${
                              sc.accuracyRate >= 95
                                ? 'text-emerald-700'
                                : sc.accuracyRate >= 85
                                ? 'text-blue-700'
                                : 'text-rose-600'
                            }`}
                          >
                            {sc.accuracyRate}%
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium">
                            ({sc.matchCount}/{sc.totalItems} SKU)
                          </span>
                        </div>
                      </td>

                      {/* Grade Badge */}
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black shadow-2xs border ${
                            isGradeA
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : isGradeB
                              ? 'bg-blue-100 text-blue-900 border-blue-300'
                              : 'bg-amber-100 text-amber-900 border-amber-300'
                          }`}
                        >
                          {isGradeA && <Sparkles className="w-3 h-3 text-emerald-600" />}
                          <span>Grade {sc.grade}</span>
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          {onOpenPdaScanner && (
                            <button
                              type="button"
                              onClick={() => onOpenPdaScanner(sc.branchId)}
                              className="px-2 py-1 rounded text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition border border-slate-200"
                              title="เปิดสแกนเนอร์"
                            >
                              สแกน
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelectBranchForReconciliation(sc.branchId)}
                            className="px-2.5 py-1 rounded text-[11px] font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-2xs flex items-center gap-1"
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
      )}

      {/* 5. TAB 2: Category Breakdown Table */}
      {activeSubTab === 'category' && (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-2xs bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th scope="col" className="py-3 px-3.5">หมวดหมู่สินค้า (Category)</th>
                  <th scope="col" className="py-3 px-3.5 text-center">จำนวน SKU ที่นับ</th>
                  <th scope="col" className="py-3 px-3.5 text-center">จำนวนชิ้นระบบ vs สแกนจริง</th>
                  <th scope="col" className="py-3 px-3.5 text-center">ตรงตามระบบ (MATCH)</th>
                  <th scope="col" className="py-3 px-3.5 text-center bg-rose-50/40">สต็อกขาด (SHORTAGE)</th>
                  <th scope="col" className="py-3 px-3.5 text-center bg-amber-50/40">สต็อกเกิน (OVER)</th>
                  <th scope="col" className="py-3 px-3.5 text-center">ความแม่นยำ (Accuracy %)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {categoryBreakdowns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                      ไม่มีรายการหมวดหมู่สินค้าในเดือน {summary.monthLabel}
                    </td>
                  </tr>
                ) : (
                  categoryBreakdowns.map((cat, cIdx) => (
                    <tr key={`cat-${cIdx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5 font-black text-slate-900 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-blue-600" />
                        <span>{cat.category}</span>
                      </td>

                      <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-800">
                        {cat.itemsCount} SKU
                      </td>

                      <td className="py-3 px-3.5 text-center font-mono text-[11px]">
                        <span className="text-slate-600">ระบบ: {cat.totalSystemQty}</span>
                        <span className="mx-1 text-slate-300">/</span>
                        <span className="font-bold text-slate-900">สแกน: {cat.totalScannedQty}</span>
                      </td>

                      <td className="py-3 px-3.5 text-center font-mono font-bold text-emerald-700">
                        {cat.matchCount} รายการ
                      </td>

                      <td className="py-3 px-3.5 text-center font-mono font-bold text-rose-700 bg-rose-50/20">
                        {cat.shortageCount} รายการ ({cat.shortageQty} ชิ้น)
                      </td>

                      <td className="py-3 px-3.5 text-center font-mono font-bold text-amber-700 bg-amber-50/20">
                        {cat.overCount} รายการ ({cat.overQty} ชิ้น)
                      </td>

                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded font-black font-mono text-xs ${
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB 3: Visual Analytics Charts */}
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
                      formatter={(val: any) => [`${val}%`, 'Accuracy']}
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
