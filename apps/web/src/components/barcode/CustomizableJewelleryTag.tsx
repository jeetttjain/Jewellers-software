import React from 'react';
import {
  JewelleryItemSummary,
  LabelTemplateConfig,
  LabelPreset,
  DEFAULT_LABEL_CONFIG
} from '@jewellery-pos/shared';
import { BarcodeSvg } from './BarcodeSvg.js';
import { QRCodeSvg } from './QRCodeSvg.js';
import { Sparkles, ShieldCheck } from 'lucide-react';

interface CustomizableJewelleryTagProps {
  item: Partial<JewelleryItemSummary> & {
    itemCode: string;
    designTitle?: string;
    purity?: string;
    grossWeight?: string;
    stoneWeight?: string;
    netWeight?: string;
    huid?: string;
    category?: string;
  };
  config?: Partial<LabelTemplateConfig>;
  preset?: LabelPreset;
  widthMm?: string | number;
  heightMm?: string | number;
  shopName?: string;
  shopGstin?: string;
  shopPhone?: string;
  isTestPreview?: boolean;
  scale?: number;
}

export const CustomizableJewelleryTag: React.FC<CustomizableJewelleryTagProps> = ({
  item,
  config = {},
  preset = 'SMALL_RECTANGLE',
  widthMm = '50.00',
  heightMm = '25.00',
  shopName = 'KAMAL JEWELLERS',
  shopGstin = '27AAAAA0000A1Z5',
  shopPhone = '+91 98200 12345',
  isTestPreview = false,
  scale = 1
}) => {
  const cfg: LabelTemplateConfig = { ...DEFAULT_LABEL_CONFIG, ...config };

  const wMm = typeof widthMm === 'string' ? parseFloat(widthMm) || 50 : widthMm;
  const hMm = typeof heightMm === 'string' ? parseFloat(heightMm) || 25 : heightMm;

  // Approximate screen pixels from mm (at standard 96 DPI: 1mm ~= 3.78px, or high-res 4px/mm)
  const pxPerMm = 4;
  const tagWidthPx = wMm * pxPerMm;
  const tagHeightPx = hMm * pxPerMm;

  // 1. Dumbbell 2-Inch Layout (Tail Wrap for Rings & Chains)
  if (preset === 'DUMBBELL_2INCH') {
    return (
      <div
        className="label-tag dumbbell-tag relative bg-white text-slate-900 border border-slate-300 rounded-md shadow-xs overflow-hidden flex items-center print:border-none print:shadow-none print:m-0"
        style={{
          width: `${tagWidthPx * scale}px`,
          height: `${tagHeightPx * scale}px`,
          fontSize: `${cfg.fontSizePt * scale}pt`
        }}
      >
        {/* Left Wing: Branding & Weight Specs */}
        <div className="w-5/12 h-full p-1.5 flex flex-col justify-between border-r border-dashed border-slate-200 bg-amber-50/30">
          <div>
            {cfg.showShopName && (
              <div
                className="font-serif font-black tracking-tight text-amber-950 uppercase truncate leading-tight"
                style={{ fontSize: `${cfg.shopNameFontSizePt * scale * 0.9}pt` }}
              >
                {shopName}
              </div>
            )}
            {cfg.showGstin && shopGstin && (
              <div className="text-[6pt] text-slate-500 truncate">GST: {shopGstin}</div>
            )}
          </div>

          <div className="space-y-0.5 font-mono text-[7pt] font-semibold text-slate-800 leading-tight">
            {cfg.showPurity && (
              <div className="flex justify-between items-center">
                <span className="text-amber-800 font-bold">{item.purity || '22K 916'}</span>
                {cfg.showHuid && item.huid && (
                  <span className="text-[6pt] text-slate-600 bg-amber-100 px-0.5 rounded">
                    {item.huid}
                  </span>
                )}
              </div>
            )}
            {cfg.showGrossWeight && (
              <div className="flex justify-between">
                <span className="text-slate-500">G:</span>
                <span>{item.grossWeight || '0.000'}g</span>
              </div>
            )}
            {cfg.showNetWeight && (
              <div className="flex justify-between font-bold text-slate-950">
                <span className="text-slate-500">N:</span>
                <span>{item.netWeight || item.grossWeight || '0.000'}g</span>
              </div>
            )}
          </div>
        </div>

        {/* Center Narrow Tail Wrap (For looping through ring/bangle) */}
        <div className="w-2/12 h-full flex flex-col items-center justify-center bg-slate-100/80 px-0.5">
          <div className="w-full border-t border-b border-slate-300 py-1 text-center">
            <span className="text-[5pt] font-mono text-slate-400 font-bold uppercase tracking-widest rotate-90 block">
              WRAP
            </span>
          </div>
        </div>

        {/* Right Wing: Barcode / QR & Item Code Identity */}
        <div className="w-5/12 h-full p-1.5 flex flex-col justify-between items-center text-center border-l border-dashed border-slate-200">
          <div className="w-full">
            {cfg.showCategory && (
              <div className="text-[6pt] text-slate-500 truncate">{item.category || item.designTitle || 'Jewellery'}</div>
            )}
          </div>

          <div className="my-auto w-full flex flex-col items-center">
            {cfg.showBarcode && (
              <BarcodeSvg
                value={item.itemCode}
                width={70 * scale}
                height={cfg.barcodeHeightMm * 2.5 * scale}
                showText={false}
              />
            )}
            {cfg.showQrCode && (
              <QRCodeSvg
                value={item.itemCode}
                size={cfg.qrSizeMm * 2.5 * scale}
              />
            )}
          </div>

          {cfg.showHumanReadableBarcode && (
            <div className="font-mono text-[7pt] font-black text-slate-950 tracking-wider">
              {item.itemCode}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. Butterfly Dual-Wing Tag Layout
  if (preset === 'BUTTERFLY') {
    return (
      <div
        className="label-tag butterfly-tag relative bg-white text-slate-900 border border-slate-300 rounded-md shadow-xs overflow-hidden flex items-center print:border-none print:shadow-none print:m-0"
        style={{
          width: `${tagWidthPx * scale}px`,
          height: `${tagHeightPx * scale}px`,
          fontSize: `${cfg.fontSizePt * scale}pt`
        }}
      >
        {/* Wing A: Product & Hallmark Info */}
        <div className="w-1/2 h-full p-2 flex flex-col justify-between border-r border-dashed border-slate-300">
          <div>
            {cfg.showShopName && (
              <div
                className="font-serif font-black text-amber-950 uppercase truncate leading-tight"
                style={{ fontSize: `${cfg.shopNameFontSizePt * scale * 0.9}pt` }}
              >
                {shopName}
              </div>
            )}
            {cfg.showCategory && item.designTitle && (
              <div className="text-[6.5pt] font-medium text-slate-600 truncate">{item.designTitle}</div>
            )}
          </div>

          <div className="space-y-0.5 font-mono text-[7pt] font-semibold text-slate-800">
            {cfg.showPurity && <div className="text-amber-800 font-bold">{item.purity || '22K 916'}</div>}
            {cfg.showGrossWeight && <div>Gross: {item.grossWeight}g</div>}
            {cfg.showNetWeight && <div className="font-bold text-slate-950">Net: {item.netWeight || item.grossWeight}g</div>}
            {cfg.showHuid && item.huid && <div className="text-[6pt] text-slate-500">HUID: {item.huid}</div>}
          </div>
        </div>

        {/* Wing B: Scannable Barcode Identity */}
        <div className="w-1/2 h-full p-2 flex flex-col justify-between items-center text-center">
          {cfg.showItemCode && (
            <div className="text-[6.5pt] font-mono text-slate-500 font-semibold truncate w-full">
              ID: {item.itemCode}
            </div>
          )}

          <div className="my-auto flex flex-col items-center">
            {cfg.showBarcode && (
              <BarcodeSvg
                value={item.itemCode}
                width={85 * scale}
                height={cfg.barcodeHeightMm * 2.8 * scale}
                showText={false}
              />
            )}
            {cfg.showQrCode && (
              <QRCodeSvg
                value={item.itemCode}
                size={cfg.qrSizeMm * 2.8 * scale}
              />
            )}
          </div>

          {cfg.showHumanReadableBarcode && (
            <div className="font-mono text-[7pt] font-black text-slate-950 tracking-wider">
              {item.itemCode}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Standard Small/Medium Compact Horizontal Rectangular Jewellery Tag (Default)
  return (
    <div
      className="label-tag rectangular-tag relative bg-white text-slate-900 border border-slate-300 rounded-sm shadow-xs overflow-hidden flex flex-col justify-between p-1.5 print:border-none print:shadow-none print:m-0"
      style={{
        width: `${tagWidthPx * scale}px`,
        height: `${tagHeightPx * scale}px`,
        fontSize: `${cfg.fontSizePt * scale}pt`,
        paddingTop: `${(cfg.marginsMm?.top || 1.5) * pxPerMm * 0.3 * scale}px`,
        paddingRight: `${(cfg.marginsMm?.right || 1.5) * pxPerMm * 0.3 * scale}px`,
        paddingBottom: `${(cfg.marginsMm?.bottom || 1.5) * pxPerMm * 0.3 * scale}px`,
        paddingLeft: `${(cfg.marginsMm?.left || 1.5) * pxPerMm * 0.3 * scale}px`,
        textAlign: cfg.textAlignment.toLowerCase() as any
      }}
    >
      {/* Top Header: Shop Name & Details */}
      {cfg.showShopName && (
        <div className="flex items-center justify-between border-b border-slate-100 pb-0.5 leading-tight">
          <span
            className="font-serif font-black text-amber-950 uppercase tracking-tight truncate"
            style={{ fontSize: `${cfg.shopNameFontSizePt * scale * 0.9}pt` }}
          >
            {shopName}
          </span>
          {cfg.showPurity && (
            <span className="font-mono font-bold text-amber-800 text-[6.5pt] bg-amber-50 px-1 rounded">
              {item.purity || '22K 916'}
            </span>
          )}
        </div>
      )}

      {/* Middle Specs Grid */}
      <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 font-mono text-[6.5pt] text-slate-800 font-semibold my-0.5 leading-tight">
        {cfg.showGrossWeight && (
          <div className="truncate">
            <span className="text-slate-500 font-normal">G: </span>
            {item.grossWeight || '0.000'}g
          </div>
        )}
        {cfg.showNetWeight && (
          <div className="truncate font-bold text-slate-950">
            <span className="text-slate-500 font-normal">N: </span>
            {item.netWeight || item.grossWeight || '0.000'}g
          </div>
        )}
        {cfg.showStoneWeight && item.stoneWeight && item.stoneWeight !== '0.000' && (
          <div className="truncate">
            <span className="text-slate-500 font-normal">S: </span>
            {item.stoneWeight}g
          </div>
        )}
        {cfg.showHuid && item.huid && (
          <div className="truncate text-slate-600">
            <span className="text-slate-400 font-normal">H: </span>
            {item.huid}
          </div>
        )}
        {cfg.showCategory && (
          <div className="col-span-2 text-[6pt] text-slate-500 truncate font-sans">
            {item.designTitle || item.category || 'Jewellery Ornament'}
          </div>
        )}
      </div>

      {/* Bottom Barcode / QR Identity Area */}
      <div className="flex flex-col items-center justify-center pt-0.5 border-t border-slate-100">
        <div className="flex items-center justify-center gap-1 w-full">
          {cfg.showBarcode && (
            <BarcodeSvg
              value={item.itemCode}
              width={tagWidthPx * 0.7 * scale}
              height={cfg.barcodeHeightMm * 2.2 * scale}
              showText={false}
            />
          )}
          {cfg.showQrCode && (
            <QRCodeSvg
              value={item.itemCode}
              size={cfg.qrSizeMm * 2.2 * scale}
            />
          )}
        </div>

        {cfg.showHumanReadableBarcode && (
          <span className="font-mono text-[7pt] font-black text-slate-950 tracking-wider leading-none mt-0.5">
            {item.itemCode}
          </span>
        )}
      </div>

      {isTestPreview && (
        <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 font-bold text-[5pt] px-1 rounded-bl">
          PREVIEW
        </div>
      )}
    </div>
  );
};
