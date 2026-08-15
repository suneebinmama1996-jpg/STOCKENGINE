import React, { useState, useRef, useEffect } from 'react';
import { Branch, StockItem } from '../types';
import { safeParseItems } from '../utils/safeJsonParser';
import {
  QrCode,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  MapPin,
  X,
  Box,
  Plus,
  Minus,
  Check,
  Camera,
  CameraOff,
  Search,
  Keyboard,
  Smartphone,
  RefreshCw,
  Bell,
  ArrowRight,
  ChevronRight,
  PackageCheck,
  HelpCircle,
  Zap,
  ZapOff
} from 'lucide-react';
import { playScanBeep } from '../utils/stockCalculations';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface PdaScannerModalProps {
  branches: Branch[];
  activeBranchId: string;
  setActiveBranchId: (id: string) => void;
  onScanBarcode: (branchId: string, barcodeOrSku: string, location?: string) => StockItem | null;
  onUpdateScannedQty: (branchId: string, itemId: string, newQty: number) => void;
  onClose: () => void;
}

// Utility to get beautiful product thumbnail representations mimicking real mobile app icons
const getThumbnailForProduct = (name: string, category: string) => {
  const lowerName = (name || '').toLowerCase();
  
  if (lowerName.includes('กระดาษ') || lowerName.includes('paper')) {
    return { emoji: '📄', bgColor: 'bg-orange-50 border-orange-100 text-orange-600' };
  }
  if (lowerName.includes('สติกเกอร์') || lowerName.includes('sticker')) {
    return { emoji: '🏷️', bgColor: 'bg-yellow-50 border-yellow-100 text-yellow-600' };
  }
  if (lowerName.includes('คีย์บอร์ด') || lowerName.includes('keyboard')) {
    return { emoji: '⌨️', bgColor: 'bg-rose-50 border-rose-100 text-rose-600' };
  }
  if (lowerName.includes('เมาส์') || lowerName.includes('mouse')) {
    return { emoji: '🖱️', bgColor: 'bg-sky-50 border-sky-100 text-sky-600' };
  }
  if (lowerName.includes('เอกสาร') || lowerName.includes('ซอง') || lowerName.includes('document') || lowerName.includes('กฎหมาย')) {
    return { emoji: '📁', bgColor: 'bg-amber-50 border-amber-100 text-amber-600' };
  }
  if (lowerName.includes('แสตมป์') || lowerName.includes('stamp')) {
    return { emoji: '✉️', bgColor: 'bg-indigo-50 border-indigo-100 text-indigo-600' };
  }
  if (lowerName.includes('headphones') || lowerName.includes('หูฟัง')) {
    return { emoji: '🎧', bgColor: 'bg-violet-50 border-violet-100 text-violet-600' };
  }
  if (lowerName.includes('power bank') || lowerName.includes('แบต')) {
    return { emoji: '🔋', bgColor: 'bg-emerald-50 border-emerald-100 text-emerald-600' };
  }
  if (lowerName.includes('t-shirt') || lowerName.includes('เสื้อ')) {
    return { emoji: '👕', bgColor: 'bg-teal-50 border-teal-100 text-teal-600' };
  }
  if (lowerName.includes('jeans') || lowerName.includes('กางเกง')) {
    return { emoji: '👖', bgColor: 'bg-blue-50 border-blue-100 text-blue-600' };
  }
  if (lowerName.includes('serum') || lowerName.includes('เซรั่ม') || lowerName.includes('lotion') || lowerName.includes('ครีม')) {
    return { emoji: '🧴', bgColor: 'bg-pink-50 border-pink-100 text-pink-600' };
  }
  if (lowerName.includes('tea') || lowerName.includes('ชา') || lowerName.includes('coffee') || lowerName.includes('กาแฟ')) {
    return { emoji: '☕', bgColor: 'bg-amber-100 border-amber-200 text-amber-800' };
  }
  if (lowerName.includes('vacuum') || lowerName.includes('เครื่องดูดฝุ่น') || lowerName.includes('purifier')) {
    return { emoji: '🌀', bgColor: 'bg-cyan-50 border-cyan-100 text-cyan-600' };
  }
  if (lowerName.includes('ฮิญาบ') || lowerName.includes('เดรส') || lowerName.includes('ผ้าคลุม')) {
    return { emoji: '🧕', bgColor: 'bg-rose-50 border-rose-100 text-rose-500' };
  }
  
  return { emoji: '📦', bgColor: 'bg-slate-100 border-slate-200 text-slate-600' };
};

export const PdaScannerModal: React.FC<PdaScannerModalProps> = ({
  branches,
  activeBranchId,
  setActiveBranchId,
  onScanBarcode,
  onUpdateScannedQty,
  onClose,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [justScannedSku, setJustScannedSku] = useState<string | null>(null);
  const justScannedTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Camera scanning states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [torchEnabled, setTorchEnabled] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanLockRef = useRef(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // List available camera devices on active with strict back/environment preference
  useEffect(() => {
    if (cameraActive) {
      Html5Qrcode.getCameras()
        .then((devices) => {
          if (devices && devices.length > 0) {
            setCameras(devices);
            // Strictly default to environment / back / rear camera
            const backCam = devices.find((d) => {
              const label = (d.label || '').toLowerCase();
              return (
                label.includes('back') ||
                label.includes('rear') ||
                label.includes('environment') ||
                label.includes('facing back') ||
                label.includes('กล้องหลัง') ||
                label.includes('0, facing back') ||
                label.includes('wide')
              );
            });
            if (backCam) {
              setSelectedCameraId(backCam.id);
            } else if (devices.length > 1) {
              // On many phones the last device in list is the rear main camera
              setSelectedCameraId(devices[devices.length - 1].id);
            } else {
              setSelectedCameraId(devices[0].id);
            }
          }
        })
        .catch((err) => {
          console.warn('Failed to retrieve list of camera devices:', err);
        });
    } else {
      setCameras([]);
      setSelectedCameraId('');
    }
  }, [cameraActive]);

  const [lastScannedItem, setLastScannedItem] = useState<{
    item: StockItem;
    timestamp: string;
  } | null>(null);

  const [scanHistory, setScanHistory] = useState<
    {
      sku: string;
      name: string;
      barcode: string;
      scannedQty: number;
      systemQty: number;
      status: string;
      time: string;
      location?: string;
    }[]
  >([]);

  // Search input for quick keyboard search/count
  const [skuSearchQuery, setSkuSearchQuery] = useState('');

  const keyboardInputRef = useRef<HTMLInputElement>(null);
  const rawActiveBranch = branches.find((b) => b.id === activeBranchId) || branches[0];

  const activeBranch = React.useMemo(() => {
    if (!rawActiveBranch) return null;
    return {
      ...rawActiveBranch,
      items: safeParseItems(rawActiveBranch.items)
    };
  }, [rawActiveBranch]);

  useEffect(() => {
    keyboardInputRef.current?.focus();
  }, [activeBranchId]);

  // Lock background body scroll to prevent mobile panning and bouncing
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalHeight = document.body.style.height;
    
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100%';
    
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.height = originalHeight;
    };
  }, []);

  // Extract unique locations/bins available in this branch
  const availableLocations: string[] = Array.from(
    new Set((activeBranch?.items || []).map((item) => item.location).filter(Boolean))
  ).sort() as string[];

  const latestScanContext = useRef({ activeBranch, onScanBarcode, selectedLocation });
  useEffect(() => {
    latestScanContext.current = { activeBranch, onScanBarcode, selectedLocation };
  }, [activeBranch, onScanBarcode, selectedLocation]);

  // HTML5 Barcode/QR Code Camera scanner implementation supporting all barcode formats
  useEffect(() => {
    if (cameraActive) {
      setCameraError(null);
      setTorchEnabled(false);
      const timer = setTimeout(() => {
        try {
          const html5QrCode = new Html5Qrcode("camera-reader-viewport", {
            verbose: false,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
              Html5QrcodeSupportedFormats.CODABAR,
              Html5QrcodeSupportedFormats.ITF,
              Html5QrcodeSupportedFormats.DATA_MATRIX,
            ],
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true,
            },
          });
          scannerRef.current = html5QrCode;
          
          // Enhanced video constraints: HD resolution & continuous focus
          const primaryConstraints: any = selectedCameraId
            ? {
                deviceId: { exact: selectedCameraId },
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
                advanced: [{ focusMode: "continuous" } as any],
              }
            : {
                facingMode: "environment",
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
                advanced: [{ focusMode: "continuous" } as any],
              };

          const scanConfig = {
            fps: 25, // Fast frame rate for rapid barcode detection
            qrbox: (viewWidth: number, viewHeight: number) => {
              const boxWidth = Math.min(Math.floor(viewWidth * 0.9), 380);
              const boxHeight = Math.min(Math.floor(viewHeight * 0.65), 240);
              return { width: boxWidth, height: boxHeight };
            },
            aspectRatio: 1.333333,
            disableFlip: false,
          };

          const launchScanner = async () => {
            try {
              // Attempt 1: Direct back camera with HD constraints
              await html5QrCode.start(
                primaryConstraints,
                scanConfig,
                (decodedText) => handleBarcodeScanned(decodedText),
                () => {}
              );
            } catch (err1) {
              console.warn("Attempt 1 camera start failed, trying facingMode environment fallback:", err1);
              try {
                // Attempt 2: Flexible environment constraint without exact deviceId
                await html5QrCode.start(
                  { facingMode: "environment" },
                  { fps: 20, qrbox: { width: 300, height: 200 } },
                  (decodedText) => handleBarcodeScanned(decodedText),
                  () => {}
                );
              } catch (err2) {
                console.warn("Attempt 2 fallback failed, trying generic video stream:", err2);
                try {
                  // Attempt 3: Any available video stream
                  const fallbackId = cameras.length > 0 ? cameras[0].id : undefined;
                  await html5QrCode.start(
                    fallbackId ? { deviceId: fallbackId } : { facingMode: "user" },
                    { fps: 15 },
                    (decodedText) => handleBarcodeScanned(decodedText),
                    () => {}
                  );
                } catch (finalErr) {
                  console.error("All camera start attempts failed:", finalErr);
                  setCameraError("ไม่สามารถเปิดใช้งานกล้องวิดีโอบนอุปกรณ์นี้ได้ค่ะ (กรุณากด 'อนุญาตการใช้กล้อง' ในเบราว์เซอร์ หรือใช้วิธี 'ถ่ายรูปบาร์โค้ด' ด้านล่างแทนได้เลยค่ะ)");
                  setCameraActive(false);
                }
              }
            }
          };

          launchScanner();
        } catch (e) {
          console.error("Scanner init error", e);
          setCameraError("เกิดข้อผิดพลาดในการเปิดระบบสแกนเนอร์");
          setCameraActive(false);
        }
      }, 350);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(err => console.error("Scanner stop error", err));
          }
          scannerRef.current = null;
        }
      };
    }
  }, [cameraActive, selectedCameraId]);

  // Handle manual photo upload or snapshot scan
  const handleImageFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCameraError(null);
    const tempScanner = new Html5Qrcode("camera-reader-viewport-temp", {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
      ],
    });
    
    // Read and scan file
    tempScanner.scanFile(file, true)
      .then((decodedText) => {
        handleBarcodeScanned(decodedText);
        tempScanner.clear();
      })
      .catch((err) => {
        console.error("File barcode scanning failed", err);
        setCameraError("❌ ไม่พบข้อมูลบาร์โค้ดหรือ QR Code ในรูปภาพที่เลือกค่ะ กรุณาจัดกึ่งกลางภาพและถ่ายรูปให้ชัดเจนขึ้น แล้วลองใหม่อีกครั้งนะคะ");
        tempScanner.clear();
      });
  };

  // Continuous Scan Workflow: Auto-Switch Box vs Scan SKU + 1 without closing camera
  const handleBarcodeScanned = (code: string) => {
    if (scanLockRef.current) return;
    
    const query = code.trim();
    const { activeBranch: currBranch, onScanBarcode: currOnScanBarcode, selectedLocation: currSelectedLocation } = latestScanContext.current;
    
    if (!query || !currBranch) return;

    // Fast throttle (800ms) to allow rapid continuous scanning without duplicate frame bounces
    scanLockRef.current = true;
    setTimeout(() => {
      scanLockRef.current = false;
    }, 850);
    
    // 1. Check if query matches a known location/box in the branch
    const isExactLocationMatch = availableLocations.some((loc) => (loc || '').toLowerCase() === query.toLowerCase());
    
    // Check if query matches a product barcode or SKU in current branch
    const isProductMatch = currBranch.items.some(
      (item) => (item.barcode || '').toLowerCase() === query.toLowerCase() || (item.sku || '').toLowerCase() === query.toLowerCase()
    );

    const isBoxCodePattern = 
      query.toUpperCase().startsWith('BOX-') || 
      query.toUpperCase().startsWith('BIN-') || 
      query.toUpperCase().startsWith('LOC-') || 
      query.toUpperCase().startsWith('SHT-') || 
      query.toUpperCase().startsWith('DM-') || 
      query.startsWith('ลัง') || 
      query.startsWith('ชั้น') || 
      query.toUpperCase().startsWith('SHELF-');

    // If it's an explicit location match or box pattern (and not solely a product inside the current box)
    if (isExactLocationMatch || (isBoxCodePattern && !isProductMatch)) {
      // Step 1 / Switch Box: Set active box & filter list immediately
      setSelectedLocation(query);
      if (soundEnabled) playScanBeep('box');
      if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
      
      const itemsInLoc = currBranch.items.filter(
        (i) => (i.location || '').toLowerCase() === query.toLowerCase()
      );
      
      setLocationNotice(`📦 สแกน QR ลัง: "${query}" สำเร็จ! สแกนบาร์โค้ด SKU ในลังนี้ต่อได้ทันที (${itemsInLoc.length} รายการ)`);
      setTimeout(() => setLocationNotice(null), 4000);
      return;
    }

    // Step 2 (Scan SKU): Scan barcode or SKU within the active box context
    const scanned = currOnScanBarcode(currBranch.id, query, currSelectedLocation);
    const now = new Date().toLocaleTimeString('th-TH');

    if (scanned) {
      // Visual feedback: green flashing card
      setJustScannedSku(scanned.sku);
      if (justScannedTimerRef.current) clearTimeout(justScannedTimerRef.current);
      justScannedTimerRef.current = setTimeout(() => {
        setJustScannedSku(null);
      }, 2000);

      // Audio & Haptic feedback
      if (soundEnabled) {
        if (scanned.status === 'MATCH') {
          playScanBeep('match');
        } else if (scanned.status === 'OVER') {
          playScanBeep('over');
        } else {
          playScanBeep('item');
        }
      }

      if (navigator.vibrate) {
        if (scanned.status === 'MATCH') {
          navigator.vibrate([100, 50, 150]);
        } else {
          navigator.vibrate(80);
        }
      }

      setLastScannedItem({ item: scanned, timestamp: now });
      setScanHistory((prev) => [
        {
          sku: scanned.sku,
          name: scanned.name,
          barcode: scanned.barcode,
          scannedQty: scanned.scannedQty,
          systemQty: scanned.systemQty,
          status: scanned.status,
          time: now,
          location: scanned.location,
        },
        ...prev.slice(0, 9),
      ]);

      const statusMsg =
        scanned.status === 'MATCH'
          ? 'ครบถ้วน (MATCH 🟢)'
          : scanned.status === 'OVER'
          ? `เกิน +${scanned.variance} (OVER 🟡)`
          : `ขาดอีก -${Math.abs(scanned.variance)} (SHORTAGE 🔴)`;

      setLocationNotice(`✓ สแกน [${scanned.sku}]: +1 ชิ้น (นับแล้ว ${scanned.scannedQty}/${scanned.systemQty} ชิ้น) — ${statusMsg}`);
      setTimeout(() => setLocationNotice(null), 3500);

      // Auto scroll to scanned item smoothly
      try {
        const itemEl = document.getElementById(`mobile-item-${scanned.sku}`);
        if (itemEl) {
          itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } catch (e) {
        // ignore scroll error
      }
    } else {
      if (soundEnabled) playScanBeep('error');
      if (navigator.vibrate) navigator.vibrate([200]);
      alert(`ไม่พบสินค้าด้วยรหัสสแกน "${query}" ในระบบสาขา ${currBranch.name}`);
    }
  };

  const handleManualScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!barcodeInput.trim()) return;
    handleBarcodeScanned(barcodeInput);
    setBarcodeInput('');
    setTimeout(() => keyboardInputRef.current?.focus(), 100);
  };

  const handleUpdateItemQtyInModal = (itemId: string, newQty: number) => {
    if (!activeBranch) return;
    const cleanQty = Math.max(0, newQty);
    onUpdateScannedQty(activeBranch.id, itemId, cleanQty);

    // Refresh last scanned item if that's the one being modified
    if (lastScannedItem && lastScannedItem.item.id === itemId) {
      const found = activeBranch.items.find(i => i.id === itemId);
      if (found) {
        setLastScannedItem({
          item: {
            ...found,
            scannedQty: cleanQty,
            variance: cleanQty - found.systemQty,
            status: cleanQty === found.systemQty ? 'MATCH' : cleanQty < found.systemQty ? 'SHORTAGE' : 'OVER',
            color: cleanQty === found.systemQty ? 'GREEN' : cleanQty < found.systemQty ? 'RED' : 'YELLOW',
          },
          timestamp: lastScannedItem.timestamp,
        });
      }
    }
  };

  // Filter items in active branch by location & quick search query
  const filteredItemsToView = (activeBranch?.items || []).filter((item) => {
    const matchesLoc = selectedLocation === 'ALL' || 
      (item.location || '').toLowerCase() === selectedLocation.toLowerCase();
    const matchesSearch =
      !skuSearchQuery ||
      (item.sku || '').toLowerCase().includes(skuSearchQuery.toLowerCase()) ||
      (item.barcode || '').toLowerCase().includes(skuSearchQuery.toLowerCase()) ||
      (item.name || '').toLowerCase().includes(skuSearchQuery.toLowerCase());
    return matchesLoc && matchesSearch;
  });

  // Calculate high-level summary of discrepancies to display dynamically in the header card
  const shortageItems = (activeBranch?.items || []).filter(item => item.status === 'SHORTAGE');
  const alertItem = lastScannedItem?.item || (shortageItems.length > 0 ? shortageItems[0] : null);

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col font-sans w-full h-[100dvh] max-h-[100dvh] overflow-hidden">
      
      {/* Dynamic Native App Header - Full Screen Responsive */}
      <div className="bg-slate-900 text-white px-4 py-3 flex flex-col gap-2.5 shrink-0 z-10 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500 text-slate-950 rounded-xl flex items-center justify-center shadow-md">
              <Smartphone className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight flex items-center gap-2">
                ระบบสแกนนับสต็อกมือถือ 
                <span className="text-[10px] text-emerald-400 bg-emerald-950/90 px-2 py-0.5 rounded-full font-black border border-emerald-800/60 animate-pulse">
                  ซิงค์เรียลไทม์
                </span>
              </h1>
              <p className="text-[10px] text-slate-400">สแกนบาร์โค้ดหรือ QR ลังเพื่อตรวจนับสต็อกทันที</p>
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              title="สลับเสียงเตือน"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-rose-950 text-rose-300 border border-rose-800/40 hover:bg-rose-900 transition font-black text-xs flex items-center gap-1 shadow-sm"
              title="ปิด"
            >
              <X className="w-4 h-4" />
              <span>ปิด</span>
            </button>
          </div>
        </div>

        {/* Branch Selector & Active Stats */}
        <div className="flex items-center justify-between bg-slate-800 rounded-xl p-2 border border-slate-700/80">
          <div className="flex items-center gap-2 truncate max-w-[70%]">
            <MapPin className="w-4 h-4 text-slate-400" />
            <select
              value={activeBranchId}
              onChange={(e) => {
                setActiveBranchId(e.target.value);
                setSelectedLocation('ALL');
              }}
              className="bg-transparent text-base md:text-xs font-black text-white focus:outline-none cursor-pointer truncate w-full"
            >
              {branches.map((b, idx) => (
                <option key={`${b.id}-${idx}`} value={b.id} className="text-slate-950">
                  สาขา: {b.code} - {b.name}
                </option>
              ))}
            </select>
          </div>
          <span className="text-[10px] text-slate-200 font-mono font-bold bg-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-600">
            {activeBranch?.items.length || 0} รายการ (SKU)
          </span>
        </div>
      </div>

      {/* COMPONENT SCROLLABLE CONTENT - Edge to Edge */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-4 max-w-4xl mx-auto w-full">

        {/* 1. NOTIFICATION / CURRENT ALERT CARD */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md border-2 border-emerald-500/80 transition-all space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                {lastScannedItem ? `🟢 ผลการสแกนล่าสุด (${lastScannedItem.timestamp})` : '📦 แดชบอร์ดตรวจนับสินค้าในมือถือ'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Real-time Sync</span>
          </div>
          
          {alertItem ? (
            <div className="space-y-3.5">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wide">รหัสสินค้า / SKU:</span>
                    <p className="text-3xl font-black font-mono tracking-wider text-white break-all leading-none mt-1">
                      {alertItem.sku}
                    </p>
                  </div>
                  <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 w-fit shrink-0">
                    <span className="text-[9px] font-black text-slate-400 block uppercase">บาร์โค้ด (Barcode):</span>
                    <p className="text-base font-bold font-mono text-slate-100 tracking-wide mt-0.5">
                      {alertItem.barcode}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] font-black text-slate-400 block uppercase">ชื่อสินค้า (Name):</span>
                  <p className="text-sm font-extrabold text-slate-300 leading-snug">
                    {alertItem.name}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1.5">
                  <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded">
                    📦 ลังสินค้า: <strong className="font-mono underline ml-1 text-sm">{alertItem.location}</strong>
                  </span>
                  
                  <span className={`inline-flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded ${
                    alertItem.scannedQty === alertItem.systemQty
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : alertItem.scannedQty < alertItem.systemQty
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {alertItem.scannedQty === alertItem.systemQty 
                      ? '🟢 ครบถ้วน (MATCH)' 
                      : alertItem.scannedQty < alertItem.systemQty 
                      ? `🔴 ขาดอีก -${alertItem.systemQty - alertItem.scannedQty} ชิ้น` 
                      : `🟡 เกินมา +${alertItem.scannedQty - alertItem.systemQty} ชิ้น`
                    }
                  </span>
                </div>
              </div>

              {/* Huge legible counters for count check */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wide">จำนวนที่แสกนได้จริง</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-4xl md:text-5xl font-black font-mono text-emerald-400">
                      {alertItem.scannedQty}
                    </span>
                    <span className="text-sm font-bold text-slate-400">ชิ้น</span>
                  </div>
                </div>

                <div className="text-center font-mono font-bold text-slate-600 text-2xl px-1">
                  /
                </div>

                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wide">ยอดตั้งต้นในระบบ</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-4xl md:text-5xl font-black font-mono text-slate-300">
                      {alertItem.systemQty}
                    </span>
                    <span className="text-sm font-bold text-slate-400">ชิ้น</span>
                  </div>
                </div>

                {/* +/- adjustment buttons with comfortable touch size right on the scanned banner */}
                <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleUpdateItemQtyInModal(alertItem.id, alertItem.scannedQty - 1)}
                    className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition active:scale-90 font-black text-lg"
                    title="ลดจำนวน 1 ชิ้น"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateItemQtyInModal(alertItem.id, alertItem.scannedQty + 1)}
                    className="w-10 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition active:scale-90 font-black text-lg"
                    title="เพิ่มจำนวน 1 ชิ้น"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
              <p className="text-sm font-black text-slate-200">เครื่องสแกนบาร์โค้ด & QR โค้ดลังสินค้า</p>
              <p className="text-xs text-slate-400 mt-1">
                สแกนรหัส QR บนกล่องหรือลังสินค้า เพื่อกรองสินค้าที่บรรจุอยู่และอัปเดตยอดคงคลังได้ทันที ยอดจะแสดงที่นี่ในขนาดใหญ่อ่านง่าย
              </p>
            </div>
          )}
        </div>

        {/* 2. CAMERA VIEWER OR CAMERA TOGGLE BUTTON */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="p-3.5 bg-white flex items-center justify-between border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-emerald-500" />
              กล้องมือถือสำหรับสแกน QR ลังสินค้า / บาร์โค้ด
            </span>
            <button
              onClick={() => setCameraActive(!cameraActive)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-sm active:scale-95 ${
                cameraActive 
                  ? 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100' 
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
              }`}
            >
              {cameraActive ? (
                <>
                  <CameraOff className="w-3.5 h-3.5" />
                  <span>ปิดใช้งานกล้อง</span>
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5" />
                  <span>เปิดสแกนผ่านกล้อง</span>
                </>
              )}
            </button>
          </div>

          {cameraActive && (
            <div className="p-4 bg-slate-950 text-center relative group">
              <div 
                id="camera-reader-viewport" 
                className="mx-auto w-full max-w-md overflow-hidden rounded-xl bg-slate-900 border border-slate-800 aspect-video flex items-center justify-center relative shadow-inner"
              />
              <button
                onClick={() => {
                  const newTorch = !torchEnabled;
                  if (scannerRef.current) {
                    scannerRef.current.applyVideoConstraints({
                      advanced: [{ torch: newTorch } as any]
                    }).then(() => {
                      setTorchEnabled(newTorch);
                    }).catch((err) => {
                      console.warn("Torch toggle failed or not supported by device:", err);
                      alert('อุปกรณ์นี้ไม่รองรับการเปิดไฟฉายขณะสแกน');
                    });
                  }
                }}
                className={`absolute bottom-12 right-8 p-2.5 rounded-full border shadow-md transition z-10 ${
                  torchEnabled 
                    ? 'bg-amber-400 text-amber-900 border-amber-500' 
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="เปิด/ปิด ไฟฉาย"
              >
                {torchEnabled ? <ZapOff className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
              </button>
              <p className="text-[11px] text-slate-400 mt-3 font-medium">
                หันกล้องไปที่ **QR Code ลังสินค้า** หรือ **บาร์โค้ด** บนฉลากสินค้าเพื่อทำการสแกนอัตโนมัติ
              </p>
            </div>
          )}

          {/* HIDDEN TEMP VIEWPORT FOR INSTANT FILE SCANNING */}
          <div id="camera-reader-viewport-temp" className="hidden" />

          {/* BACKUP PHOTO UPLOADER & CAMERA SELECTOR */}
          <div className="p-3.5 bg-slate-50 flex flex-col items-center justify-center gap-3 border-t border-slate-100">
            {cameraActive && cameras.length > 1 && (
              <div className="w-full max-w-xs text-left">
                <span className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">
                  กล้องที่ตรวจพบ ({cameras.length}):
                </span>
                <select
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  className="w-full text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:ring-2 focus:ring-blue-100"
                >
                  {cameras.map((cam, i) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.label || `เลนส์กล้องที่ ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="text-center w-full">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 w-full max-w-xs px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-black rounded-xl border border-sky-100 transition active:scale-95 shadow-xs"
              >
                <Camera className="w-4 h-4 text-sky-600" />
                <span>เปิดกล้องมือถือถ่ายรูปบาร์โค้ด / อัปโหลดภาพ</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageFileSelected}
                accept="image/*"
                className="hidden"
              />
              <p className="text-[10px] text-slate-400 mt-1.5 leading-normal">
                💡 <strong>โหมดถ่ายรูปทดแทน:</strong> หากสิทธิ์การเปิดวิดีโอกล้องวิดีโอถูกบล็อกบนเบราว์เซอร์มือถือ ท่านสามารถใช้วิธีถ่ายรูปฉลากสินค้าเพื่อทำการถอดรหัสบาร์โค้ดได้ 100% ค่ะ
              </p>
            </div>
          </div>

          {cameraError && (
            <div className="p-3.5 bg-rose-50 text-rose-700 text-xs font-semibold flex items-center gap-2 border-t border-rose-100">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="leading-tight">{cameraError}</span>
            </div>
          )}
        </div>

        {/* 3. ACTIVE BOX QR CODE INDICATOR & CONTROLS */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Box className="w-4 h-4 text-amber-500" />
              <span>คลังบรรจุ / รหัสลังสินค้า (Box QR Code):</span>
            </span>
            {selectedLocation !== 'ALL' && (
              <button
                onClick={() => setSelectedLocation('ALL')}
                className="text-xs text-blue-600 hover:underline font-extrabold"
              >
                แสดงรายการทั้งหมด
              </button>
            )}
          </div>

          {selectedLocation !== 'ALL' ? (
            <div className="p-4 rounded-xl bg-amber-500 text-slate-950 border-2 border-amber-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-3xl">📦</span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-950/80">กล่อง / ลังที่กำลังตรวจนับ:</p>
                  <p className="text-2xl font-black font-mono break-all text-slate-950 drop-shadow-2xs">
                    {selectedLocation}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLocation('ALL')}
                className="w-full sm:w-auto px-4 py-2 text-xs font-black bg-slate-950 text-white hover:bg-slate-800 rounded-lg shadow-md transition shrink-0 active:scale-95"
              >
                ยิงลังอื่น / แสดงทั้งหมด
              </button>
            </div>
          ) : (
            <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
              <p className="text-xs text-slate-500 font-medium">สแกนรหัสคิวอาร์ลังสินค้าเพื่อค้นหาสินค้าบรรจุในลังทันที</p>
              
              {/* Shortcut Bins list */}
              {availableLocations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 text-left mb-2 uppercase tracking-wide">คลิกเพื่อสลับรหัสลังจำลอง:</p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {availableLocations.map((loc) => (
                      <button
                        key={loc}
                        onClick={() => {
                          setSelectedLocation(loc);
                          if (soundEnabled) playScanBeep('success');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:border-slate-300 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-2xs"
                      >
                        <span>📦 {loc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {locationNotice && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2.5 animate-bounce shadow-sm">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
            <span>{locationNotice}</span>
          </div>
        )}

        {/* 4. MANUAL BARCODE SEARCH & KEY-IN KEYBOARD */}
        <div className="grid grid-cols-1 gap-2 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <form onSubmit={handleManualScanSubmit} className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              คีย์บาร์โค้ด หรือจำลองรหัสสินค้าเพื่อแสกน:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  ref={keyboardInputRef}
                  type="text"
                  placeholder="สแกนบาร์โค้ด หรือพิมพ์ SKU แมนนวล..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-11 pr-3 py-3 text-base font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>
              <button
                type="submit"
                className="px-5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition flex items-center gap-1.5 active:scale-95 shrink-0 shadow-sm"
              >
                <Keyboard className="w-4 h-4" />
                <span>จำลองการสแกน</span>
              </button>
            </div>
          </form>
        </div>

        {/* 5. LIVE PRODUCT LIST - PERFECT REPLICA WITH REAL-TIME COLOR CODED STATUS & BADGES */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row gap-2.5 justify-between sm:items-center">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <PackageCheck className="w-4.5 h-4.5 text-emerald-500" />
              <span>
                {selectedLocation !== 'ALL' 
                  ? `สินค้าในลัง "${selectedLocation}"` 
                  : 'รายการสินค้าและสถานะนับสต็อก'} ({filteredItemsToView.length} รายการ)
              </span>
            </span>
            
            <input
              type="text"
              placeholder="🔍 ค้นหาสินค้าด่วน..."
              value={skuSearchQuery}
              onChange={(e) => setSkuSearchQuery(e.target.value)}
              className="w-full sm:w-48 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-base md:text-xs font-semibold text-slate-700 focus:outline-none"
            />
          </div>

          {/* Minimal Mobile Product List - Clean SKU, 0/1 Count, Large Thumb +/- Buttons, and MATCH Highlight */}
          <div className="p-3 sm:p-4 space-y-2.5">
            {filteredItemsToView.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Box className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <span className="font-bold">ไม่พบสินค้าในรหัสลังหรือการค้นหานี้</span>
              </div>
            ) : (
              filteredItemsToView.map((item, index) => {
                const isMatch = item.scannedQty === item.systemQty;
                const isShortage = item.scannedQty < item.systemQty;
                const isOver = item.scannedQty > item.systemQty;

                // Robust SKU and Name determination
                const displaySku =
                  item.sku && String(item.sku).trim() !== ''
                    ? String(item.sku).trim()
                    : item.barcode && String(item.barcode).trim() !== ''
                    ? String(item.barcode).trim()
                    : item.name && String(item.name).trim() !== ''
                    ? String(item.name).trim()
                    : `SKU-${index + 1}`;

                const displayName =
                  item.name && String(item.name).trim() !== '' && String(item.name).trim() !== displaySku
                    ? String(item.name).trim()
                    : '';

                const isJustScanned =
                  justScannedSku === displaySku ||
                  justScannedSku === item.sku ||
                  (item.barcode && justScannedSku === item.barcode);

                // Dynamic background and border styling based on audit status and live scan trigger
                let rowCardClass = 'bg-white border-slate-200 text-slate-900 shadow-2xs hover:border-slate-300';
                let badgeEl = (
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    รอสแกน
                  </span>
                );

                if (isJustScanned) {
                  // Vibrant green flash effect when just scanned
                  rowCardClass = 'bg-emerald-100 border-emerald-500 text-emerald-950 shadow-md ring-4 ring-emerald-400/80 scale-[1.01] transition-all duration-300';
                  badgeEl = (
                    <span className="text-[10px] font-black text-white bg-emerald-700 px-2 py-0.5 rounded flex items-center gap-1 shadow-xs animate-pulse">
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      นับเพิ่มแล้ว!
                    </span>
                  );
                } else if (isMatch) {
                  // Light green background highlight when MATCH
                  rowCardClass = 'bg-emerald-50/95 border-emerald-400 text-emerald-950 shadow-xs ring-1 ring-emerald-300/80';
                  badgeEl = (
                    <span className="text-[10px] font-black text-white bg-emerald-600 px-2 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      MATCH
                    </span>
                  );
                } else if (isShortage) {
                  if (item.scannedQty > 0) {
                    rowCardClass = 'bg-rose-50/70 border-rose-300 text-rose-950 shadow-2xs';
                    badgeEl = (
                      <span className="text-[10px] font-black text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                        ขาด -{item.systemQty - item.scannedQty}
                      </span>
                    );
                  }
                } else if (isOver) {
                  rowCardClass = 'bg-amber-50/95 border-amber-400 text-amber-950 shadow-xs';
                  badgeEl = (
                    <span className="text-[10px] font-black text-amber-900 bg-amber-200 px-2 py-0.5 rounded border border-amber-300">
                      เกิน +{item.scannedQty - item.systemQty}
                    </span>
                  );
                }

                return (
                  <div
                    key={`${item.id}-${index}`}
                    id={`mobile-item-${displaySku}`}
                    className={`p-3 sm:p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 ${rowCardClass}`}
                  >
                    {/* Left: Prominent SKU, Product Name (if available), and Status Badge */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base sm:text-lg font-black font-mono tracking-wide text-slate-900 break-all leading-tight">
                          {displaySku}
                        </span>
                        {badgeEl}
                      </div>
                      {displayName && (
                        <p className="text-xs font-semibold text-slate-600 truncate mt-1" title={displayName}>
                          {displayName}
                        </p>
                      )}
                    </div>

                    {/* Right: Scanned / System Count & Large +/- Thumb Buttons */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      {/* Count Display (e.g. 0 / 1, 1 / 1) */}
                      <div className="bg-white/95 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-baseline gap-1 font-mono text-center min-w-[62px] justify-center select-none">
                        <span className={`text-xl sm:text-2xl font-black ${
                          isMatch ? 'text-emerald-600' : isOver ? 'text-amber-600' : 'text-slate-900'
                        }`}>
                          {item.scannedQty}
                        </span>
                        <span className="text-sm font-bold text-slate-400">/</span>
                        <span className="text-sm sm:text-base font-bold text-slate-500">
                          {item.systemQty}
                        </span>
                      </div>

                      {/* Large Thumb-Friendly +/- Touch Buttons */}
                      <div className="flex items-center gap-1.5">
                        {/* Minus Button */}
                        <button
                          type="button"
                          id={`btn-minus-${displaySku}`}
                          onClick={() => handleUpdateItemQtyInModal(item.id, Math.max(0, item.scannedQty - 1))}
                          className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 flex items-center justify-center font-black select-none active:scale-90 transition shadow-2xs border border-slate-300 cursor-pointer"
                          title="ลดจำนวน 1 ชิ้น"
                        >
                          <Minus className="w-5 h-5 stroke-[3]" />
                        </button>

                        {/* Plus Button */}
                        <button
                          type="button"
                          id={`btn-plus-${displaySku}`}
                          onClick={() => handleUpdateItemQtyInModal(item.id, item.scannedQty + 1)}
                          className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white flex items-center justify-center font-black select-none active:scale-90 transition shadow-xs cursor-pointer"
                          title="เพิ่มจำนวน 1 ชิ้น"
                        >
                          <Plus className="w-5 h-5 stroke-[3]" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 6. REAL-TIME RECENT LOGS */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm space-y-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
            ประวัติการสแกนกล้องบาร์โค้ดล่าสุด (Scan Logs)
          </span>
          <div className="space-y-1.5 max-h-24 overflow-y-auto text-[10px] font-mono">
            {scanHistory.length === 0 ? (
              <p className="text-slate-400 text-[10px] italic">ยังไม่มีประวัติการสแกนในรอบนี้</p>
            ) : (
              scanHistory.map((log, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100"
                >
                  <div className="truncate max-w-[50%] font-mono">
                    <span className="text-blue-600 font-extrabold mr-1">SKU: {log.sku}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-amber-700 font-bold bg-amber-50 px-1 py-0.2 rounded text-[8px] border border-amber-100">
                      📦 {log.location}
                    </span>
                    <span className="text-slate-500 font-bold">
                      {log.scannedQty}/{log.systemQty}
                    </span>
                    <span
                      className={`text-[8px] font-black px-1.5 py-0.2 rounded ${
                        log.scannedQty === log.systemQty
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.scannedQty < log.systemQty
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {log.scannedQty === log.systemQty ? 'ครบ' : log.scannedQty < log.systemQty ? 'ขาด' : 'เกิน'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* FULL SCREEN BOTTOM ACTION BAR */}
      <div className="bg-white px-5 py-4 border-t border-slate-150 shadow-md flex justify-end gap-2 shrink-0 z-10 select-none">
        <button
          onClick={onClose}
          className="w-full max-w-md mx-auto py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition active:scale-95 shadow-md text-center flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4 text-emerald-400" />
          <span>เสร็จสิ้นการบันทึก & ออกจากการนับสต็อกมือถือ</span>
        </button>
      </div>

    </div>
  );
};
