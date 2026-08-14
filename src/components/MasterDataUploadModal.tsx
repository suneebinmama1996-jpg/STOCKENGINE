import React, { useState } from 'react';
import { Branch, StockItem } from '../types';
import {
  Upload,
  FileSpreadsheet,
  FileCode,
  X,
  CheckCircle2,
  Building2,
  Copy,
  Check,
  Download,
} from 'lucide-react';
import { parseMasterFile, downloadSampleExcelTemplate } from '../utils/excelParser';

interface MasterDataUploadModalProps {
  branches: Branch[];
  onImportItemsToBranch: (
    branchIdOrNewName: string,
    items: Omit<StockItem, 'id'>[],
    isNewBranch?: boolean
  ) => void;
  onClose: () => void;
}

export const MasterDataUploadModal: React.FC<MasterDataUploadModalProps> = ({
  branches,
  onImportItemsToBranch,
  onClose,
}) => {
  const [activeMode, setActiveMode] = useState<'FILE' | 'PASTE'>('FILE');
  const [targetBranchOption, setTargetBranchOption] = useState<string>(
    branches[0]?.id || 'NEW_BRANCH'
  );
  const [newBranchName, setNewBranchName] = useState('สาขาใหม่ (New Branch)');
  const [rawJsonText, setRawJsonText] = useState('');
  const [parsedItems, setParsedItems] = useState<Omit<StockItem, 'id'>[]>([]);
  const [copiedSample, setCopiedSample] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');

  const sampleJsonStructure = JSON.stringify(
    [
      {
        sku: 'SKU-SAMPLE-101',
        barcode: '885123456001',
        name: 'ตัวอย่างสินค้า A',
        location: 'BIN-A1-01',
        category: 'Electronics',
        systemQty: 50,
        scannedQty: 48,
        unitPrice: 1200,
      },
      {
        sku: 'SKU-SAMPLE-102',
        barcode: '885123456002',
        name: 'ตัวอย่างสินค้า B',
        location: 'BIN-B2-02',
        category: 'Apparel',
        systemQty: 30,
        scannedQty: 35,
        unitPrice: 590,
      },
    ],
    null,
    2
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setFileName(file.name);

    try {
      const items = await parseMasterFile(file);
      setParsedItems(items);
    } catch (err) {
      alert(`ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์ Excel หรือ JSON: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleParseJsonText = () => {
    try {
      const parsed = JSON.parse(rawJsonText);
      const rows = Array.isArray(parsed) ? parsed : parsed.items || [];
      if (!Array.isArray(rows) || rows.length === 0) {
        alert('รูปแบบ JSON ต้องเป็น Array ของรายการสินค้า');
        return;
      }
      const items = rows.map((r, i) => ({
        sku: String(r.sku || r.SKU || `SKU-${i + 1}`).trim(),
        barcode: String(r.barcode || r.Barcode || r.sku || `BC-${i + 1}`).trim(),
        name: String(r.name || r.Name || `Item ${i + 1}`).trim(),
        location: String(r.location || r.Location || r.bin || 'A-01').trim(),
        category: String(r.category || r.Category || 'General').trim(),
        systemQty: Number(r.systemQty ?? r.system_qty ?? r['จำนวนตามระบบ'] ?? 0),
        scannedQty: Number(r.scannedQty ?? r.scanned_qty ?? r['จำนวนสแกนจริง'] ?? 0),
        variance: Number((r.scannedQty ?? 0) - (r.systemQty ?? 0)),
        status:
          (r.scannedQty ?? 0) === (r.systemQty ?? 0)
            ? ('MATCH' as const)
            : (r.scannedQty ?? 0) < (r.systemQty ?? 0)
            ? ('SHORTAGE' as const)
            : ('OVER' as const),
        color:
          (r.scannedQty ?? 0) === (r.systemQty ?? 0)
            ? ('GREEN' as const)
            : (r.scannedQty ?? 0) < (r.systemQty ?? 0)
            ? ('RED' as const)
            : ('YELLOW' as const),
      }));
      setParsedItems(items);
    } catch {
      alert('รูปแบบ JSON ไม่ถูกต้อง กรุณาตรวจสอบวงเล็บและเครื่องหมายคำพูด');
    }
  };

  const handleConfirmImport = () => {
    if (parsedItems.length === 0) {
      alert('ไม่พบรายการสินค้าที่พร้อมนำเข้า');
      return;
    }

    if (targetBranchOption === 'NEW_BRANCH') {
      onImportItemsToBranch(newBranchName, parsedItems, true);
    } else {
      onImportItemsToBranch(targetBranchOption, parsedItems, false);
    }

    onClose();
  };

  const handleCopySample = () => {
    navigator.clipboard.writeText(sampleJsonStructure);
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded border border-slate-200 shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-tight">นำเข้า Master Data สต็อก (Excel / JSON)</h3>
              <p className="text-[11px] text-slate-400">
                รองรับคอลัมน์: รหัสสินค้า (SKU), ตำแหน่ง (Bin), หมวดหมู่, จำนวนตามระบบ (System Qty), จำนวนสแกนจริง (Scanned Qty)
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

        {/* Modal Body */}
        <div className="p-3.5 sm:p-4 space-y-3.5 max-h-[80vh] overflow-y-auto">
          {/* Target Branch Picker */}
          <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>เลือกสาขาปลายทางสำหรับนำเข้าข้อมูล:</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={targetBranchOption}
                onChange={(e) => setTargetBranchOption(e.target.value)}
                className="w-full bg-white text-xs font-semibold text-slate-900 rounded px-2.5 py-1.5 border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {branches.map((b, idx) => (
                  <option key={`${b.id}-${idx}`} value={b.id}>
                    นำเข้าสู่: {b.code} - {b.name}
                  </option>
                ))}
                <option value="NEW_BRANCH">➕ สร้างสาขาใหม่ (Create New Branch)</option>
              </select>

              {targetBranchOption === 'NEW_BRANCH' && (
                <input
                  type="text"
                  placeholder="ระบุชื่อสาขาใหม่..."
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full bg-white text-xs font-semibold text-slate-900 rounded px-2.5 py-1.5 border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveMode('FILE')}
              className={`px-3 py-1.5 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
                activeMode === 'FILE'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>อัปโหลดไฟล์ Excel (.xlsx, .csv) หรือ .json</span>
            </button>

            <button
              onClick={() => setActiveMode('PASTE')}
              className={`px-3 py-1.5 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
                activeMode === 'PASTE'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>วางข้อความ JSON ตรงๆ (Paste JSON)</span>
            </button>
          </div>

          {/* File Upload Mode */}
          {activeMode === 'FILE' && (
            <div className="space-y-2">
              <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/20 rounded p-6 flex flex-col items-center justify-center cursor-pointer transition text-center">
                <Upload className="w-8 h-8 text-blue-600 mb-2" />
                <span className="text-xs font-bold text-slate-800">
                  ลากไฟล์ Excel หรือ JSON มาวางที่นี่ หรือ คลิกเพื่อเลือกไฟล์
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  .xlsx, .xls, .csv, .json (รองรับคอลัมน์ SKU, Barcode, ตำแหน่ง/เลขลัง, จำนวนตามระบบ, และจำนวนนับได้/จำนวนสแกนจริง)
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {/* Template Download Helper */}
              <div className="flex items-center justify-between bg-slate-100 p-2.5 rounded border border-slate-200">
                <div className="text-[11px] text-slate-600">
                  <span className="font-bold text-slate-800">ต้องการตัวอย่างไฟล์ Excel ที่ใส่จำนวนนับได้แล้ว?</span>
                  <p className="text-[10px] text-slate-500">รูปแบบคอลัมน์แนะนำ: ชื่อสินค้า, รหัสสินค้า, จำนวน (ระบบ), จำนวนนับได้ (จริง), ตำแหน่ง, หมวดหมู่</p>
                </div>
                <button
                  type="button"
                  onClick={downloadSampleExcelTemplate}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition flex items-center gap-1 shrink-0 shadow-2xs active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ดาวน์โหลดตัวอย่าง Excel</span>
                </button>
              </div>

              {loading && <p className="text-xs text-blue-600 font-bold text-center">กำลังอ่านไฟล์...</p>}
              {fileName && !loading && (
                <div className="flex items-center justify-between bg-blue-50 text-blue-900 px-3 py-1.5 rounded border border-blue-200 text-xs font-medium">
                  <span>ไฟล์: {fileName}</span>
                  <span className="font-bold text-blue-700">อ่านได้ {parsedItems.length} รายการ</span>
                </div>
              )}
            </div>
          )}

          {/* Raw Paste JSON Mode */}
          {activeMode === 'PASTE' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">ข้อความโครงสร้าง JSON:</span>
                <button
                  onClick={handleCopySample}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                >
                  {copiedSample ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>คัดลอกตัวอย่าง JSON</span>
                </button>
              </div>

              <textarea
                rows={5}
                value={rawJsonText}
                onChange={(e) => setRawJsonText(e.target.value)}
                placeholder="วาง JSON Array ของรายการสินค้าที่นี่..."
                className="w-full font-mono text-xs p-2.5 bg-slate-900 text-blue-300 rounded border border-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />

              <button
                onClick={handleParseJsonText}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
              >
                ตรวจสอบ & แปลงข้อความ JSON
              </button>
            </div>
          )}

          {/* Preview Table of Parsed Items */}
          {parsedItems.length > 0 && (
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>ตัวอย่างรายการที่พร้อมนำเข้า ({parsedItems.length} SKU):</span>
                </span>
              </div>

              <div className="max-h-36 overflow-y-auto rounded border border-slate-200 text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900 text-white font-bold text-[10px] tracking-wider uppercase sticky top-0">
                    <tr>
                      <th className="p-2">SKU</th>
                      <th className="p-2">ชื่อสินค้า</th>
                      <th className="p-2">Location/Bin</th>
                      <th className="p-2 text-center">System Qty</th>
                      <th className="p-2 text-center">Scanned Qty</th>
                      <th className="p-2 text-center">Variance / Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[10px] text-slate-800">
                    {parsedItems.slice(0, 10).map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-2 font-bold text-slate-900">{item.sku}</td>
                        <td className="p-2 font-sans truncate max-w-[120px]">{item.name}</td>
                        <td className="p-2">{item.location}</td>
                        <td className="p-2 text-center">{item.systemQty}</td>
                        <td className="p-2 text-center">{item.scannedQty}</td>
                        <td className="p-2 text-center font-bold">
                          <span
                            className={
                              item.status === 'MATCH'
                                ? 'text-emerald-700'
                                : item.status === 'SHORTAGE'
                                ? 'text-rose-700'
                                : 'text-amber-700'
                            }
                          >
                            {item.status} ({item.variance})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 px-4 py-2.5 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded bg-white border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
          >
            ยกเลิก
          </button>

          <button
            disabled={parsedItems.length === 0}
            onClick={handleConfirmImport}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-2xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>ยืนยันนำเข้าข้อมูล ({parsedItems.length} SKU)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
