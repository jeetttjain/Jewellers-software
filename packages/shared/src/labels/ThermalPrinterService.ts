import { JewelleryItemSummary, LabelTemplate, DEFAULT_LABEL_CONFIG } from '../types/index.js';

export type ThermalPrinterLanguage = 'ZPL' | 'TSPL' | 'ESC_POS';

export interface ThermalPrinterDeviceConfig {
  id: string;
  name: string;
  language: ThermalPrinterLanguage;
  dpi?: number; // e.g. 203 DPI or 300 DPI
  connectionType?: 'USB' | 'NETWORK' | 'BLUETOOTH' | 'CAPACITOR_NATIVE';
  ipAddress?: string;
  port?: number;
}

export interface IThermalPrinterAdapter {
  printLabel(rawCommands: string, deviceConfig: ThermalPrinterDeviceConfig): Promise<{ success: boolean; message?: string }>;
}

export class ThermalPrinterService {
  /**
   * Generates Zebra Programming Language (ZPL II) code for Zebra thermal printers (e.g. ZD220, ZD420, GX430t).
   * 100% native hardware instructions with exact dots/mm resolution.
   */
  public static generateZpl(
    item: Partial<JewelleryItemSummary> & { itemCode: string },
    template: Partial<LabelTemplate> = {},
    shopName = 'KAMAL JEWELLERS'
  ): string {
    const widthMm = parseFloat(String(template.widthMm || '50.00')) || 50;
    const heightMm = parseFloat(String(template.heightMm || '25.00')) || 25;
    const cfg = { ...DEFAULT_LABEL_CONFIG, ...(template.config || {}) };
    const dpi = 203; // 8 dots/mm standard
    const dotsPerMm = dpi / 25.4;

    const widthDots = Math.round(widthMm * dotsPerMm);
    const heightDots = Math.round(heightMm * dotsPerMm);

    let zpl = `^XA\n`;
    zpl += `^PW${widthDots}\n`;
    zpl += `^LL${heightDots}\n`;
    zpl += `^LS0\n`;

    let yDot = 20;

    if (cfg.showShopName) {
      zpl += `^FO20,${yDot}^A0N,28,28^FD${shopName}^FS\n`;
      if (cfg.showPurity && item.purity) {
        zpl += `^FO${widthDots - 120},${yDot}^A0N,24,24^FD${item.purity}^FS\n`;
      }
      yDot += 35;
    }

    let specLine = '';
    if (cfg.showGrossWeight) specLine += `G:${item.grossWeight || '0.000'}g `;
    if (cfg.showNetWeight) specLine += `N:${item.netWeight || item.grossWeight || '0.000'}g `;
    if (cfg.showHuid && item.huid) specLine += `H:${item.huid}`;

    if (specLine) {
      zpl += `^FO20,${yDot}^A0N,22,22^FD${specLine.trim()}^FS\n`;
      yDot += 30;
    }

    if (cfg.showBarcode) {
      const barcodeHeightDots = Math.round(cfg.barcodeHeightMm * dotsPerMm);
      zpl += `^FO20,${yDot}^BCN,${barcodeHeightDots},Y,N,N^FD${item.itemCode}^FS\n`;
    }

    zpl += `^XZ\n`;
    return zpl;
  }

  /**
   * Generates TSPL code for TSC, Gprinter, and Citizen thermal printers.
   */
  public static generateTspl(
    item: Partial<JewelleryItemSummary> & { itemCode: string },
    template: Partial<LabelTemplate> = {},
    shopName = 'KAMAL JEWELLERS'
  ): string {
    const widthMm = parseFloat(String(template.widthMm || '50.00')) || 50;
    const heightMm = parseFloat(String(template.heightMm || '25.00')) || 25;
    const cfg = { ...DEFAULT_LABEL_CONFIG, ...(template.config || {}) };

    let tspl = `SIZE ${widthMm} mm, ${heightMm} mm\n`;
    tspl += `GAP 2 mm, 0 mm\n`;
    tspl += `DIRECTION 1\n`;
    tspl += `CLS\n`;

    let yDots = 20;

    if (cfg.showShopName) {
      tspl += `TEXT 20,${yDots},"3",0,1,1,"${shopName}"\n`;
      yDots += 30;
    }

    let specStr = `G:${item.grossWeight || '0.000'}g N:${item.netWeight || item.grossWeight || '0.000'}g`;
    if (cfg.showHuid && item.huid) specStr += ` H:${item.huid}`;

    tspl += `TEXT 20,${yDots},"2",0,1,1,"${specStr}"\n`;
    yDots += 30;

    if (cfg.showBarcode) {
      tspl += `BARCODE 20,${yDots},"128",${Math.round(cfg.barcodeHeightMm * 8)},1,0,2,2,"${item.itemCode}"\n`;
    }

    tspl += `PRINT 1,1\n`;
    return tspl;
  }

  /**
   * Generates batch commands for multi-item thermal print jobs.
   */
  public static generateBatchCommands(
    items: (Partial<JewelleryItemSummary> & { itemCode: string })[],
    template: Partial<LabelTemplate> = {},
    language: ThermalPrinterLanguage = 'ZPL',
    shopName = 'KAMAL JEWELLERS'
  ): string {
    return items
      .map((item) =>
        language === 'ZPL'
          ? this.generateZpl(item, template, shopName)
          : this.generateTspl(item, template, shopName)
      )
      .join('\n');
  }
}
