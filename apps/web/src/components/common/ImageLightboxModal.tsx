import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { ItemImage } from '@jewellery-pos/shared';

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: Array<{ url: string; label?: string } | ItemImage>;
  initialIndex?: number;
  itemTitle?: string;
  itemCode?: string;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  itemTitle,
  itemCode
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchDistance, setTouchDistance] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(initialIndex, Math.max(0, images.length - 1)));
      resetTransform();
    }
  }, [isOpen, initialIndex, images.length]);

  // Keyboard navigation & zoom
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        resetTransform();
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        handleNext();
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, images.length, currentIndex]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];
  const currentUrl = (currentImage as any)?.imageUrl || (currentImage as any)?.url || '';
  const currentLabel = (currentImage as any)?.label || 'Product Image';

  const resetTransform = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 0.5);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
    resetTransform();
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    resetTransform();
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Mouse drag / pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch gestures: Pan & Pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setTouchDistance(dist);
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistance !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const diff = dist - touchDistance;
      if (Math.abs(diff) > 10) {
        if (diff > 0) handleZoomIn();
        else handleZoomOut();
        setTouchDistance(dist);
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTouchDistance(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top Header Controls Bar */}
      <div className="flex items-center justify-between z-10 text-white">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-serif font-bold tracking-wide text-gold-400">
              {itemTitle || 'Jewellery Visual Verification'}
            </h3>
            {itemCode && (
              <span className="px-2 py-0.5 rounded bg-white/10 font-mono text-xs text-white">
                {itemCode}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {currentLabel} • {currentIndex + 1} of {images.length} • Zoom: {Math.round(scale * 100)}%
          </span>
        </div>

        {/* Toolbar Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white/10 backdrop-blur-md rounded-xl p-1 border border-white/20">
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-2 hover:bg-white/20 rounded-lg text-white transition-colors"
              title="Zoom In (+)"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-2 hover:bg-white/20 rounded-lg text-white transition-colors"
              title="Zoom Out (-)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetTransform}
              className="p-2 hover:bg-white/20 rounded-lg text-white transition-colors"
              title="Fit to Screen (0)"
              aria-label="Reset Zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 bg-white/10 hover:bg-red-500/80 rounded-xl text-white border border-white/20 transition-colors"
            title="Close Viewer (Esc)"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Interactive Zoom / Pan Viewport */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`flex-1 relative flex items-center justify-center overflow-hidden my-2 sm:my-4 ${
          scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
        }`}
      >
        {/* Previous Image Arrow */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 sm:left-4 z-20 p-3 bg-black/40 hover:bg-black/70 text-white rounded-full backdrop-blur-md border border-white/20 transition-all"
            aria-label="Previous Image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Current Image */}
        {currentUrl ? (
          <img
            src={currentUrl}
            alt={itemTitle || 'Jewellery product photo'}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }}
            className="max-h-[75vh] max-w-[85vw] object-contain rounded-lg shadow-2xl pointer-events-none"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-8 bg-white/5 rounded-2xl border border-white/10 text-slate-400">
            <ImageIcon className="w-16 h-16 mb-2 opacity-50" />
            <p className="text-sm font-medium">No Image Available</p>
          </div>
        )}

        {/* Next Image Arrow */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 sm:right-4 z-20 p-3 bg-black/40 hover:bg-black/70 text-white rounded-full backdrop-blur-md border border-white/20 transition-all"
            aria-label="Next Image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnails Carousel Switcher */}
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-3 z-10 py-2 overflow-x-auto max-w-full">
          {images.map((img, idx) => {
            const url = (img as any).imageUrl || (img as any).url || '';
            const lbl = (img as any).label || `Photo ${idx + 1}`;
            const isActive = idx === currentIndex;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setCurrentIndex(idx);
                  resetTransform();
                }}
                className={`relative rounded-lg overflow-hidden border-2 transition-all p-0.5 flex-shrink-0 ${
                  isActive ? 'border-amber-400 scale-105 shadow-md shadow-amber-500/30' : 'border-white/20 opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={url}
                  alt={lbl}
                  className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded"
                />
                <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white text-center py-0.5 truncate font-sans">
                  {lbl}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
