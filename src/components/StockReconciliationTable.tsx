import React, { useState } from 'react';
import { Branch, StockItem, VarianceStatus, AuditStatus } from '../types';
import { safeParseItems } from '../utils/safeJsonParser';
import {
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Plus,
  Minus,
  Trash2,
  FileSpreadsheet,
  QrCode,
  Tag,
  MapPin,
  Send,
  Link,
  Check,
  Box,
  Building2,
  Lock,
  Unlock,
} from 'lucide-react';
import { exportToExcel } from '../utils/excelParser';

interface StockReconciliationTableProps {
  branches: Branch[];
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  onUpdateScannedQty: (branchId: string, itemId: string, newQty: number) => void;
  onDeleteItem: (branchId: string, itemId: string) => void;
  onOpenPdaScanner: (branchId: string) => void;
  onOpenUploadModal: () => void;
  onUpdateBranchStatus?: (branchId: string, status: AuditStatus) => void;
  userRole?: 'auditor' | 'branch';
  isSubmitting?: boolean;
}

export const StockReconciliationTable: React.FC<StockReconciliationTableProps> = ({
  branches,
  selectedBranchId,
  setSelectedBranchId,
  onUpdateScannedQty,
  onDeleteItem,
  onOpenPdaScanner,
  onUpdateBranchStatus,
  userRole = 'auditor',
  isSubmitting = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | VarianceStatus>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [copiedLink, setCopiedLink] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Get active branch object
  const activeBranch = branches.find((b) => b.id === selectedBranchId);

  // Flatten items with branch context
  const allFlatItems: { branch: Branch; item: StockItem }[] = [];
  branches.forEach((branch) => {
    if (selectedBranchId === 'ALL' || branch.id === selectedBranchId) {
      const itemList = safeParseItems(branch.items);
      itemList.forEach((item) => {
        if (item) {
          allFlatItems.push({ branch, item });
        }
      });
    }
  });

  // Extract unique categories & locations for dropdown filters
  const categories = Array.from(new Set(allFlatItems.map((fi) => fi.item?.category || 'ทั่วไป'))).filter(Boolean).sort();
  const locations = Array.from(new Set(allFlatItems.map((fi) => fi.item?.location || 'ไม่ระบุตำแหน่ง'))).filter(Boolean).sort();

  // Filter items
  const filteredFlatItems = allFlatItems.filter(({ item }) => {
    if (!item) return false;
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const matchesCat = categoryFilter === 'ALL' || item.category === categoryFilter;
    const matchesLoc = locationFilter === 'ALL' || item.location === locationFilter;
    const query = searchQuery.toLowerCase();
    const sku = (item.sku || '').toLowerCase();
    const barcode = (item.barcode || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    const location = (item.location || '').toLowerCase();
    const category = (item.category || '').toLowerCase();

    const matchesSearch =
      sku.includes(query) ||
      barcode.includes(query) ||
      name.includes(query) ||
      location.includes(query) ||
      category.includes(query);

    return matchesStatus && matchesCat && matchesLoc && matchesSearch;
  });

  // Count items by status
  const matchCount = allFlatItems.filter((fi) => fi.item.status === 'MATCH').length;
  const shortageCount = allFlatItems.filter((fi) => fi.item.status === 'SHORTAGE').length;
  const overCount = allFlatItems.filter((fi) => fi.item.status === 'OVER').length;

  const handleExportTable = () => {
    const itemsToExport = filteredFlatItems.map((fi) => fi.item);
    exportToExcel(itemsToExport, `stock_reconciliation_${selectedBranchId}.xlsx`);
  };

  const handleCopyBranchLink = () => {
    if (!activeBranch) return;
    const url = new URL(window.location.href);
    url.searchParams.set('branch', activeBranch.id);
    url.searchParams.set('tab', 'reconciliation');
    
    navigator.clipboard.writeText(url.toString()).then(
      () => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      },
      () => {
        alert(`ลิงค์ประจำสาขา: ${url.toString()}`);
      }
    );
  };

  const handleSubmitBranchReport = () => {
    if (!activeBranch || !onUpdateBranchStatus) return;
    if (
      confirm(
        `คุณต้องการยืนยันส่งรายงานกระทบยอดสต็อกของสาขา "${activeBranch.code} - ${activeBranch.name}" ใช่หรือไม่?\n\nเมื่อส่งแล้ว สถานะจะเปลี่ยนเป็น 'อนุมัติ/ส่งรายงานแล้ว' (SUBMITTED)`
      )
    ) {
      onUpdateBranchStatus(activeBranch.id, 'SUBMITTED');
      setStatusNotice(`ส่งรายงานกระทบยอดสต็อกของสาขา "${activeBranch.name}" เรียบร้อยแล้ว!`);
      setTimeout(() => setStatusNotice(null), 4000);
    }
  };

  const handleReopenBranchReport = () => {
    if (!activeBranch || !onUpdateBranchStatus) return;
    if (confirm(`คุณต้องการปลดล็อกการตรวจนับสาขา "${activeBranch.name}" กลับเป็น 'กำลังตรวจนับ' ใช่หรือไม่?`)) {
      onUpdateBranchStatus(activeBranch.id, 'IN_PROGRESS');
      setStatusNotice(`ปลดล็อกให้แก้ไขสแกนเพิ่มเติมสำหรับสาขา "${activeBranch.name}" แล้ว`);
      setTimeout(() => setStatusNotice(null), 4000);
    }
  };

  return (
    <div className="bg-white rounded border border-slate-200 shadow-2xs space-y-3 p-3 sm:p-4">
      {/* Table Title & Actions Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Tag className="w-4 h-4 text-blue-600" />
            ตารางเปรียบเทียบผลต่างการสแกนตรวจนับ (Stock Reconciliation)
          </h2>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            เปรียบเทียบระหว่างจำนวนที่สแกนจริง (Scanned Qty) กับจำนวนตามระบบ (System Qty) พร้อมสถานะสีทันที
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedBranchId !== 'ALL' && (
            <button
              onClick={() => onOpenPdaScanner(selectedBranchId)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition active:scale-95 shadow-2xs"
            >
              <QrCode className="w-3.5 h-3.5 text-blue-400" />
              <span>สแกนกล้องมือถือ / คีย์จำนวน</span>
            </button>
          )}

          <button
            onClick={handleExportTable}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition active:scale-95 shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>ส่งออกตาราง (Excel)</span>
          </button>
        </div>
      </div>

      {/* Branch Audit Control Banner (แสดงตรงหน้าเมนูกระทบยอดสต็อก) */}
      {activeBranch && selectedBranchId !== 'ALL' && (
        <div className="bg-slate-900 text-white p-3 rounded border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-mono text-xs font-extrabold">
                {activeBranch.code}
              </span>
              <h3 className="text-xs font-black text-white">{activeBranch.name}</h3>
              {activeBranch.auditStatus === 'SUBMITTED' ? (
                <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-black text-[10px] flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  ส่งรายงานแล้ว (SUBMITTED)
                </span>
              ) : activeBranch.auditStatus === 'IN_PROGRESS' ? (
                <span className="px-2 py-0.5 rounded bg-blue-500 text-white font-extrabold text-[10px] flex items-center gap-1">
                  <Unlock className="w-3 h-3" />
                  กำลังตรวจนับ (IN_PROGRESS)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-extrabold text-[10px]">
                  ยังไม่เริ่มตรวจ
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300 flex items-center gap-2">
              <span>ผู้ตรวจ: <strong className="text-blue-300">{activeBranch.assignedAuditor || 'เจ้าหน้าที่ Audit'}</strong></span>
              <span>•</span>
              <span>จำนวนรายการ: <strong className="text-amber-300 font-mono">{(activeBranch.items || []).length} SKU</strong></span>
              {activeBranch.submittedAt && (
                <>
                  <span>•</span>
                  <span className="text-emerald-300 font-mono text-[10px]">ส่งเมื่อ {new Date(activeBranch.submittedAt).toLocaleTimeString('th-TH')}</span>
                </>
              )}
            </p>
          </div>

          {/* Action Buttons: Submit Report & Copy Share Link */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleCopyBranchLink}
              className="px-3 py-1.5 rounded text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
              title="คัดลอกลิงค์ตรงเห็นเฉพาะสาขานี้"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link className="w-3.5 h-3.5 text-blue-400" />}
              <span>{copiedLink ? 'คัดลอกลิงค์แล้ว!' : 'คัดลอกลิงค์สาขา'}</span>
            </button>

            {activeBranch.auditStatus === 'SUBMITTED' ? (
              userRole === 'branch' ? (
                <span className="px-3 py-1.5 rounded text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  🔒 รายงานถูกล็อกแล้ว (ติดต่อผู้ตรวจสอบหากต้องการแก้ไข)
                </span>
              ) : (
                <button
                  onClick={handleReopenBranchReport}
                  className="px-3.5 py-1.5 rounded text-xs font-bold bg-amber-600 hover:bg-amber-500 text-slate-950 transition flex items-center gap-1.5 shadow-2xs"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>ปลดล็อกแก้ไข</span>
                </button>
              )
            ) : (
              <button
                onClick={handleSubmitBranchReport}
                className="px-3.5 py-1.5 rounded text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>ส่งรายงานกระทบยอดสาขานี้</span>
              </button>
            )}
          </div>
        </div>
      )}

      {statusNotice && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200">
        {/* Search */}
        <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            placeholder="ค้นหา SKU, Barcode, ชื่อ, เลขลัง..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-800"
          />
        </div>

        {/* Branch Filter */}
        <div className="flex items-center bg-white border border-slate-300 rounded px-2 py-1">
          <Building2 className="w-3.5 h-3.5 text-blue-500 mr-1.5 shrink-0" />
          <select
            value={selectedBranchId}
            onChange={(e) => {
              setSelectedBranchId(e.target.value);
              setLocationFilter('ALL');
            }}
            className="w-full bg-transparent text-xs text-slate-800 focus:outline-none cursor-pointer font-medium"
          >
            <option value="ALL">🌐 ทุกสาขา (All Branches)</option>
            {branches.map((b, idx) => (
              <option key={`${b.id}-${idx}`} value={b.id}>
                {b.code} - {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Location / Bin Filter (ค้นหาและกรองตำแหน่งเลขลัง) */}
        <div className="flex items-center bg-white border border-slate-300 rounded px-2 py-1">
          <Box className="w-3.5 h-3.5 text-amber-500 mr-1.5 shrink-0" />
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-800 focus:outline-none cursor-pointer font-bold text-amber-900"
          >
            <option value="ALL">📍 ทุกตำแหน่ง / เลขลัง ({locations.length})</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                📍 {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div className="flex items-center bg-white border border-slate-300 rounded px-2 py-1">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-800 focus:outline-none cursor-pointer font-medium"
          >
            <option value="ALL">📦 ทุกหมวดหมู่ ({categories.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Stats Filter Tabs */}
        <div className="flex items-center gap-1 bg-white p-1 rounded border border-slate-300 overflow-x-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-2 py-0.5 text-[11px] font-bold rounded ${
              statusFilter === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ทั้งหมด ({allFlatItems.length})
          </button>
          <button
            onClick={() => setStatusFilter('MATCH')}
            className={`px-2 py-0.5 text-[11px] font-bold rounded flex items-center gap-1 ${
              statusFilter === 'MATCH' ? 'bg-emerald-700 text-white' : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            MATCH ({matchCount})
          </button>
          <button
            onClick={() => setStatusFilter('SHORTAGE')}
            className={`px-2 py-0.5 text-[11px] font-bold rounded flex items-center gap-1 ${
              statusFilter === 'SHORTAGE' ? 'bg-rose-700 text-white' : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            SHORTAGE ({shortageCount})
          </button>
          <button
            onClick={() => setStatusFilter('OVER')}
            className={`px-2 py-0.5 text-[11px] font-bold rounded flex items-center gap-1 ${
              statusFilter === 'OVER' ? 'bg-amber-600 text-white' : 'text-amber-800 hover:bg-amber-50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            OVER ({overCount})
          </button>
        </div>
      </div>

      {/* Main Reconciliation Table */}
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white text-[11px] font-bold tracking-wider uppercase">
              <th className="py-2.5 px-2.5">สาขา / Location</th>
              <th className="py-2.5 px-2.5">รหัสสินค้า / Barcode</th>
              <th className="py-2.5 px-2.5">ชื่อสินค้า & หมวดหมู่</th>
              <th className="py-2.5 px-2.5 text-center">จำนวนระบบ (System Qty)</th>
              <th className="py-2.5 px-2.5 text-center">จำนวนสแกนจริง (Scanned Qty)</th>
              <th className="py-2.5 px-2.5 text-center">ผลต่าง (Variance)</th>
              <th className="py-2.5 px-2.5 text-center">สถานะ (Status / Color)</th>
              <th className="py-2.5 px-2.5 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
            {filteredFlatItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                  ไม่พบข้อมูลสินค้าตรงตามเงื่อนไขการค้นหา
                </td>
              </tr>
            ) : (
              filteredFlatItems.map(({ branch, item }, index) => {
                const isBranchLocked = branch.auditStatus === 'SUBMITTED';
                return (
                  <tr
                    key={`${branch.id}-${item.id}-${index}`}
                    className={`hover:bg-slate-50 transition-colors ${
                      item.status === 'SHORTAGE'
                        ? 'bg-rose-50/40'
                        : item.status === 'OVER'
                        ? 'bg-amber-50/40'
                        : ''
                    }`}
                  >
                    {/* Branch & Location */}
                    <td className="py-2 px-2.5 font-medium">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold border border-slate-200 mr-1">
                        {branch.code}
                      </span>
                      <span className="text-slate-900 font-bold">{branch.name}</span>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{item.location}</span>
                      </div>
                    </td>

                    {/* SKU / Barcode */}
                    <td className="py-2 px-2.5">
                      <div className="font-mono font-bold text-slate-900">{item.sku || item.barcode || item.name || 'SKU-001'}</div>
                      <div className="font-mono text-[10px] text-slate-500">{item.barcode || item.sku || '-'}</div>
                    </td>

                    {/* Name & Category */}
                    <td className="py-2 px-2.5 max-w-xs">
                      <div className="font-bold text-slate-900 truncate">{item.name}</div>
                      <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                        {item.category}
                      </span>
                    </td>

                    {/* System Qty */}
                    <td className="py-2 px-2.5 text-center font-bold text-slate-700 text-xs bg-slate-50/50">
                      {item.systemQty}
                    </td>

                    {/* Scanned Qty with Interactive Adjust */}
                    <td className="py-2 px-2.5 text-center">
                      <div className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded p-0.5 shadow-2xs">
                        {!isBranchLocked && (
                          <button
                            onClick={() =>
                              onUpdateScannedQty(branch.id, item.id, Math.max(0, item.scannedQty - 1))
                            }
                            className="p-1 rounded hover:bg-slate-100 text-slate-600 transition"
                            title="ลด 1"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                        )}

                        <input
                          type="number"
                          min="0"
                          value={item.scannedQty}
                          disabled={isBranchLocked}
                          onChange={(e) =>
                            onUpdateScannedQty(branch.id, item.id, Math.max(0, parseInt(e.target.value) || 0))
                          }
                          className={`w-12 text-center font-black text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded ${
                            isBranchLocked ? 'bg-slate-50 border-transparent text-slate-500' : ''
                          }`}
                        />

                        {!isBranchLocked && (
                          <button
                            onClick={() => onUpdateScannedQty(branch.id, item.id, item.scannedQty + 1)}
                            className="p-1 rounded hover:bg-slate-100 text-slate-600 transition"
                            title="เพิ่ม 1"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Variance = Scanned - System */}
                    <td className="py-2 px-2.5 text-center font-bold text-xs">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-mono ${
                          item.variance === 0
                            ? 'text-slate-700 bg-slate-100 border border-slate-200'
                            : item.variance < 0
                            ? 'text-rose-800 bg-rose-100 border border-rose-200'
                            : 'text-amber-900 bg-amber-100 border border-amber-200'
                        }`}
                      >
                        {item.variance > 0 ? `+${item.variance}` : item.variance}
                      </span>
                    </td>

                    {/* Status & Color Badge */}
                    <td className="py-2 px-2.5 text-center">
                      {item.status === 'MATCH' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          MATCH (GREEN)
                        </span>
                      )}

                      {item.status === 'SHORTAGE' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-300">
                          <AlertCircle className="w-3 h-3 text-rose-700" />
                          SHORTAGE (RED)
                        </span>
                      )}

                      {item.status === 'OVER' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-950 border border-amber-300">
                          <AlertTriangle className="w-3 h-3 text-amber-700" />
                          OVER (YELLOW)
                        </span>
                      )}
                    </td>

                    {/* Delete / Actions */}
                    <td className="py-2 px-2.5 text-right">
                      {isBranchLocked ? (
                        <span className="p-1 inline-flex text-slate-400" title="รายการนี้ถูกล็อกแล้วเนื่องจากส่งรายงานแล้ว">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                        </span>
                      ) : (
                        <button
                          onClick={() => !isSubmitting && onDeleteItem(branch.id, item.id)}
                          disabled={isSubmitting}
                          className={`p-1 rounded transition ${
                            isSubmitting ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          }`}
                          title="ลบรายการนี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

