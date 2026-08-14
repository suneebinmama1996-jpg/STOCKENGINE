import React, { useState } from 'react';
import { Branch, AuditStatus } from '../types';
import { safeParseItems } from '../utils/safeJsonParser';
import { normalizeBranchData, normalizeBranchesList } from '../utils/branchNormalizer';
import {
  Building2,
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
  MapPin,
  UserCheck,
  AlertTriangle,
  Layers,
  Link,
  Copy,
  Clock,
  Unlock,
  Lock,
} from 'lucide-react';

interface BranchManagerModalProps {
  branches: Branch[];
  onAddBranch: (data: {
    code: string;
    name: string;
    region: string;
    assignedAuditor?: string;
    auditStatus?: AuditStatus;
  }) => void;
  onEditBranch: (
    branchId: string,
    data: {
      code: string;
      name: string;
      region: string;
      assignedAuditor?: string;
      auditStatus?: AuditStatus;
    }
  ) => void;
  onDeleteBranch: (branchId: string) => void;
  onClose: () => void;
  initialMode?: 'ADD' | 'LIST';
  isSubmitting?: boolean;
}

export const BranchManagerModal: React.FC<BranchManagerModalProps> = ({
  branches,
  onAddBranch,
  onEditBranch,
  onDeleteBranch,
  onClose,
  initialMode = 'LIST',
  isSubmitting = false,
}) => {
  const cleanBranches = normalizeBranchesList(branches);
  const [activeTab, setActiveTab] = useState<'LIST' | 'ADD'>(initialMode);
  const [copiedBranchId, setCopiedBranchId] = useState<string | null>(null);
  const [createdBranchNotice, setCreatedBranchNotice] = useState<{ id: string; code: string; name: string } | null>(null);
  
  // Add Branch Form State - Strictly mapped according to key specification
  const [newCode, setNewCode] = useState(`BR-00${cleanBranches.length + 1}`);
  const [newName, setNewName] = useState('');
  const [newRegion, setNewRegion] = useState('กรุงเทพฯ และปริมณฑล');
  const [newAuditor, setNewAuditor] = useState('');
  const [newStatus, setNewStatus] = useState<AuditStatus>('NOT_STARTED');

  // Editing State - Strictly mapped according to key specification
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editRegion, setEditRegion] = useState('');
  const [editAuditor, setEditAuditor] = useState('');
  const [editStatus, setEditStatus] = useState<AuditStatus>('NOT_STARTED');

  const getBranchUrl = (branchId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('branch', branchId);
    url.searchParams.set('tab', 'reconciliation');
    return url.toString();
  };

  const handleCopyLink = (branchId: string) => {
    const link = getBranchUrl(branchId);
    navigator.clipboard.writeText(link).then(
      () => {
        setCopiedBranchId(branchId);
        setTimeout(() => setCopiedBranchId(null), 2500);
      },
      () => {
        alert(`ลิงค์ประจำสาขา: ${link}`);
      }
    );
  };

  const handleStartEdit = (rawBranch: Branch) => {
    const b = normalizeBranchData(rawBranch);
    setEditingBranchId(rawBranch.id || b.id);
    setEditCode(b.code || b.id || '');
    setEditName(b.name || '');
    setEditRegion(b.region || 'ทั่วไป');
    setEditAuditor(b.assignedAuditor === 'เจ้าหน้าที่ Audit' ? '' : (b.assignedAuditor || ''));
    setEditStatus(b.auditStatus || 'NOT_STARTED');
  };

  const handleSaveEdit = (branchId: string) => {
    if (!editName.trim()) {
      alert('กรุณาระบุชื่อสาขา');
      return;
    }
    onEditBranch(branchId, {
      code: editCode.trim() || branchId,
      name: editName.trim(),
      region: editRegion.trim() || 'ทั่วไป',
      assignedAuditor: editAuditor.trim() || 'เจ้าหน้าที่ Audit',
      auditStatus: editStatus,
    });
    setEditingBranchId(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert('กรุณาระบุชื่อสาขา');
      return;
    }

    const createdCode = newCode.trim() || `BR-00${branches.length + 1}`;
    const createdName = newName.trim();
    const createdRegion = newRegion.trim() || 'ทั่วไป';
    const createdAuditor = newAuditor.trim() || 'เจ้าหน้าที่ Audit';

    onAddBranch({
      code: createdCode,
      name: createdName,
      region: createdRegion,
      assignedAuditor: createdAuditor,
      auditStatus: newStatus,
    });

    // Notice for link sharing
    setCreatedBranchNotice({
      id: createdCode,
      code: createdCode,
      name: createdName,
    });

    // Reset Form
    setNewName('');
    setNewAuditor('');
    setNewRegion('กรุงเทพฯ และปริมณฑล');
    setNewStatus('NOT_STARTED');
    setNewCode(`BR-00${branches.length + 2}`);
    setActiveTab('LIST');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded border border-slate-200 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-tight">
                จัดการข้อมูลสาขา (Branch Management)
              </h3>
              <p className="text-[11px] text-slate-400">
                เพิ่มสาขาใหม่, แก้ไขรหัส/ผู้ตรวจ, และลบสาขาออกจากระบบ
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2">
          <button
            onClick={() => setActiveTab('LIST')}
            className={`px-3 py-1.5 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === 'LIST'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>รายการสาขาทั้งหมด ({cleanBranches.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ADD')}
            className={`px-3 py-1.5 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === 'ADD'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ เพิ่มสาขาใหม่</span>
          </button>
        </div>

        {/* Main Body Content */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {activeTab === 'LIST' && (
            <div className="space-y-3">
              {/* Created Branch Link Banner Notice */}
              {createdBranchNotice && (
                <div className="p-3 bg-emerald-50 border-2 border-emerald-500 rounded text-emerald-950 space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>เพิ่มสาขาใหม่ "{createdBranchNotice.code} - {createdBranchNotice.name}" สำเร็จแล้ว!</span>
                    </span>
                    <button
                      onClick={() => setCreatedBranchNotice(null)}
                      className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    คุณสามารถคัดลอกลิงค์เฉพาะของสาขานี้ เพื่อส่งให้พนักงานประจำสาขาดูและสแกนเฉพาะข้อมูลของสาขาตนเองได้ทันที
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      readOnly
                      value={getBranchUrl(createdBranchNotice.id)}
                      className="w-full bg-white text-[11px] font-mono border border-emerald-300 rounded px-2 py-1 text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(createdBranchNotice.id)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition shrink-0 flex items-center gap-1"
                    >
                      {copiedBranchId === createdBranchNotice.id ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>คัดลอกแล้ว!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>คัดลอกลิงค์</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>มีสาขาในระบบทั้งหมด {cleanBranches.length} สาขา</span>
                <button
                  onClick={() => setActiveTab('ADD')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มสาขาใหม่</span>
                </button>
              </div>

              {cleanBranches.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 rounded border border-slate-200">
                  <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 font-bold">ยังไม่มีสาขาในระบบ</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">กดปุ่มด้านบนเพื่อเพิ่มสาขาใหม่</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cleanBranches.map((b, index) => {
                    const isEditing = editingBranchId === b.id || editingBranchId === b.code;
                    const itemList = safeParseItems(b.items);
                    const itemsLength = itemList.length;

                    if (isEditing) {
                      return (
                        <div
                          key={`${b.id}-${index}`}
                          className="bg-blue-50/60 p-3 rounded border border-blue-200 space-y-2.5"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                                รหัสสาขา (code / id):
                              </label>
                              <input
                                type="text"
                                value={editCode}
                                placeholder="เช่น BR-1930 หรือ 008"
                                onChange={(e) => setEditCode(e.target.value)}
                                className="w-full bg-white text-xs p-1.5 border border-slate-300 rounded font-mono font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                                ชื่อสาขา (name):
                              </label>
                              <input
                                type="text"
                                value={editName}
                                placeholder="เช่น สาขา ดิจิตอล"
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full bg-white text-xs p-1.5 border border-slate-300 rounded font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                                ภูมิภาค/พื้นที่ (region):
                              </label>
                              <input
                                type="text"
                                value={editRegion}
                                placeholder="เช่น นราธิวาส, ภาคใต้"
                                onChange={(e) => setEditRegion(e.target.value)}
                                className="w-full bg-white text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                                ผู้ตรวจ (assignedAuditor):
                              </label>
                              <input
                                type="text"
                                value={editAuditor}
                                placeholder="เช่น สมชาย สายตรวจ"
                                onChange={(e) => setEditAuditor(e.target.value)}
                                className="w-full bg-white text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                                สถานะ (auditStatus):
                              </label>
                              <select
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value as AuditStatus)}
                                className="w-full bg-white text-xs p-1.5 border border-slate-300 rounded font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-none"
                              >
                                <option value="NOT_STARTED">ยังไม่เริ่ม (NOT_STARTED)</option>
                                <option value="IN_PROGRESS">กำลังตรวจนับ (IN_PROGRESS)</option>
                                <option value="SUBMITTED">ส่งรายงานแล้ว (SUBMITTED)</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => setEditingBranchId(null)}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                            >
                              ยกเลิก
                            </button>
                            <button
                              onClick={() => handleSaveEdit(b.id)}
                              disabled={isSubmitting}
                              className={`px-3 py-1 text-xs font-bold rounded text-white flex items-center gap-1 transition ${
                                isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'
                              }`}
                            >
                              {isSubmitting ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-slate-100 border-t-transparent rounded-full animate-spin"></div>
                                  <span>กำลังบันทึก...</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>บันทึกแก้ไข</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`${b.id}-${index}`}
                        className="bg-white p-3 rounded border border-slate-200 hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200 shrink-0">
                            {b.code}
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">{b.name}</h4>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {b.region}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <UserCheck className="w-3 h-3 text-slate-400" />
                                {b.assignedAuditor || 'ไม่ระบุผู้ตรวจ'}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1 font-mono text-slate-700 font-bold">
                                <Layers className="w-3 h-3 text-slate-400" />
                                {itemsLength} รายการ (SKU)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(b.id)}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition flex items-center gap-1 border border-slate-200"
                            title="คัดลอกลิงค์สำหรับดูเฉพาะข้อมูลของสาขานี้"
                          >
                            {copiedBranchId === b.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-700">คัดลอกลิงค์แล้ว</span>
                              </>
                            ) : (
                              <>
                                <Link className="w-3.5 h-3.5 text-blue-600" />
                                <span>คัดลอกลิงค์สาขา</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => !isSubmitting && handleStartEdit(b)}
                            disabled={isSubmitting}
                            className={`p-1.5 rounded transition ${
                              isSubmitting ? 'text-slate-200 cursor-not-allowed' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                            title="แก้ไขข้อมูลสาขา"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => !isSubmitting && onDeleteBranch(b.id)}
                            disabled={isSubmitting}
                            className={`p-1.5 rounded transition ${
                              isSubmitting ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                            title="ลบสาขานี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'ADD' && (
            <form onSubmit={handleCreateSubmit} className="space-y-3 bg-slate-50 p-4 rounded border border-slate-200">
              <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                กรอกข้อมูลสำหรับสร้างสาขาใหม่
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    รหัสสาขา (code / id) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น BR-1930 หรือ 008"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full bg-white text-xs font-mono font-bold px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    ชื่อสาขา (name) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น สาขา ดิจิตอล"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-white text-xs font-bold px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    ภูมิภาค/พื้นที่ (region)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น นราธิวาส, ภาคใต้, กรุงเทพฯ"
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value)}
                    className="w-full bg-white text-xs px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    ผู้ตรวจ (assignedAuditor)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น สมชาย สายตรวจ"
                    value={newAuditor}
                    onChange={(e) => setNewAuditor(e.target.value)}
                    className="w-full bg-white text-xs px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    สถานะการตรวจนับ (auditStatus)
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as AuditStatus)}
                    className="w-full bg-white text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="NOT_STARTED">ยังไม่เริ่ม (NOT_STARTED)</option>
                    <option value="IN_PROGRESS">กำลังตรวจนับ (IN_PROGRESS)</option>
                    <option value="SUBMITTED">ส่งรายงานแล้ว (SUBMITTED)</option>
                  </select>
                </div>
              </div>

              <div className="bg-amber-50 p-2.5 rounded border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2 mt-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  สาขาใหม่ที่สร้างจะยังไม่มีรายการสินค้าในระบบ คุณสามารถนำเข้า Master Data (Excel / JSON) เข้าสาขานี้ได้ในภายหลัง หรือใช้เครื่อง PDA สแกนสินค้าใหม่เข้าสต็อกได้ทันที
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('LIST')}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-1.5 text-xs font-bold rounded text-white transition flex items-center gap-1 shadow-2xs ${
                    isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3 h-3 border-2 border-slate-100 border-t-transparent rounded-full animate-spin"></div>
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>สร้างสาขาใหม่</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-4 py-2.5 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
