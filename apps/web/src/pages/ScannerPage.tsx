import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api/client.js';
import { useToast } from '../context/ToastContext.js';
import { QrCode, Search, Zap, Camera, CameraOff, RefreshCw, AlertCircle, CheckCircle2, Video } from 'lucide-react';

type CameraState = 'IDLE' | 'REQUESTING' | 'ACTIVE' | 'DENIED' | 'UNAVAILABLE';

export const ScannerPage: React.FC = () => {
  const [code, setCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [cameraState, setCameraState] = useState<CameraState>('IDLE');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);

  const navigate = useNavigate();
  const { addToast } = useToast();

  // Stop camera tracks and cancel scan loop
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraState('IDLE');
  }, []);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleLookup = useCallback(
    async (lookupCode: string) => {
      if (!lookupCode.trim()) return;
      setIsSearching(true);
      try {
        const clean = lookupCode.replace(/^pos:\/\/t\//, '').trim();
        const res = await api.get<any>(`/scan/lookup?code=${encodeURIComponent(clean)}`);
        stopCamera();
        navigate(`/scan/result/${res.item.itemCode}`);
      } catch (err: any) {
        addToast(err.message || 'Item barcode not found in stock catalog', 'error');
        setScannedCode(null);
      } finally {
        setIsSearching(false);
      }
    },
    [navigate, addToast, stopCamera]
  );

  // Initialize BarcodeDetector if available
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const formats = ['qr_code', 'code_128', 'code_39', 'ean_13', 'upc_a', 'data_matrix'];
        detectorRef.current = new (window as any).BarcodeDetector({ formats });
      } catch {
        detectorRef.current = new (window as any).BarcodeDetector();
      }
    }
  }, []);

  // Frame scanner detection loop
  const startScanLoop = useCallback(() => {
    const scanFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      if (detectorRef.current) {
        try {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            const detectedValue = barcodes[0].rawValue.trim();
            if (detectedValue) {
              setScannedCode(detectedValue);
              if (navigator.vibrate) {
                navigator.vibrate(100);
              }
              handleLookup(detectedValue);
              return; // Stop loop upon successful detection
            }
          }
        } catch {
          // Ignore intermittent frame decode errors
        }
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [handleLookup]);

  // Explicit user-triggered camera start
  const startCamera = async () => {
    stopCamera();
    setCameraState('REQUESTING');
    setCameraError(null);
    setScannedCode(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState('UNAVAILABLE');
      setCameraError('Camera API is not supported on this browser/device.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('autoplay', 'true');
        videoRef.current.setAttribute('muted', 'true');
        await videoRef.current.play().catch(() => {});
      }

      setCameraState('ACTIVE');
      startScanLoop();
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraState('DENIED');
        setCameraError('Camera access denied. Please grant camera permission in your browser.');
      } else {
        setCameraState('UNAVAILABLE');
        setCameraError(err.message || 'Unable to access rear camera device.');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLookup(code);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pt-2 sm:pt-6 px-1 sm:px-0">
      {/* Header Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 mb-1">
          <QrCode className="w-7 h-7 sm:w-8 sm:h-8 animate-pulse" />
        </div>
        <h1 className="text-lg sm:text-xl font-serif font-bold text-slate-900">
          Rapid Jewellery Tag Scanner
        </h1>
        <p className="text-xs text-slate-500">
          Live Smartphone Camera & USB 2D Barcode Scanner Supported
        </p>
      </div>

      {/* Camera Live Scanner Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-amber-600" />
            <span>Rear Camera Scanner</span>
          </h2>
          {cameraState === 'ACTIVE' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 animate-pulse">
              ● Camera Active
            </span>
          )}
        </div>

        {/* Camera Viewport / States */}
        {cameraState === 'IDLE' && (
          <div className="border-2 border-dashed border-slate-200 bg-slate-50 rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Scan via Phone / Tablet Camera</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Uses device rear camera to scan 2-inch jewellery tags & micro-QRs
              </p>
            </div>
            <button
              type="button"
              onClick={startCamera}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-2 mx-auto shadow-sm active:scale-95 transition-all"
            >
              <Video className="w-4 h-4 text-amber-400" />
              <span>Start Camera</span>
            </button>
          </div>
        )}

        {cameraState === 'REQUESTING' && (
          <div className="border border-slate-200 bg-slate-50 rounded-xl p-8 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-800">Requesting camera permission...</p>
            <p className="text-[11px] text-slate-500">Please tap "Allow" on your device prompt</p>
          </div>
        )}

        {cameraState === 'ACTIVE' && (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video sm:aspect-4/3 max-h-72 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Overlay & Laser Line */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
                <div className="w-48 h-32 sm:w-56 sm:h-36 border-2 border-amber-400/80 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  {/* Laser line animation */}
                  <div className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-bounce top-1/2" />
                  <div className="absolute top-1 left-2 text-[9px] font-mono text-amber-300 font-bold bg-black/60 px-1 rounded">
                    Align Tag Inside
                  </div>
                </div>
              </div>

              {scannedCode && (
                <div className="absolute bottom-3 inset-x-3 bg-emerald-600/90 text-white text-xs font-mono font-bold py-1.5 px-3 rounded-lg text-center flex items-center justify-center gap-1.5 shadow-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Detected: {scannedCode}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Align code within red laser box for sub-300ms quote
              </span>
              <button
                type="button"
                onClick={stopCamera}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1 transition-colors"
              >
                <CameraOff className="w-3.5 h-3.5" />
                <span>Stop Camera</span>
              </button>
            </div>
          </div>
        )}

        {(cameraState === 'DENIED' || cameraState === 'UNAVAILABLE') && (
          <div className="border border-red-200 bg-red-50/70 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-bold text-red-900">
                  {cameraState === 'DENIED' ? 'Camera Permission Denied' : 'Camera Not Available'}
                </div>
                <div className="text-red-700 mt-0.5">
                  {cameraError || 'Please allow browser camera permissions or enter tag serial manually below.'}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={startCamera}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Camera Again</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Code Entry & Handheld 2D Scanner Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-md space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Enter Tag Code Manually / Handheld USB Scanner
            </label>
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. KJ-GLD-NK-001 or AH8921"
                className="w-full bg-slate-50 border-2 border-amber-400 rounded-xl pl-11 pr-4 py-3 font-mono text-xs sm:text-sm font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSearching || !code.trim()}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            <span>{isSearching ? 'Calculating Sub-300ms Estimate...' : 'Get Live Showroom Quote'}</span>
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
            Quick Demo Catalog Shortcuts:
          </span>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {['KJ-GLD-NK-001', 'KJ-GLD-BG-002', 'KJ-GLD-RG-003', 'KJ-SLV-UT-004'].map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => {
                  setCode(sc);
                  handleLookup(sc);
                }}
                className="px-2 sm:px-2.5 py-1 bg-slate-100 hover:bg-amber-50 hover:text-amber-900 border border-slate-200 rounded-lg text-[11px] sm:text-xs font-mono font-semibold text-slate-700 transition-colors"
              >
                {sc}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

