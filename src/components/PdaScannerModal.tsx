import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import jsQR from 'jsqr';
import { BrowserMultiFormatReader } from '@zxing/library';

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
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [locationNotice, setLocationNotice] = useState<{ message: string; type: 'success' | 'warning' | 'error' | 'box' } | null>(null);
  const [justScannedSku, setJustScannedSku] = useState<string | null>(null);
  const justScannedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const locationNoticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToastNotice = (message: string, type: 'success' | 'warning' | 'error' | 'box' = 'success', duration = 3500) => {
    if (locationNoticeTimerRef.current) clearTimeout(locationNoticeTimerRef.current);
    setLocationNotice({ message, type });
    locationNoticeTimerRef.current = setTimeout(() => {
      setLocationNotice(null);
    }, duration);
  };
  
  // Camera scanning states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [torchEnabled, setTorchEnabled] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader>(new BrowserMultiFormatReader());
  const barcodeDetectorRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isScanningFrameRef = useRef(false);
  const scanLockRef = useRef(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // List available camera devices
  useEffect(() => {
    if (cameraActive && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then((devices) => {
          const videoDevices = devices.filter((d) => d.kind === 'videoinput');
          setCameras(videoDevices);
          if (!selectedCameraId && videoDevices.length > 0) {
            const backCam = videoDevices.find((d) => {
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
              setSelectedCameraId(backCam.deviceId);
            }
          }
        })
        .catch((err) => {
          console.warn('Failed to retrieve list of camera devices:', err);
        });
    }
  }, [cameraActive, selectedCameraId]);

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

  // Continuous Scan Workflow: Auto-Switch Box vs Strict In-Box SKU Verification + 1
  const handleBarcodeScanned = useCallback((code: string) => {
    if (scanLockRef.current) return;
    
    const query = code.trim();
    const { activeBranch: currBranch, onScanBarcode: currOnScanBarcode, selectedLocation: currSelectedLocation } = latestScanContext.current;
    
    if (!query || !currBranch) return;

    // Fast throttle (800ms) to allow rapid continuous scanning without duplicate frame bounces
    scanLockRef.current = true;
    setTimeout(() => {
      scanLockRef.current = false;
    }, 800);
    
    // 1. Check if query matches a known location/box in the branch
    const matchingLocation = availableLocations.find(
      (loc) => (loc || '').trim().toLowerCase() === query.toLowerCase()
    );

    const isBoxCodePattern = 
      query.toUpperCase().startsWith('SD-') || 
      query.toUpperCase().startsWith('BOX-') || 
      query.toUpperCase().startsWith('BIN-') || 
      query.toUpperCase().startsWith('LOC-') || 
      query.toUpperCase().startsWith('SHT-') || 
      query.toUpperCase().startsWith('DM-') || 
      query.toUpperCase().startsWith('SHELF-') || 
      query.toUpperCase().startsWith('RACK-') || 
      query.startsWith('ลัง') || 
      query.startsWith('ชั้น');

    const isProductMatchInBranch = currBranch.items.some(
      (item) => (item.barcode || '').trim().toLowerCase() === query.toLowerCase() || (item.sku || '').trim().toLowerCase() === query.toLowerCase()
    );

    // Case 1: Scanned a BOX QR code
    if (matchingLocation || (isBoxCodePattern && !isProductMatchInBranch)) {
      const finalBoxId = matchingLocation || query;
      setSelectedLocation(finalBoxId);
      if (soundEnabled) playScanBeep('box');
      if (navigator.vibrate) navigator.vibrate([60, 60, 100]);
      
      const itemsInLoc = currBranch.items.filter(
        (i) => (i.location || '').trim().toLowerCase() === finalBoxId.toLowerCase()
      );
      
      showToastNotice(
        `📦 สแกน QR ลัง: "${finalBoxId}" สำเร็จ! พบ ${itemsInLoc.length} รายการ — สแกนบาร์โค้ด SKU ในลังนี้ต่อได้ทันที`,
        'box',
        4000
      );
      return;
    }

    // Case 2: No box selected yet -> Prompt worker to scan or select a box first
    if (!currSelectedLocation || currSelectedLocation.trim() === '') {
      const foundItem = currBranch.items.find(
        (item) => (item.barcode || '').trim().toLowerCase() === query.toLowerCase() || (item.sku || '').trim().toLowerCase() === query.toLowerCase()
      );

      if (soundEnabled) playScanBeep('error');
      if (navigator.vibrate) navigator.vibrate([150, 100, 150]);

      if (foundItem) {
        showToastNotice(
          `⚠️ กรุณาสแกน QR Code ลังสินค้าก่อนสแกนนับ SKU ค่ะ (สินค้านี้ [${foundItem.sku}] อยู่ในลัง: "${foundItem.location || '-'}")`,
          'warning',
          4500
        );
      } else {
        showToastNotice(
          `⚠️ กรุณาสแกน QR Code ลังสินค้า (เช่น SD-1-40) หรือเลือกลังก่อนเริ่มนับสินค้าค่ะ`,
          'warning',
          4000
        );
      }
      return;
    }

    // Case 3: In-Box Strict SKU Verification when a specific box is active
    if (currSelectedLocation !== 'ALL') {
      const itemInThisBox = currBranch.items.find(
        (i) =>
          (i.location || '').trim().toLowerCase() === currSelectedLocation.trim().toLowerCase() &&
          ((i.barcode || '').trim().toLowerCase() === query.toLowerCase() ||
           (i.sku || '').trim().toLowerCase() === query.toLowerCase())
      );

      // 3.1: SKU IS in this box -> Count +1
      if (itemInThisBox) {
        const scanned = currOnScanBarcode(currBranch.id, query, currSelectedLocation);
        const now = new Date().toLocaleTimeString('th-TH');

        if (scanned) {
          setJustScannedSku(scanned.sku);
          if (justScannedTimerRef.current) clearTimeout(justScannedTimerRef.current);
          justScannedTimerRef.current = setTimeout(() => {
            setJustScannedSku(null);
          }, 2200);

          // Audio feedback
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

          showToastNotice(
            `✓ สแกน [${scanned.sku}]: +1 ชิ้น (นับแล้ว ${scanned.scannedQty}/${scanned.systemQty} ชิ้น) — ${statusMsg}`,
            'success',
            3500
          );

          try {
            const itemEl = document.getElementById(`mobile-item-${scanned.sku}`);
            if (itemEl) {
              itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          } catch (e) {}
        }
        return;
      }

      // 3.2: SKU is NOT in this box -> Show alert with sound & do not increment
      const itemInOtherBox = currBranch.items.find(
        (i) =>
          (i.barcode || '').trim().toLowerCase() === query.toLowerCase() ||
          (i.sku || '').trim().toLowerCase() === query.toLowerCase()
      );

      if (soundEnabled) playScanBeep('error');
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

      if (itemInOtherBox) {
        showToastNotice(
          `⚠️ สินค้า [${itemInOtherBox.sku}] ไม่อยู่ในลังนี้ (${currSelectedLocation}) — พบอยู่ที่ลัง: "${itemInOtherBox.location}"`,
          'error',
          5000
        );
      } else {
        showToastNotice(
          `⚠️ ไม่พบสินค้า [${query}] ในลัง "${currSelectedLocation}" และไม่พบในระบบสาขา ${currBranch.name}`,
          'error',
          4500
        );
      }
      return;
    }

    // Case 4: SelectedLocation is 'ALL'
    const scanned = currOnScanBarcode(currBranch.id, query, currSelectedLocation);
    const now = new Date().toLocaleTimeString('th-TH');

    if (scanned) {
      setJustScannedSku(scanned.sku);
      if (justScannedTimerRef.current) clearTimeout(justScannedTimerRef.current);
      justScannedTimerRef.current = setTimeout(() => {
        setJustScannedSku(null);
      }, 2000);

      if (soundEnabled) {
        if (scanned.status === 'MATCH') {
          playScanBeep('match');
        } else if (scanned.status === 'OVER') {
          playScanBeep('over');
        } else {
          playScanBeep('item');
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

      showToastNotice(
        `✓ สแกน [${scanned.sku}]: +1 ชิ้น (นับแล้ว ${scanned.scannedQty}/${scanned.systemQty} ชิ้น)`,
        'success',
        3000
      );
    } else {
      if (soundEnabled) playScanBeep('error');
      showToastNotice(`ไม่พบสินค้าด้วยรหัสสแกน "${query}" ในระบบสาขา ${currBranch.name}`, 'error', 4000);
    }
  }, [availableLocations, soundEnabled]);

  // Robust Direct Camera Stream & Decoding Engine
  useEffect(() => {
    let isActive = true;
    let stream: MediaStream | null = null;

    if (!cameraActive) {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    setCameraError(null);
    setTorchEnabled(false);

    // Frame scanning loop
    const processFrame = async () => {
      if (!isActive || !cameraActive) return;

      const video = videoRef.current;
      if (video && video.readyState >= 2 && !video.paused && !video.ended && !isScanningFrameRef.current) {
        isScanningFrameRef.current = true;
        let foundCode: string | null = null;

        try {
          // 1. Try Native BarcodeDetector (Modern Android Chrome & iOS 17+ Safari)
          if ('BarcodeDetector' in window) {
            try {
              if (!barcodeDetectorRef.current) {
                barcodeDetectorRef.current = new (window as any).BarcodeDetector({
                  formats: [
                    'qr_code',
                    'code_128',
                    'ean_13',
                    'code_39',
                    'ean_8',
                    'upc_a',
                    'upc_e',
                    'codabar',
                    'itf',
                    'data_matrix',
                  ],
                });
              }
              const barcodes = await barcodeDetectorRef.current.detect(video);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                foundCode = barcodes[0].rawValue;
              }
            } catch (e) {
              // Fallback to canvas
            }
          }

          // 2. Canvas extraction fallback for jsQR (QR Code) and ZXing (1D Barcodes)
          if (!foundCode && video.videoWidth > 0 && video.videoHeight > 0) {
            let canvas = canvasRef.current;
            if (!canvas) {
              canvas = document.createElement('canvas');
              canvasRef.current = canvas;
            }
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              // Scale down slightly for ultra-fast 60fps frame processing
              const targetW = Math.min(video.videoWidth, 800);
              const targetH = Math.min(video.videoHeight, 600);
              if (canvas.width !== targetW || canvas.height !== targetH) {
                canvas.width = targetW;
                canvas.height = targetH;
              }
              ctx.drawImage(video, 0, 0, targetW, targetH);

              // 2.1 Try jsQR on canvas
              try {
                const imgData = ctx.getImageData(0, 0, targetW, targetH);
                const qrResult = jsQR(imgData.data, imgData.width, imgData.height, {
                  inversionAttempts: 'dontInvert',
                });
                if (qrResult && qrResult.data) {
                  foundCode = qrResult.data;
                }
              } catch (e) {
                // ignore
              }

              // 2.2 Try ZXing for 1D Barcodes if jsQR did not match
              if (!foundCode) {
                try {
                  const zxResult = zxingReaderRef.current.decodeFromCanvas(canvas);
                  if (zxResult && zxResult.getText()) {
                    foundCode = zxResult.getText();
                  }
                } catch (e) {
                  // Not found in this frame - expected
                }
              }
            }
          }

          if (foundCode && isActive) {
            handleBarcodeScanned(foundCode);
          }
        } catch (err) {
          console.warn('Frame scan error:', err);
        } finally {
          isScanningFrameRef.current = false;
        }
      }

      if (isActive && cameraActive) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
      }
    };

    // Camera Stream Acquisition with multi-fallback (FacingMode environment -> generic video)
    const initCamera = async () => {
      try {
        // Step 1: Request environment back camera without 'exact' to prevent OverconstrainedError
        const primaryConstraints: MediaStreamConstraints = {
          video: selectedCameraId
            ? { deviceId: { ideal: selectedCameraId } }
            : {
                facingMode: 'environment', // NO exact constraint
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
          audio: false,
        };

        try {
          stream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
        } catch (err1) {
          console.warn('Environment facingMode failed, falling back to basic { video: true }:', err1);
          // Step 2: Fallback to basic { video: true }
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        if (!isActive) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        mediaStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('webkit-playsinline', 'true');
          videoRef.current.muted = true;
          videoRef.current.autoplay = true;

          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn('Video play auto-call:', playErr);
          }
        }

        // Start frame scan loop
        animationFrameRef.current = requestAnimationFrame(processFrame);
      } catch (finalErr) {
        console.error('All camera initialization attempts failed:', finalErr);
        if (isActive) {
          setCameraError(
            'ไม่สามารถเปิดกล้องได้ค่ะ (กรุณากดอนุญาตการเข้าถึงกล้องในเบราว์เซอร์ หรือใช้วิธี "ถ่ายรูปบาร์โค้ด" ด้านล่างแทนได้เลยนะคะ)'
          );
          setCameraActive(false);
        }
      }
    };

    initCamera();

    return () => {
      isActive = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [cameraActive, selectedCameraId, handleBarcodeScanned]);

  // Torch Toggle Handler
  const handleToggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (!track) return;

    const nextTorch = !torchEnabled;
    try {
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchEnabled(nextTorch);
    } catch (err) {
      console.warn('Torch constraint not supported on this device/browser:', err);
      alert('อุปกรณ์นี้ไม่รองรับการเปิดไฟฉายผ่านเบราว์เซอร์');
    }
  };

  // Handle manual photo upload or snapshot scan
  const handleImageFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCameraError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        let decoded: string | null = null;

        // Check native BarcodeDetector
        if ('BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({
              formats: [
                'qr_code',
                'code_128',
                'ean_13',
                'code_39',
                'ean_8',
                'upc_a',
                'upc_e',
                'codabar',
                'itf',
                'data_matrix',
              ],
            });
            const res = await detector.detect(img);
            if (res && res.length > 0 && res[0].rawValue) {
              decoded = res[0].rawValue;
            }
          } catch {}
        }

        // Check canvas with jsQR and ZXing
        if (!decoded) {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            try {
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const qr = jsQR(imgData.data, imgData.width, imgData.height);
              if (qr && qr.data) {
                decoded = qr.data;
              }
            } catch {}

            if (!decoded) {
              try {
                const zx = zxingReaderRef.current.decodeFromCanvas(canvas);
                if (zx && zx.getText()) {
                  decoded = zx.getText();
                }
              } catch {}
            }
          }
        }

        if (decoded) {
          handleBarcodeScanned(decoded);
        } else {
          setCameraError(
            '❌ ไม่พบข้อมูลบาร์โค้ดหรือ QR Code ในรูปภาพที่เลือกค่ะ กรุณาถ่ายภาพให้ชัดเจนและลองใหม่อีกครั้งนะคะ'
          );
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
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

  // Filter items in active branch strictly by location & quick search query
  const hasBoxSelected = Boolean(selectedLocation && selectedLocation.trim() !== '' && selectedLocation !== 'ALL');
  const isViewingAll = selectedLocation === 'ALL';

  const filteredItemsToView = (activeBranch?.items || []).filter((item) => {
    if (!hasBoxSelected && !isViewingAll) {
      // Hide product list until a box is scanned or selected
      return false;
    }
    const matchesLoc = isViewingAll || 
      (item.location || '').trim().toLowerCase() === selectedLocation.trim().toLowerCase();
    const matchesSearch =
      !skuSearchQuery ||
      (item.sku || '').toLowerCase().includes(skuSearchQuery.toLowerCase()) ||
      (item.barcode || '').toLowerCase().includes(skuSearchQuery.toLowerCase()) ||
      (item.name || '').toLowerCase().includes(skuSearchQuery.toLowerCase());
    return matchesLoc && matchesSearch;
  });

  const totalItemsInThisBox = hasBoxSelected
    ? (activeBranch?.items || []).filter((i) => (i.location || '').trim().toLowerCase() === selectedLocation.trim().toLowerCase()).length
    : 0;

  const matchedItemsInThisBox = hasBoxSelected
    ? (activeBranch?.items || []).filter((i) => (i.location || '').trim().toLowerCase() === selectedLocation.trim().toLowerCase() && i.scannedQty === i.systemQty).length
    : 0;

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
                className="mx-auto w-full max-w-md overflow-hidden rounded-xl bg-slate-900 border-2 border-slate-700 aspect-video flex items-center justify-center relative shadow-inner"
              >
                <video
                  ref={videoRef}
                  playsInline={true}
                  muted={true}
                  autoPlay={true}
                  className="w-full h-full object-cover"
                />
                
                {/* Visual Scanning Reticle & Animated Laser Line */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[82%] h-[68%] border-2 border-emerald-400/80 rounded-xl relative shadow-[0_0_20px_rgba(52,211,153,0.25)] overflow-hidden">
                    {/* Laser line animation */}
                    <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_#34d399] animate-[bounce_2s_infinite]" />
                    {/* Corner brackets */}
                    <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-emerald-400" />
                    <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-emerald-400" />
                    <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-emerald-400" />
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-emerald-400" />
                  </div>
                </div>

                {/* Torch toggle button */}
                <button
                  type="button"
                  onClick={handleToggleTorch}
                  className={`absolute bottom-3 right-3 p-2.5 rounded-full border shadow-md transition z-10 ${
                    torchEnabled 
                      ? 'bg-amber-400 text-amber-950 border-amber-500 shadow-amber-400/30' 
                      : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-700'
                  }`}
                  title="เปิด/ปิด ไฟฉาย"
                >
                  {torchEnabled ? <ZapOff className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                </button>
              </div>

              {cameraError && (
                <div className="mt-3 p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-300 text-xs font-semibold text-left flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
              )}

              <p className="text-[11px] text-slate-300 mt-3 font-medium">
                หันกล้องไปที่ <strong>QR Code ลังสินค้า</strong> หรือ <strong>บาร์โค้ด SKU</strong> เพื่อสแกนตรวจนับต่อเนื่อง
              </p>
            </div>
          )}

          {/* BACKUP PHOTO UPLOADER & CAMERA SELECTOR */}
          <div className="p-3.5 bg-slate-50 flex flex-col items-center justify-center gap-3 border-t border-slate-100">
            {cameraActive && cameras.length > 1 && (
              <div className="w-full max-w-xs text-left">
                <span className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">
                  เลือกเลนส์กล้อง ({cameras.length}):
                </span>
                <select
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  className="w-full text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-xl px-3 py-2 outline-hidden focus:ring-2 focus:ring-blue-100"
                >
                  {cameras.map((cam, i) => (
                    <option key={cam.deviceId || `cam-${i}`} value={cam.deviceId}>
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
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Box className="w-4.5 h-4.5 text-amber-500" />
              <span>ตำแหน่งลังสินค้า (Box QR Location):</span>
            </span>
            {hasBoxSelected && (
              <button
                type="button"
                onClick={() => setSelectedLocation('')}
                className="text-xs text-amber-600 hover:text-amber-700 font-black flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>เปลี่ยนลัง</span>
              </button>
            )}
            {isViewingAll && (
              <button
                type="button"
                onClick={() => setSelectedLocation('')}
                className="text-xs text-blue-600 hover:underline font-extrabold"
              >
                กลับไปโหมดระบุลัง
              </button>
            )}
          </div>

          {hasBoxSelected ? (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 border-2 border-amber-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-amber-400 border border-amber-300 flex items-center justify-center text-2xl shadow-inner shrink-0">
                  📦
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-950/90 bg-amber-400/80 px-2 py-0.5 rounded">
                      ลังที่กำลังตรวจนับ
                    </span>
                    <span className="text-xs font-bold text-amber-950">
                      (พบ {totalItemsInThisBox} รายการ • ครบแล้ว {matchedItemsInThisBox}/{totalItemsInThisBox})
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black font-mono break-all text-slate-950 drop-shadow-2xs mt-0.5">
                    {selectedLocation}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedLocation('');
                  if (soundEnabled) playScanBeep('box');
                  showToastNotice('📦 เคลียร์ลังเรียบร้อยแล้ว กรุณาสแกน QR ลังถัดไปค่ะ', 'box', 3000);
                }}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-black bg-slate-950 text-white hover:bg-slate-800 rounded-xl shadow-md transition shrink-0 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
              >
                <RefreshCw className="w-4 h-4" />
                <span>สแกนลังใหม่ / เลือกลังอื่น</span>
              </button>
            </div>
          ) : isViewingAll ? (
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📋</span>
                <div>
                  <p className="text-xs font-black text-blue-900">กำลังแสดงสินค้าทั้งหมดในสาขา</p>
                  <p className="text-[10px] text-blue-700">แนะนำให้สแกน QR ลังสินค้าเพื่อความแม่นยำในการนับทีละลัง</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLocation('')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shrink-0"
              >
                สแกนตามลัง
              </button>
            </div>
          ) : (
            <div className="bg-amber-50/70 border-2 border-dashed border-amber-300 p-4 sm:p-5 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto text-2xl shadow-inner">
                📦
              </div>
              <div>
                <p className="text-sm font-black text-amber-950">
                  กรุณาสแกน QR Code ลังสินค้า (เช่น SD-1-40) เพื่อเริ่มตรวจนับ
                </p>
                <p className="text-xs text-amber-800/80 mt-1">
                  เมื่อสแกนลังสำเร็จ ระบบจะกรองเฉพาะ SKU ที่บรรจุอยู่ในลังนั้นให้ทันที
                </p>
              </div>
              
              {/* Shortcut Bins list */}
              {availableLocations.length > 0 && (
                <div className="pt-3 border-t border-amber-200/80">
                  <p className="text-[10px] font-black text-amber-900/70 text-left mb-2 uppercase tracking-wide">
                    หรือแตะเลือกลังสินค้าด้านล่างนี้ได้โดยตรง:
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                    {availableLocations.map((loc) => {
                      const countInLoc = (activeBranch?.items || []).filter(i => (i.location || '').trim().toLowerCase() === loc.trim().toLowerCase()).length;
                      return (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => {
                            setSelectedLocation(loc);
                            if (soundEnabled) playScanBeep('box');
                            showToastNotice(`📦 เลือกลัง "${loc}" สำเร็จ! (${countInLoc} รายการ)`, 'box', 3000);
                          }}
                          className="px-3 py-2 rounded-xl bg-white border border-amber-300 text-slate-800 text-xs font-black hover:border-amber-500 hover:bg-amber-100/60 transition flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
                        >
                          <span className="text-base">📦</span>
                          <span>{loc}</span>
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-full">
                            {countInLoc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLocation('ALL')}
                  className="text-xs text-slate-500 hover:text-slate-700 underline font-semibold"
                >
                  หรือคลิกที่นี่เพื่อแสดงสินค้าทั้งหมดในสาขานี้โดยไม่จำกัดลัง
                </button>
              </div>
            </div>
          )}
        </div>

        {locationNotice && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-black flex items-start sm:items-center gap-2.5 shadow-md animate-bounce border-2 ${
              locationNotice.type === 'error'
                ? 'bg-rose-50 border-rose-400 text-rose-900 shadow-rose-100'
                : locationNotice.type === 'warning'
                ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-amber-100'
                : locationNotice.type === 'box'
                ? 'bg-amber-100 border-amber-500 text-amber-950 shadow-amber-200'
                : 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-emerald-100'
            }`}
          >
            {locationNotice.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
            ) : locationNotice.type === 'warning' ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            ) : locationNotice.type === 'box' ? (
              <Box className="w-5 h-5 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
            )}
            <span className="leading-snug flex-1">{locationNotice.message}</span>
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

        {/* 5. LIVE PRODUCT LIST - STRICT BOX FILTER WITH MATCH HIGHLIGHT */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row gap-2.5 justify-between sm:items-center">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-emerald-500" />
              <div>
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                  {hasBoxSelected 
                    ? `สินค้าในลัง "${selectedLocation}"` 
                    : isViewingAll
                    ? 'รายการสินค้าทั้งหมดในสาขา'
                    : 'รายการสินค้าในลัง'} 
                  ({filteredItemsToView.length} รายการ)
                </span>
                {hasBoxSelected && (
                  <span className="text-[10px] text-slate-500 font-medium">
                    นับเสร็จแล้ว {matchedItemsInThisBox}/{totalItemsInThisBox} รายการ
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="🔍 ค้นหาสินค้าด่วน..."
                value={skuSearchQuery}
                onChange={(e) => setSkuSearchQuery(e.target.value)}
                className="w-full sm:w-44 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-base md:text-xs font-semibold text-slate-700 focus:outline-none"
              />
              {hasBoxSelected && (
                <button
                  type="button"
                  onClick={() => setSelectedLocation('')}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition shrink-0 flex items-center gap-1 border border-slate-200 cursor-pointer"
                  title="สลับไปนับลังอื่น"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>สลับลัง</span>
                </button>
              )}
            </div>
          </div>

          {/* Minimal Mobile Product List - Clean SKU, 0/1 Count, Large Thumb +/- Buttons, and MATCH Highlight */}
          <div className="p-3 sm:p-4 space-y-2.5">
            {!hasBoxSelected && !isViewingAll ? (
              <div className="p-10 text-center text-slate-500 bg-amber-50/40 rounded-xl border border-dashed border-amber-200 space-y-2">
                <Box className="w-10 h-10 text-amber-400 mx-auto" />
                <p className="text-xs font-black text-slate-800">
                  กรุณาสแกน QR Code ลังสินค้า (เช่น SD-1-40) หรือเลือกลังด้านบน
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  ระบบจะเปิดตารางและแสดงเฉพาะรายการสินค้า SKU ที่อยู่ในลังนั้นทันทีค่ะ
                </p>
              </div>
            ) : filteredItemsToView.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Box className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <span className="font-bold">ไม่พบสินค้าในรหัสลังหรือคำค้นหานี้</span>
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
