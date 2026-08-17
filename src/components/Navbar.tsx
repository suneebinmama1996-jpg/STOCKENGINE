import React from 'react';
import {
  Boxes,
  LayoutDashboard,
  QrCode,
  FileCode2,
  Upload,
  RotateCcw,
  Download,
  Building2,
  CheckCircle2,
  Plus,
  Award,
  RefreshCw,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'dashboard' | 'monthly' | 'reconciliation' | 'pda' | 'json';
  setActiveTab: (tab: 'dashboard' | 'monthly' | 'reconciliation' | 'pda' | 'json') => void;
  onOpenUploadModal: () => void;
  onOpenBranchManager: () => void;
  onResetData: () => void;
  onExportAllExcel: () => void;
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  branches: Array<{ id: string; name: string; code: string; auditStatus: string }>;
  userRole: 'auditor' | 'branch';
  setUserRole: (role: 'auditor' | 'branch') => void;
  isConnected?: boolean;
  isOffline?: boolean;
  isSubmitting?: boolean;
  onSyncFromCloud?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenUploadModal,
  onOpenBranchManager,
  onResetData,
  onExportAllExcel,
  selectedBranchId,
  setSelectedBranchId,
  branches,
  userRole,
  setUserRole,
  isConnected = true,
  isOffline = false,
  isSubmitting = false,
  onSyncFromCloud,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-2.5 gap-3">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center shadow-sm text-white font-black text-sm">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-white uppercase">
                  STOCK<span className="text-blue-400">ENGINE</span>
                </h1>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40">
                  v2.0 PROD
                </span>
                {!isOffline && isConnected ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-600/30 text-emerald-300 border border-emerald-500/40" title="เชื่อมต่อและบันทึกฐานข้อมูลคลาวด์แบบเรียลไทม์เรียบร้อย">
                    {isSubmitting ? (
                      <span className="w-2.5 h-2.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    )}
                    {isSubmitting ? 'กำลังซิงค์ (Syncing)' : 'คลาวด์ซิงค์ (Cloud Active)'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-600/30 text-amber-300 border border-amber-500/40" title="กำลังทำงานในโหมดออฟไลน์และบันทึกข้อมูลในเครื่อง">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    โหมดออฟไลน์ (Offline Mode)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                ระบบประมวลผลการตรวจนับสต็อก & Audit Dashboard หลายสาขา
              </p>
            </div>
          </div>

          {/* Branch Quick Switcher & Header Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Role Switcher - Hidden if entered through branch link */}
            {!(typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('branch')) ? (
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setUserRole('auditor')}
                  className={`px-2.5 py-1.5 rounded-md text-[10px] font-extrabold transition-all whitespace-nowrap flex items-center gap-1 ${
                    userRole === 'auditor'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="สลับเป็นโหมดผู้ตรวจสอบบัญชี (HQ / Auditor)"
                >
                  🔎 ผู้ตรวจสอบ (HQ)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserRole('branch');
                    if (activeTab === 'dashboard' || activeTab === 'json') {
                      setActiveTab('reconciliation');
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-md text-[10px] font-extrabold transition-all whitespace-nowrap flex items-center gap-1 ${
                    userRole === 'branch'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-emerald-400'
                  }`}
                  title="สลับเป็นโหมดพนักงานสาขา (Branch Staff)"
                >
                  🏬 พนักงานสาขา
                </button>
              </div>
            ) : (
              <div className="px-2.5 py-1.5 rounded bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-1 border border-emerald-500 shadow-sm whitespace-nowrap">
                🏬 พนักงานสาขา (โหมดสแกนตรวจนับ)
              </div>
            )}

            {/* Branch Selector */}
            <div className={`relative flex items-center bg-slate-800 border border-slate-700 rounded px-2.5 py-1 ${(typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('branch')) ? 'opacity-75 cursor-not-allowed' : ''}`}>
              <Building2 className="w-3.5 h-3.5 text-blue-400 mr-1.5 shrink-0" />
              <select
                value={selectedBranchId}
                disabled={typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('branch')}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className={`bg-transparent text-xs font-semibold text-slate-200 focus:outline-none pr-3 ${(typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('branch')) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <option value="ALL" className="bg-slate-900 text-slate-200">
                  🌐 ทุกสาขา (All Branches)
                </option>
                {branches.map((b, idx) => (
                  <option key={`${b.id}-${idx}`} value={b.id} className="bg-slate-900 text-slate-200">
                    {b.code} - {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Branch Manager Button - HIDDEN FOR BRANCH ROLE */}
            {userRole !== 'branch' && (
              <button
                onClick={onOpenBranchManager}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95"
                title="เพิ่มสาขาใหม่ หรือ แก้ไข/ลบสาขาที่มีอยู่"
              >
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                <span>เพิ่ม/จัดการสาขา</span>
              </button>
            )}

            {/* Quick Master Upload (เสมอภาคทั้งคู่สามารถนำเข้าได้) */}
            <button
              onClick={onOpenUploadModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition shadow-xs active:scale-95"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>นำเข้า Excel/JSON</span>
            </button>

            {/* Sync from Cloud */}
            {onSyncFromCloud && (
              <button
                onClick={onSyncFromCloud}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95 disabled:opacity-50"
                title="ดึงข้อมูลสต็อกล่าสุดจาก Google Sheets (Sync from Cloud)"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSubmitting ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">ซิงค์คลาวด์</span>
              </button>
            )}

            {/* Export Report */}
            <button
              onClick={onExportAllExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95"
              title="ส่งออกรายงาน Excel ทั้งหมด"
            >
              <Download className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>

            {/* Reset Data - HIDDEN FOR BRANCH ROLE */}
            {userRole !== 'branch' && (
              <button
                onClick={onResetData}
                className="p-1.5 rounded text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-800 border border-slate-800 transition"
                title="ล้างและรีเซ็ตฐานข้อมูลทั้งหมด (Clear All Database)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto space-x-1 border-t border-slate-800/80 pt-1 pb-1 scrollbar-none">
          {userRole !== 'branch' && (
            <>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded transition whitespace-nowrap ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Audit Dashboard</span>
              </button>

              <button
                onClick={() => setActiveTab('monthly')}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded transition whitespace-nowrap ${
                  activeTab === 'monthly'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title="รายงานสรุปและคะแนนตรวจนับประจำเดือน (Monthly Audit Scorecard)"
              >
                <Award className="w-3.5 h-3.5 text-amber-300" />
                <span>รายงานประจำเดือน (Monthly Scorecard)</span>
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded transition whitespace-nowrap ${
              activeTab === 'reconciliation'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>กระทบยอดสต็อก (Reconciliation Table)</span>
          </button>

          <button
            onClick={() => setActiveTab('pda')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded transition whitespace-nowrap ${
              activeTab === 'pda'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>สแกนกล้องมือถือ / ป้อนเลข</span>
          </button>

          {userRole !== 'branch' && (
            <button
              onClick={() => setActiveTab('json')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded transition whitespace-nowrap ${
                activeTab === 'json'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono">JSON Engine Output (Schema)</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
