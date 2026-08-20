import React, { useState } from 'react';
import { Sparkles, ZoomIn, Image as ImageIcon } from 'lucide-react';

interface ProductImageThumbnailProps {
  imageUrl?: string | null;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  onClick?: () => void;
  className?: string;
  zoomable?: boolean;
}

export const ProductImageThumbnail: React.FC<ProductImageThumbnailProps> = ({
  imageUrl,
  alt = 'Jewellery item',
  size = 'md',
  onClick,
  className = '',
  zoomable = false
}) => {
  const [hasError, setHasError] = useState(false);

  const sizeClasses: Record<string, string> = {
    xs: 'w-8 h-8 rounded',
    sm: 'w-12 h-12 rounded-lg',
    md: 'w-16 h-16 rounded-xl',
    lg: 'w-24 h-24 rounded-2xl',
    xl: 'w-36 h-36 rounded-2xl',
    full: 'w-full h-48 sm:h-56 rounded-2xl'
  };

  const selectedSizeClass = sizeClasses[size] || sizeClasses.md;
  const isClickable = !!onClick || zoomable;

  if (!imageUrl || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-100 border border-slate-200 text-slate-400 font-sans ${selectedSizeClass} ${className}`}
      >
        <Sparkles className="w-4 h-4 text-amber-500/60 mb-0.5" />
        <span className="text-[9px] font-bold tracking-tight text-slate-500 uppercase">
          {hasError ? 'Unavailable' : 'No Image'}
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`relative group overflow-hidden bg-slate-50 border border-slate-200 ${selectedSizeClass} ${
        isClickable ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        onError={() => setHasError(true)}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
      />

      {isClickable && (
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <div className="p-1.5 bg-black/60 rounded-full text-white backdrop-blur-xs">
            <ZoomIn className="w-3.5 h-3.5 text-gold-400" />
          </div>
        </div>
      )}
    </div>
  );
};
