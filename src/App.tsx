import React, { useState, useEffect } from 'react';
import { Branch, StockItem, AuditStatus } from './types';
import { initialBranchesData } from './data/sampleData';
import { calculateItemVariance, computeAuditSummary, processItems } from './utils/stockCalculations';
import { exportToExcel } from './utils/excelParser';
import { Navbar } from './components/Navbar';
import { AuditDashboard } from './components/AuditDashboard';
import { StockReconciliationTable } from './components/StockReconciliationTable';
import { PdaScannerModal } from './components/PdaScannerModal';
import { MasterDataUploadModal } from './components/MasterDataUploadModal';
import { BranchManagerModal } from './components/BranchManagerModal';
import { JsonEngineOutputView } from './components/JsonEngineOutputView';
import { MonthlyAuditPerformanceDashboard } from './components/MonthlyAuditPerformanceDashboard';
import { QrCode } from 'lucide-react';
import {
  subscribeToBranches,
  saveBranch,
  importItemsToBranchInSheets,
  removeBranch,
  resetFirestoreDatabase,
  pausePolling,
  resumePolling,
  getIsPollingPaused,
  ImportProgress,
} from './utils/googleSheetsService';
import {
  saveBranchesToIndexedDb,
  loadBranchesFromIndexedDb,
} from './utils/indexedDbStorage';
import {
  safeParseItems,
  safeSetLocalStorage,
  safeGetLocalStorage,
  safeRemoveLocalStorage,
} from './utils/safeJsonParser';
import { normalizeBranchData, normalizeBranchesList } from './utils/branchNormalizer';

const isMockBranch = (b: Branch): boolean => {
  if (!b) return true;
  const idStr = String(b.id || '');
  const codeStr = String(b.code || '').toUpperCase();
  const nameStr = String(b.name || '').toLowerCase();

  const isMockId = [
    'BR-DMG', 'BR-SP', 'BR-CW', 'BR-MB', 'BR-NM', 'BR-PK',
    'CW-02', 'MB-03', 'NM-04', 'PK-05'
  ].includes(idStr) || [
    'CW-02', 'MB-03', 'NM-04', 'PK-05'
  ].includes(codeStr);
  
  const isMockName = 
    nameStr.includes('คลังสินค้าชำรุด') ||
    nameStr.includes('siam paragon') ||
    nameStr.includes('centralworld') ||
    nameStr.includes('mega bangna') ||
    nameStr.includes('nimman') ||
    nameStr.includes('phuket') ||
    nameStr.includes('central phuket');
    
  return isMockId || isMockName;
};

export default function App() {
  const [branches, setBranches] = useState<Branch[]>(() => {
    try {
      const cached = safeGetLocalStorage<Branch[]>('STOCK_ENGINE_REAL_DATA', []) || safeGetLocalStorage<Branch[]>('stock_branches_cache', []);
      if (Array.isArray(cached) && cached.length > 0) {
        return cached
          .filter(b => b && !isMockBranch(b))
          .map(b => ({
            ...b,
            items: safeParseItems(b.items)
          }));
      }
    } catch (e) {
      console.warn('Error initializing branches from localStorage safely:', e);
    }
    return [];
  });
  const [loading, setLoading] = useState<boolean>(true); // Will be set to false in useEffect finally block
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [dismissedSyncError, setDismissedSyncError] = useState<boolean>(false);

  // Monitor browser network online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setIsConnected(true);
      setSyncError(null);
      setDismissedSyncError(false);
      setRefreshTrigger(prev => prev + 1);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setIsConnected(false);
      setSyncError('⚠️ ตรวจพบอุปกรณ์ออฟไลน์ (No Internet Connection) ระบบจะบันทึกการทำงานในเครื่องอย่างปลอดภัย และออโต้ซิงค์กลับเมื่อเชื่อมต่อได้ค่ะ');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [userRole, setUserRole] = useState<'auditor' | 'branch'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('branch') || params.has('branchId') || params.has('code')) {
        return 'branch';
      }
    }
    return 'auditor';
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'monthly' | 'reconciliation' | 'pda' | 'json'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('branch') || params.has('branchId') || params.has('code')) {
        return 'reconciliation';
      }
    }
    return 'dashboard';
  });
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const branchParam = params.get('branch') || params.get('branchId') || params.get('code');
      if (branchParam) {
        return branchParam;
      }
    }
    return 'ALL';
  });
  const [branchParamError, setBranchParamError] = useState<boolean>(false);
  const [pdaBranchId, setPdaBranchId] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isBranchManagerOpen, setIsBranchManagerOpen] = useState<boolean>(false);
  const [branchManagerMode, setBranchManagerMode] = useState<'ADD' | 'LIST'>('LIST');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const hasLoadedOnce = React.useRef(false);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // 1. Clean up any Mock Data in LocalStorage on startup
  useEffect(() => {
    try {
      const cacheKeys = ['STOCK_ENGINE_REAL_DATA', 'stock_branches_cache'];
      cacheKeys.forEach(key => {
        const cached = safeGetLocalStorage<Branch[]>(key, []);
        if (Array.isArray(cached) && cached.length > 0) {
          const cleaned = cached
            .filter(b => b && !isMockBranch(b))
            .map(b => ({
              ...b,
              items: safeParseItems(b.items)
            }));
          safeSetLocalStorage(key, cleaned);
        }
      });

      // Hydrate from IndexedDB if branches are currently empty
      loadBranchesFromIndexedDb().then((idbBranches) => {
        if (idbBranches && idbBranches.length > 0) {
          setBranches((prev) => (prev.length === 0 ? idbBranches : prev));
          safeSetLocalStorage('STOCK_ENGINE_REAL_DATA', idbBranches);
        }
      }).catch(err => console.warn('IDB startup load warning:', err));
    } catch (e) {
      console.warn('Cleanup mock cache error:', e);
    }
  }, []);

  // 2. Real-time Google Sheets subscription with local data recovery (In Progress) and NO Mock Data fallback
  useEffect(() => {
    let initialLoadTimeout: NodeJS.Timeout;
    const isInitialLoad = !hasLoadedOnce.current && branches.length === 0;

    // Only show full-page loading spinner on initial cold start when branches is empty
    if (isInitialLoad) {
      setLoading(true);
      // Timeout ป้องกันค้าง
      initialLoadTimeout = setTimeout(() => {
        setLoading(false);
      }, 10000);
    }

    const unsubscribe = subscribeToBranches(
      (updatedBranches) => {
        try {
          if (getIsPollingPaused()) {
            console.log('[App] Polling update ignored due to active import/save transaction lock.');
            return;
          }
          if (!updatedBranches || updatedBranches.length === 0) {
            setBranches([]);
          } else {
            const realBranches = normalizeBranchesList(
              updatedBranches.filter((b) => !isMockBranch(b))
            ).map((b) => ({
              ...b,
              items: safeParseItems(b.items),
            }));
            setBranches(realBranches);
          }
          setIsOffline(false);
          setIsConnected(true);
          setSyncError(null);
          setDismissedSyncError(false);
        } finally {
          hasLoadedOnce.current = true;
          setLoading(false);
          if (initialLoadTimeout) clearTimeout(initialLoadTimeout);
        }
      },
      (error) => {
        try {
          // True network error occurred (e.g. offline, connection loss)
          console.warn('Google Sheets subscription network error, entering offline mode:', error);
          setIsOffline(true);
          setIsConnected(false);

          let localBranches: Branch[] = [];
          try {
            const cached =
              safeGetLocalStorage<Branch[]>('STOCK_ENGINE_REAL_DATA', []) ||
              safeGetLocalStorage<Branch[]>('stock_branches_cache', []);
            if (Array.isArray(cached) && cached.length > 0) {
              // Only keep real user data
              localBranches = normalizeBranchesList(
                cached.filter((b) => b && !isMockBranch(b))
              ).map((b) => ({
                ...b,
                items: safeParseItems(b.items),
              }));
            }
          } catch (e) {
            console.warn('Error recovering data from localStorage safely:', e);
          }

          setBranches(localBranches);
          
          if (localBranches.length > 0) {
            setSyncError('⚠️ ดึงข้อมูลจริงล่าสุดที่สาขากำลังนับอยู่ (In Progress Data Recovery) ขึ้นมาสำเร็จในโหมดออฟไลน์ เนื่องจากขณะนี้ระบบเชื่อมต่อ Google Sheets ขัดข้อง ระบบจะบันทึกการทำงานของท่านในเครื่องนี้อย่างปลอดภัย และออโต้ซิงค์กลับเมื่อกลับมาเชื่อมต่อได้ค่ะ');
          } else {
            setSyncError('⚠️ ระบบไม่สามารถเชื่อมต่อ Google Sheets ได้ชั่วคราว (Network Error) และไม่พบข้อมูลการตรวจนับจริงค้างอยู่ในเครื่องนี้');
          }
        } finally {
          hasLoadedOnce.current = true;
          setLoading(false);
          if (initialLoadTimeout) clearTimeout(initialLoadTimeout);
        }
      }
    );

    return () => {
      unsubscribe();
      if (initialLoadTimeout) clearTimeout(initialLoadTimeout);
    };
  }, [refreshTrigger]);

  // 3. Auto-sync/Save branches state to localStorage cache and IndexedDB
  useEffect(() => {
    try {
      const realBranches = branches
        .filter(b => !isMockBranch(b))
        .map(b => ({
          ...b,
          items: safeParseItems(b.items)
        }));
      safeSetLocalStorage('STOCK_ENGINE_REAL_DATA', realBranches);
      if (realBranches.length > 0) {
        saveBranchesToIndexedDb(realBranches).catch((e) => console.warn('IndexedDB auto-sync warning:', e));
      }
    } catch (e) {
      console.warn('Failed to update STOCK_ENGINE_REAL_DATA cache safely:', e);
    }
  }, [branches]);

  // 3.5 Auto default select to "สาขา ดิจิตอล" if it is available in State
  useEffect(() => {
    if (branches.length > 0 && selectedBranchId === 'ALL') {
      const digBranch = branches.find(b => 
        b.id === 'BR-DIG' || 
        (b.name || '').includes('ดิจิตอล') || 
        (b.name || '').includes('Digital') || 
        (b.code || '').includes('DIG')
      );
      if (digBranch) {
        setSelectedBranchId(digBranch.id);
      }
    }
  }, [branches]);

  // 3.6 URL Query Parameter Resolver Safeguard (branch / branchId / code)
  useEffect(() => {
    if (loading) return;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const branchParam = params.get('branch') || params.get('branchId') || params.get('code');
      if (branchParam) {
        const matched = branches.find(b => 
          b && (
            String(b.id) === String(branchParam) || 
            String(b.code) === String(branchParam) || 
            (b.name || '').toLowerCase() === branchParam.toLowerCase()
          )
        );
        if (matched) {
          setSelectedBranchId(matched.id);
          setBranchParamError(false);
        } else {
          setBranchParamError(true);
        }
      }
    }
  }, [loading, branches]);

  const handleGoBackHome = () => {
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', window.location.pathname);
    }
    setBranchParamError(false);
    setUserRole('auditor');
    setActiveTab('dashboard');
    setSelectedBranchId('ALL');
  };

  // 4. Automatic background synchronization to cloud (LocalStorage -> Google Sheets) when online
  useEffect(() => {
    if (loading || syncError || branches.length === 0 || isSubmitting || getIsPollingPaused()) return;

    const syncOfflineChangesToCloud = async () => {
      try {
        if (getIsPollingPaused()) return;

        const cached = localStorage.getItem('STOCK_ENGINE_REAL_DATA');
        if (!cached) return;

        const localBranches = JSON.parse(cached);
        if (!Array.isArray(localBranches)) return;

        for (const localB of localBranches) {
          if (!localB) continue;
          // Double safeguard: skip any mock data
          if (isMockBranch(localB)) continue;

          const cloudB = branches.find(b => b.id === localB.id);

          // If the branch is new, or items/status were modified locally, sync it up to Google Sheets
          const needsSync = !cloudB ||
            JSON.stringify(cloudB.items) !== JSON.stringify(localB.items) ||
            cloudB.auditStatus !== localB.auditStatus;

          if (needsSync && !getIsPollingPaused()) {
            console.log(`[Auto-Sync] Syncing branch "${localB.name}" offline updates back to Google Sheets...`);
            await saveBranch(localB);
          }
        }
      } catch (e) {
        console.warn('[Auto-Sync] Google Sheets synchronization deferred (offline mode active):', e);
      }
    };

    syncOfflineChangesToCloud();
  }, [loading, syncError, isSubmitting]);

  // Add new branch to Google Sheets
  const handleAddBranch = async (data: {
    code: string;
    name: string;
    region: string;
    assignedAuditor?: string;
    auditStatus?: AuditStatus;
  }) => {
    const rawCode = data.code.trim().toUpperCase() || `BR-00${branches.length + 1}`;
    const newBranch: Branch = normalizeBranchData({
      id: rawCode,
      code: rawCode,
      name: data.name.trim(),
      region: data.region.trim() || 'ทั่วไป',
      auditStatus: data.auditStatus || 'NOT_STARTED',
      assignedAuditor: data.assignedAuditor?.trim() || 'เจ้าหน้าที่ Audit',
      items: [],
    });

    setIsSubmitting(true);
    try {
      await saveBranch(newBranch);
      setSelectedBranchId(newBranch.id);
      handleRefresh();
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลสาขาลง Google Sheets');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit branch info in Google Sheets
  const handleEditBranch = async (
    branchId: string,
    data: {
      code: string;
      name: string;
      region: string;
      assignedAuditor?: string;
      auditStatus?: AuditStatus;
    }
  ) => {
    const target = branches.find((b) => b.id === branchId);
    if (!target) return;
    const updated: Branch = normalizeBranchData({
      ...target,
      code: data.code.trim().toUpperCase() || target.code,
      name: data.name.trim() || target.name,
      region: data.region.trim() || 'ทั่วไป',
      assignedAuditor: data.assignedAuditor?.trim() || 'เจ้าหน้าที่ Audit',
      auditStatus: data.auditStatus || target.auditStatus || 'NOT_STARTED',
    });

    // Optimistic UI Update: อัปเดต State หน้าจอทันที
    setBranches((prev) => prev.map((b) => (b.id === branchId ? updated : b)));
    // ปิด Modal ทันที
    setIsBranchManagerOpen(false);

    setIsSubmitting(true);
    try {
      // ส่ง id และ code อ้างอิงตัวเดิมไปพร้อมกับ payload
      await saveBranch(updated, target.id, target.code);
      handleRefresh();
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการแก้ไขข้อมูลสาขาลง Google Sheets');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete branch from Google Sheets
  const handleDeleteBranch = async (branchId: string) => {
    const target = branches.find((b) => b.id === branchId);
    if (!target) return;

    if (
      confirm(
        `คุณแน่ใจหรือไม่ว่าต้องการลบสาขา "${target.code || ''} - ${target.name || ''}"?\n\nข้อมูลสต็อกทั้งหมด ${(target.items || []).length} รายการในสาขานี้จะถูกลบออกถาวร!`
      )
    ) {
      setIsSubmitting(true);
      
      // Perform immediate optimistic state update to remove from screen (State) instantly
      setBranches((prev) => prev.filter((b) => b.id !== branchId));
      if (selectedBranchId === branchId) {
        setSelectedBranchId('ALL');
      }

      try {
        await removeBranch(branchId);
        handleRefresh();
      } catch (e) {
        console.warn('Silent delete issue fallback:', e);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleOpenBranchManager = (mode: 'ADD' | 'LIST' = 'LIST') => {
    setBranchManagerMode(mode);
    setIsBranchManagerOpen(true);
  };

  // Read URL query params on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const branchParam = params.get('branch');
    const tabParam = params.get('tab');

    if (branchParam) {
      setUserRole('branch');
    }

    if (branchParam && branches.length > 0) {
      const match = branches.find(
        (b) => b.id === branchParam || (b.code || '').toLowerCase() === branchParam.toLowerCase()
      );
      if (match) {
        setSelectedBranchId(match.id);
        if (tabParam === 'reconciliation' || tabParam === 'pda') {
          setActiveTab(tabParam as any);
        } else {
          setActiveTab('reconciliation');
        }
      }
    }
  }, [branches.length]);

  // Guard branch-level role tabs from unauthorized access
  useEffect(() => {
    if (userRole === 'branch' && (activeTab === 'dashboard' || activeTab === 'json')) {
      setActiveTab('reconciliation');
    }
  }, [userRole, activeTab]);

  const auditSummary = computeAuditSummary(branches);

  // Update Item Scanned Qty in Firestore
  const handleUpdateScannedQty = async (branchId: string, itemId: string, newQty: number) => {
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return;

    const updatedItems = branch.items.map((item) => {
      if (item.id !== itemId) return item;
      const { variance, status, color } = calculateItemVariance(item.systemQty, newQty);
      return {
        ...item,
        scannedQty: newQty,
        variance,
        status,
        color,
        lastScannedAt: new Date().toISOString(),
      };
    });

    const newBranchStatus: AuditStatus =
      branch.auditStatus === 'NOT_STARTED' ? 'IN_PROGRESS' : branch.auditStatus;

    const updatedBranch: Branch = {
      ...branch,
      auditStatus: newBranchStatus,
      startedAt: branch.startedAt || new Date().toISOString(),
      items: updatedItems,
    };

    // Optimistic local state update for near-instant client UI responsiveness
    setBranches((prev) => prev.map((b) => (b.id === branchId ? updatedBranch : b)));

    try {
      await saveBranch(updatedBranch);
    } catch (e) {
      console.warn('Failed to save quantity to Google Sheets/Firestore:', e);
    }
  };

  // PDA Barcode / SKU Scan Handler in Firestore with optional Location placement
  const handleScanBarcode = (branchId: string, barcodeOrSku: string, targetLocation?: string): StockItem | null => {
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return null;

    let scannedResultItem: StockItem | null = null;
    const cleanQuery = barcodeOrSku.trim().toLowerCase();
    let itemMatched = false;

    const updatedItems = branch.items.map((item) => {
      if (
        !itemMatched &&
        ((item.barcode || '').toLowerCase() === cleanQuery || (item.sku || '').toLowerCase() === cleanQuery)
      ) {
        itemMatched = true;
        const newQty = item.scannedQty + 1;
        const { variance, status, color } = calculateItemVariance(item.systemQty, newQty);
        
        // If a specific box/location is active, assign it to the item!
        const finalLocation = targetLocation && targetLocation !== 'ALL' ? targetLocation : item.location;

        const updated = {
          ...item,
          scannedQty: newQty,
          variance,
          status,
          color,
          location: finalLocation,
          lastScannedAt: new Date().toISOString(),
        };
        scannedResultItem = updated;
        return updated;
      }
      return item;
    });

    // If barcode not found in branch, create a new item with 0 system qty (OVER item) placed in active box/location
    if (!itemMatched) {
      const newSku = barcodeOrSku.trim().toUpperCase();
      const finalLocation = targetLocation && targetLocation !== 'ALL' ? targetLocation : 'BIN-NEW-01';
      const newItem: StockItem = {
        id: `item-${Date.now()}`,
        sku: newSku,
        barcode: newSku,
        name: `สินค้าสแกนใหม่ (${newSku})`,
        location: finalLocation,
        category: 'Uncategorized',
        systemQty: 0,
        scannedQty: 1,
        variance: 1,
        status: 'OVER',
        color: 'YELLOW',
        lastScannedAt: new Date().toISOString(),
      };
      scannedResultItem = newItem;
      updatedItems.push(newItem);
    }

    const newBranchStatus: AuditStatus =
      branch.auditStatus === 'NOT_STARTED' ? 'IN_PROGRESS' : branch.auditStatus;

    const updatedBranch: Branch = {
      ...branch,
      auditStatus: newBranchStatus,
      startedAt: branch.startedAt || new Date().toISOString(),
      items: updatedItems,
    };

    // Optimistic local state update
    setBranches((prev) => prev.map((b) => (b.id === branchId ? updatedBranch : b)));

    // Fire-and-forget save to Firestore for uninterrupted camera performance
    saveBranch(updatedBranch).catch((e) => console.warn('Failed to save scanner update to Firestore/Sheets:', e));

    return scannedResultItem;
  };

  // Branch Audit Status Update in Firestore
  const handleUpdateBranchStatus = async (branchId: string, status: AuditStatus) => {
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return;

    const updated: Branch = {
      ...branch,
      auditStatus: status,
      submittedAt: status === 'SUBMITTED' ? new Date().toISOString() : undefined,
      startedAt: status === 'IN_PROGRESS' && !branch.startedAt ? new Date().toISOString() : branch.startedAt,
    };

    // Optimistic local update
    setBranches((prev) => prev.map((b) => (b.id === branchId ? updated : b)));

    setIsSubmitting(true);
    try {
      await saveBranch(updated);
      handleRefresh();
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการปรับปรุงสถานะการตรวจนับลงคลาวด์');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete item from branch in Firestore
  const handleDeleteItem = async (branchId: string, itemId: string) => {
    if (!confirm('คุณต้องการลบรายการนี้ออกจากตารางตรวจนับใช่หรือไม่?')) return;
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return;

    const updated: Branch = {
      ...branch,
      items: branch.items.filter((item) => item.id !== itemId),
    };

    // Optimistic local update
    setBranches((prev) => prev.map((b) => (b.id === branchId ? updated : b)));

    setIsSubmitting(true);
    try {
      await saveBranch(updated);
      handleRefresh();
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการลบรายการสินค้าจากระบบคลาวด์');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Import Master Items to Branch or Create Branch in Google Sheets
  const handleImportItemsToBranch = async (
    branchIdOrNewName: string,
    importedItems: Omit<StockItem, 'id'>[],
    isNewBranch?: boolean,
    auditDate?: string,
    scheduleDay?: 'THURSDAY' | 'FRIDAY' | 'OTHER',
    onProgress?: (progress: ImportProgress) => void,
    importMode: 'overwrite' | 'append' = 'overwrite'
  ) => {
    setIsSubmitting(true);
    // Pause auto-refresh polling immediately to prevent background fetch from overwriting data
    pausePolling(120000);
    const effectiveAuditDate = auditDate || new Date().toISOString().slice(0, 10);
    try {
      if (isNewBranch) {
        const newCode = `BR-00${branches.length + 1}`;
        const formattedItems = processItems(
          importedItems.map((item, idx) => ({
            ...item,
            barcode: String(item.barcode || item.sku || `BC-${idx + 1}`).trim(),
            name: String(item.name || `สินค้า ${item.sku || idx + 1}`).trim(),
            systemQty: Number(item.systemQty ?? 0),
            scannedQty: Number(item.scannedQty ?? 0),
            auditDate: effectiveAuditDate,
            id: `item-${Date.now()}-${idx}`,
          }))
        );

        const newBranch: Branch = normalizeBranchData({
          id: newCode,
          code: newCode,
          name: branchIdOrNewName.trim() || `สาขา ${newCode}`,
          region: 'ทั่วไป',
          auditDate: effectiveAuditDate,
          auditScheduleDay: scheduleDay || 'OTHER',
          auditStatus: 'NOT_STARTED',
          assignedAuditor: 'เจ้าหน้าที่ Audit',
          items: formattedItems,
        });

        // 1. Local Cache First: Update UI State, LocalStorage, and IndexedDB immediately
        const nextBranches = [...branches, newBranch];
        setBranches(nextBranches);
        safeSetLocalStorage('STOCK_ENGINE_REAL_DATA', nextBranches);
        saveBranchesToIndexedDb(nextBranches).catch((e) => console.warn('[App] IndexedDB save warning:', e));
        setSelectedBranchId(newBranch.id);

        // 2. Save new branch items to Google Sheets via unlimited chunked processing
        await importItemsToBranchInSheets(newBranch.id, formattedItems, onProgress, importMode);
      } else {
        const branch = branches.find((b) => b.id === branchIdOrNewName || b.code === branchIdOrNewName || b.name === branchIdOrNewName);
        if (!branch) {
          throw new Error('ไม่พบข้อมูลสาขาที่ระบุ');
        }

        const newProcessed = processItems(
          importedItems.map((item, idx) => ({
            ...item,
            barcode: String(item.barcode || item.sku || `BC-${idx + 1}`).trim(),
            name: String(item.name || `สินค้า ${item.sku || idx + 1}`).trim(),
            systemQty: Number(item.systemQty ?? 0),
            scannedQty: Number(item.scannedQty ?? 0),
            auditDate: effectiveAuditDate,
            id: `item-${Date.now()}-${idx}`,
          }))
        );

        // In overwrite mode: replace existing branch items with newProcessed
        // In append mode: merge new items with existing items
        const finalItems = importMode === 'overwrite'
          ? newProcessed
          : [...branch.items, ...newProcessed];

        const updated: Branch = {
          ...branch,
          auditDate: effectiveAuditDate,
          auditScheduleDay: scheduleDay || branch.auditScheduleDay || 'OTHER',
          items: finalItems,
        };

        // 1. Local Cache First: Save to LocalStorage, UI State, and IndexedDB immediately
        const nextBranches = branches.map((b) => (b.id === branch.id ? updated : b));
        setBranches(nextBranches);
        safeSetLocalStorage('STOCK_ENGINE_REAL_DATA', nextBranches);
        saveBranchesToIndexedDb(nextBranches).catch((e) => console.warn('[App] IndexedDB save warning:', e));
        setSelectedBranchId(branch.id);

        // 2. Post importItems chunked loop to Google Apps Script until 100%
        await importItemsToBranchInSheets(branch.id, finalItems, onProgress, importMode);
      }
      return true;
    } catch (err: any) {
      console.error('Error importing items to branch:', err);
      throw err;
    } finally {
      setIsSubmitting(false);
      // Wait 3 seconds before resuming auto-polling to ensure Google Sheets write is completed
      setTimeout(() => {
        resumePolling();
      }, 3000);
    }
  };

  // Reset / Clear Google Sheets Database (Strict empty state clean-up)
  const handleResetData = async () => {
    if (confirm('⚠️ คุณต้องการล้างฐานข้อมูลบน Google Sheets ทั้งหมดและเริ่มต้นนับใหม่ใช่หรือไม่? (ข้อมูลสาขาและรายงานสต็อกทั้งหมดจะถูกลบออก และหน้าจอจะสลับเป็นตารางว่างเพื่อเริ่มบันทึกจริง)')) {
      setIsSubmitting(true);
      try {
        await resetFirestoreDatabase([]);
        // Clear local storage cache as well
        safeRemoveLocalStorage('STOCK_ENGINE_REAL_DATA');
        safeRemoveLocalStorage('stock_branches_cache');
        setBranches([]);
        setSelectedBranchId('ALL');
        alert('ล้างฐานข้อมูล Google Sheets และเคลียร์ข้อมูลในเครื่องทั้งหมดเรียบร้อยแล้วค่ะ');
      } catch (e) {
        alert('เกิดข้อผิดพลาดในการล้างข้อมูล Google Sheets');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const [debugMessage, setDebugMessage] = useState<string | null>(null);

  // Emergency Force Data Recovery for Digital Branch
  const handleForceRecoverDigitalBranch = () => {
    try {
      console.log('Force recovery started...');
      let recoveredBranches: Branch[] = [];
      let foundInKey = '';

      // 1. Scan all keys in localStorage
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          keys.push(key);
          const val = localStorage.getItem(key);
          if (val) {
            // Check if it contains "Digital", "DIG-01", "สาขา ดิจิตอล"
            if (val.includes('Digital') || val.includes('DIG-01') || val.includes('สาขา ดิจิตอล') || val.includes('ดิจิตอล')) {
              try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) {
                  recoveredBranches = parsed;
                  foundInKey = key;
                  break;
                } else if (parsed && typeof parsed === 'object') {
                  if (parsed.items || parsed.code || parsed.name) {
                    recoveredBranches = [parsed as Branch];
                    foundInKey = key;
                    break;
                  }
                }
              } catch (e) {
                console.warn('Failed to parse value for key:', key, e);
              }
            }
          }
        }
      }

      if (recoveredBranches.length > 0) {
        // We found some recovered branches! Set state and Cache
        setBranches(recoveredBranches);
        safeSetLocalStorage('STOCK_ENGINE_REAL_DATA', recoveredBranches);
        
        // Focus the dropdown to Digital Branch if found
        const digBranch = recoveredBranches.find(b => 
          b.id === 'BR-DIG' || 
          (b.name || '').includes('ดิจิตอล') || 
          (b.name || '').includes('Digital') || 
          (b.code || '').includes('DIG')
        );
        if (digBranch) {
          setSelectedBranchId(digBranch.id);
        }
        
        setDebugMessage(`🎉 ดึงข้อมูลกลับมาสำเร็จจาก Key: "${foundInKey}" จำนวนสาขาที่กู้คืนได้: ${recoveredBranches.length} สาขา ระบบจะทำการซิงโครไนซ์ขึ้นระบบ Google Sheets โดยอัตโนมัติค่ะ`);
        
        // Auto Sync back to Google Sheets immediately
        recoveredBranches.forEach(async (b) => {
          try {
            await saveBranch(b);
          } catch (e) {
            console.warn('Error saving recovered branch to Google Sheets safely:', e);
          }
        });
      } else {
        setDebugMessage(`❌ ไม่พบข้อมูลของ "สาขาดิจิตอล" ใน LocalStorage ของเครื่องนี้เลยค่ะ | ตรวจพบ Keys ใน LocalStorage ทั้งหมดในขณะนี้คือ: [${keys.join(', ')}]`);
      }
    } catch (e: any) {
      setDebugMessage(`❌ เกิดข้อผิดพลาดในขั้นตอนกู้ข้อมูลแบบเร่งด่วน: ${e?.message || e}`);
    }
  };

  // Export all branches to Excel
  const handleExportAllExcel = () => {
    const allItems: StockItem[] = [];
    branches.forEach((b) => {
      const itemList = safeParseItems(b.items);

      itemList.forEach((item) => {
        if (!item) return;
        allItems.push({
          ...item,
          notes: `สาขา: ${b.code} - ${b.name}`,
        });
      });
    });
    exportToExcel(allItems, `multi_branch_stock_audit_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleOpenPdaForBranch = (branchId: string) => {
    setPdaBranchId(branchId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-800">กำลังดึงข้อมูลสต็อกและตรวจนับสาขา...</h3>
            <p className="text-xs text-slate-400">กรุณารอสักครู่ ระบบกำลังซิงโครไนซ์ฐานข้อมูลจากคลาวด์</p>
          </div>
        </div>
      </div>
    );
  }

  if (branchParamError) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center space-y-4">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-100 shadow-xs">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-slate-800">ไม่พบข้อมูลสาขานี้ หรือลิงก์ไม่ถูกต้อง</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              ขออภัยด้วยค่ะ ระบบไม่พบสาขาที่คุณกำลังเรียกดูในระบบฐานข้อมูลคลาวด์ขณะนี้ กรุณาตรวจสอบลิงก์อีกครั้งหรือกดปุ่มด้านล่างเพื่อกลับไปยังหน้าหลัก
            </p>
          </div>
          <button
            onClick={handleGoBackHome}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition active:scale-95 shadow-xs font-semibold"
          >
            กลับสู่หน้าหลัก (Go Back Home)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased flex flex-col">
      {/* Top Main Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        onOpenBranchManager={() => handleOpenBranchManager('LIST')}
        onResetData={handleResetData}
        onExportAllExcel={handleExportAllExcel}
        selectedBranchId={selectedBranchId}
        setSelectedBranchId={setSelectedBranchId}
        branches={branches}
        userRole={userRole}
        setUserRole={setUserRole}
        isConnected={isConnected}
        isOffline={isOffline}
        isSubmitting={isSubmitting}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 lg:px-6 py-3.5">
          <>
            {isOffline && syncError && !dismissedSyncError && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-slate-800 text-xs rounded-xl shadow-xs space-y-3">
                <div className="flex items-start gap-2.5">
                  <span className="text-base text-amber-600 shrink-0">⚠️</span>
                  <div className="flex-1 space-y-1">
                    <p className="font-bold text-slate-900">โหมดการตรวจนับสำรอง (Offline Data Recovery Mode)</p>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      {syncError}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-7">
                  <button
                    onClick={() => {
                      setLoading(true);
                      setDismissedSyncError(false);
                      setRefreshTrigger(prev => prev + 1);
                    }}
                    className="py-1 px-3 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold rounded-lg transition text-[10.5px] shadow-xs flex items-center gap-1.5"
                  >
                    🔄 ลองเชื่อมต่อใหม่ (Retry Sync)
                  </button>
                  <button
                    onClick={() => setDismissedSyncError(true)}
                    className="py-1 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition text-[10.5px]"
                  >
                    ✕ ซ่อนป้ายเตือนนี้ (Dismiss)
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'dashboard' && (
              <AuditDashboard
                branches={branches}
                summary={auditSummary}
                isSubmitting={isSubmitting}
                isOffline={isOffline}
                onSelectBranchForReconciliation={(branchId) => {
                  setSelectedBranchId(branchId);
                  setActiveTab('reconciliation');
                }}
                onOpenPdaScanner={(branchId) => handleOpenPdaForBranch(branchId)}
                onUpdateBranchStatus={handleUpdateBranchStatus}
                onOpenBranchManager={handleOpenBranchManager}
                onDeleteBranch={handleDeleteBranch}
                onForceRecoverDigital={handleForceRecoverDigitalBranch}
                recoveryLog={debugMessage}
              />
            )}

            {activeTab === 'monthly' && (
              <MonthlyAuditPerformanceDashboard
                branches={branches}
                onSelectBranchForReconciliation={(branchId) => {
                  setSelectedBranchId(branchId);
                  setActiveTab('reconciliation');
                }}
                onOpenPdaScanner={(branchId) => handleOpenPdaForBranch(branchId)}
              />
            )}

            {activeTab === 'reconciliation' && (
              <StockReconciliationTable
                branches={branches}
                selectedBranchId={selectedBranchId}
                setSelectedBranchId={setSelectedBranchId}
                isSubmitting={isSubmitting}
                onUpdateScannedQty={handleUpdateScannedQty}
                onDeleteItem={handleDeleteItem}
                onOpenPdaScanner={(branchId) => handleOpenPdaForBranch(branchId)}
                onOpenUploadModal={() => setIsUploadModalOpen(true)}
                onUpdateBranchStatus={handleUpdateBranchStatus}
                userRole={userRole}
              />
            )}

            {activeTab === 'pda' && (
              <div className="py-4">
                <div className="max-w-xl mx-auto bg-slate-900 text-white p-5 rounded border border-slate-800 shadow-2xl text-center space-y-3">
                  <h2 className="text-sm font-black uppercase text-blue-400 tracking-tight">
                    เปิดระบบสแกนด้วยกล้องมือถือ & บาร์โค้ดคีย์บอร์ด
                  </h2>
                  <p className="text-[11px] text-slate-300">
                    พนักงานประจำสาขาสามารถเปิดลิงค์ผ่านสมาร์ทโฟนของตนเองเพื่อเปิดกล้องสแกนบาร์โค้ด/QR Code หรือระบุตำแหน่งและกรอกจำนวนตรวจนับจริงได้พร้อมๆ กันหลายคนโดยไม่ต้องพึ่งเครื่อง PDA ราคาแพง
                  </p>
                  <button
                    onClick={() => setPdaBranchId(selectedBranchId === 'ALL' ? branches[0]?.id : selectedBranchId)}
                    className="px-5 py-2 rounded bg-blue-600 text-white font-bold text-xs shadow-2xs hover:bg-blue-500 transition active:scale-95 flex items-center gap-2 mx-auto"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>เปิดระบบสแกนกล้องมือถือสำหรับสาขาที่เลือก</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'json' && <JsonEngineOutputView branches={branches} />}
          </>
      </main>

      {/* Mobile Scanner Modal with Camera Support */}
      {pdaBranchId && (
        <PdaScannerModal
          branches={branches}
          activeBranchId={pdaBranchId}
          setActiveBranchId={setPdaBranchId}
          onScanBarcode={handleScanBarcode}
          onUpdateScannedQty={handleUpdateScannedQty}
          onClose={() => setPdaBranchId(null)}
        />
      )}

      {/* Master Data Upload Modal */}
      {isUploadModalOpen && (
        <MasterDataUploadModal
          branches={branches}
          onImportItemsToBranch={handleImportItemsToBranch}
          onClose={() => setIsUploadModalOpen(false)}
        />
      )}

      {/* Branch Manager Modal */}
      {isBranchManagerOpen && (
        <BranchManagerModal
          branches={branches}
          initialMode={branchManagerMode}
          isSubmitting={isSubmitting}
          onAddBranch={handleAddBranch}
          onEditBranch={handleEditBranch}
          onDeleteBranch={handleDeleteBranch}
          onClose={() => setIsBranchManagerOpen(false)}
        />
      )}
    </div>
  );
}
