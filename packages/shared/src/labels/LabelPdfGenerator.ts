import { jsPDF } from 'jspdf';
import { JewelleryItemSummary, LabelTemplate, LabelTemplateConfig, DEFAULT_LABEL_CONFIG } from '../types/index.js';
import { PurityKarat } from '../enums/index.js';

export interface LabelPdfOptions {
  pageFormat?: 'LABEL_EXACT' | 'A4_SHEET';
  shopName?: string;
  shopGstin?: string;
  shopPhone?: string;
}

/**
 * Pure TypeScript Code 128 B barcode pattern encoder.
 * Maps ASCII characters (32..126) to 11-module bar/space pattern strings.
 */
const CODE128_B_PATTERNS: { [key: number]: string } = {
  0: '212222', 1: '222122', 2: '222221', 3: '121223', 4: '121322', 5: '131222', 6: '122213', 7: '122312', 8: '132212', 9: '221213',
  10: '221312', 11: '231212', 12: '112232', 13: '122132', 14: '122231', 15: '113222', 16: '123122', 17: '123221', 18: '223211', 19: '221132',
  20: '221231', 21: '213212', 22: '223112', 23: '312131', 24: '311222', 25: '321122', 26: '321221', 27: '312212', 28: '322112', 29: '322211',
  30: '212123', 31: '212321', 32: '232121', 33: '111323', 34: '131123', 35: '131321', 36: '112313', 37: '132113', 38: '132311', 39: '211313',
  40: '231113', 41: '231311', 42: '112133', 43: '112331', 44: '132131', 45: '113123', 46: '113321', 47: '133121', 48: '313121', 49: '211331',
  50: '231131', 51: '213113', 52: '213311', 53: '213131', 54: '311123', 55: '311321', 56: '331121', 57: '312113', 58: '312311', 59: '332111',
  60: '314111', 61: '221411', 62: '431111', 63: '111224', 64: '111422', 65: '121124', 66: '121421', 67: '141122', 68: '141221', 69: '112214',
  70: '112412', 71: '122114', 72: '122411', 73: '142112', 74: '142211', 75: '241211', 76: '221114', 77: '413111', 78: '241112', 79: '134111',
  80: '111242', 81: '121142', 82: '121241', 83: '114212', 84: '124112', 85: '124211', 86: '411212', 87: '421112', 88: '421211', 89: '212141',
  90: '214121', 91: '412121', 92: '111143', 93: '111341', 94: '131141', 95: '114113', 96: '114311', 97: '411113', 98: '411311', 99: '113141',
  100: '114131', 101: '311141', 102: '411131', 103: '211412', 104: '211214', 105: '211232'
};

const START_CODE_B = 104;
const STOP_CODE = '2331112';

export function encodeCode128B(text: string): number[] {
  const bars: number[] = [];

  const addPattern = (patStr: string) => {
    if (!patStr) return;
    for (let i = 0; i < patStr.length; i++) {
      const ch = patStr.charAt(i);
      if (ch) bars.push(parseInt(ch, 10));
    }
  };

  // Start B
  addPattern(CODE128_B_PATTERNS[START_CODE_B]!);
  let checksum = START_CODE_B;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    const patIdx = code >= 0 && code <= 95 ? code : 31;
    addPattern(CODE128_B_PATTERNS[patIdx]!);
    checksum += patIdx * (i + 1);
  }

  const checkCode = checksum % 103;
  addPattern(CODE128_B_PATTERNS[checkCode]!);
  addPattern(STOP_CODE);

  return bars;
}

/**
 * Generates exact-size PDF document for Jewellery Labels.
 */
export function generateLabelPdf(
  items: (Partial<JewelleryItemSummary> & { itemCode: string })[],
  template: Partial<LabelTemplate> & { widthMm?: string | number; heightMm?: string | number; config?: Partial<LabelTemplateConfig> } = {},
  options: LabelPdfOptions = {}
): jsPDF {
  const widthStr = String(template.widthMm ?? '50.00');
  const heightStr = String(template.heightMm ?? '25.00');

  const width = parseFloat(widthStr) || 50;
  const height = parseFloat(heightStr) || 25;

  const cfg: LabelTemplateConfig = {
    ...DEFAULT_LABEL_CONFIG,
    ...(template.config || {})
  };

  const shopName = options.shopName || 'KAMAL JEWELLERS';
  const shopGstin = options.shopGstin || '27AAAAA0000A1Z5';

  const isLandscape = width > height;

  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [width, height]
  });

  const fallbackItem: Partial<JewelleryItemSummary> & { itemCode: string } = {
    itemCode: 'DEMO-JWL-TEST01',
    purity: PurityKarat.K22,
    grossWeight: '12.450',
    netWeight: '11.200',
    huid: 'AB8812',
    designTitle: '22K Filigree Gold Choker'
  };

  const itemList = items.length === 0 ? [fallbackItem] : items;

  itemList.forEach((item, index) => {
    if (index > 0) {
      doc.addPage([width, height], isLandscape ? 'landscape' : 'portrait');
    }

    renderSingleLabel(doc, item, template.preset || 'SMALL_RECTANGLE', width, height, cfg, shopName, shopGstin);
  });

  return doc;
}

function renderSingleLabel(
  doc: jsPDF,
  item: Partial<JewelleryItemSummary> & { itemCode: string },
  preset: string,
  widthMm: number,
  heightMm: number,
  cfg: LabelTemplateConfig,
  shopName: string,
  shopGstin: string
) {
  doc.setLineWidth(0.1);
  doc.setTextColor(0, 0, 0);

  const margins = cfg.marginsMm || { top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 };

  const isDumbbell = preset === 'DUMBBELL_2INCH';
  const isButterfly = preset === 'BUTTERFLY';

  if (isDumbbell) {
    // 3-Section Dumbbell Tag: Left Wing (40%), Center Tail (20%), Right Wing (40%)
    const leftWidth = widthMm * 0.4;
    const centerWidth = widthMm * 0.2;
    const rightWidth = widthMm * 0.4;

    // Left Wing (Details)
    let y = 3;
    if (cfg.showShopName) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(Math.min(cfg.shopNameFontSizePt, 8));
      doc.text(shopName.substring(0, 16), 2, y);
      y += 3;
    }
    if (cfg.showGstin && shopGstin) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.text(`GST: ${shopGstin}`, 2, y);
      y += 2.5;
    }

    doc.setFontSize(6);
    if (cfg.showPurity) {
      doc.setFont('helvetica', 'bold');
      doc.text(item.purity || '22K 916', 2, y);
      if (cfg.showHuid && item.huid) {
        doc.setFont('helvetica', 'normal');
        doc.text(`H: ${item.huid}`, leftWidth - 12, y);
      }
      y += 2.8;
    }

    doc.setFont('helvetica', 'normal');
    if (cfg.showGrossWeight) {
      doc.text(`G: ${item.grossWeight || '0.000'}g`, 2, y);
      y += 2.5;
    }
    if (cfg.showNetWeight) {
      doc.setFont('helvetica', 'bold');
      doc.text(`N: ${item.netWeight || item.grossWeight || '0.000'}g`, 2, y);
    }

    // Center Fold Line Indicators
    doc.setDrawColor(200, 200, 200);
    doc.line(leftWidth, 0, leftWidth, heightMm);
    doc.line(leftWidth + centerWidth, 0, leftWidth + centerWidth, heightMm);

    // Right Wing (Barcode & Identity)
    const rightX = leftWidth + centerWidth;
    let rY = 3;

    if (cfg.showCategory) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.text((item.category || item.designTitle || 'Jewellery').substring(0, 15), rightX + 2, rY);
      rY += 2.5;
    }

    if (cfg.showBarcode) {
      const barcodeWidth = rightWidth - 4;
      const barcodeHeight = Math.min(cfg.barcodeHeightMm, heightMm - rY - 4);
      drawVectorBarcode(doc, item.itemCode, rightX + 2, rY, barcodeWidth, Math.max(barcodeHeight, 5));
      rY += Math.max(barcodeHeight, 5) + 1.5;
    }

    if (cfg.showHumanReadableBarcode) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.text(item.itemCode, rightX + (rightWidth / 2), heightMm - 1.5, { align: 'center' });
    }
  } else if (isButterfly) {
    // 2-Wing Butterfly Tag (50% / 50%)
    const wingWidth = widthMm / 2;

    // Wing A (Left)
    let y = 3.5;
    if (cfg.showShopName) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(Math.min(cfg.shopNameFontSizePt, 8));
      doc.text(shopName.substring(0, 16), 2, y);
      y += 3.5;
    }

    doc.setFontSize(6.5);
    if (cfg.showPurity) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Purity: ${item.purity || '22K 916'}`, 2, y);
      y += 3;
    }
    if (cfg.showGrossWeight) {
      doc.setFont('helvetica', 'normal');
      doc.text(`Gross: ${item.grossWeight || '0.000'}g`, 2, y);
      y += 3;
    }
    if (cfg.showNetWeight) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Net: ${item.netWeight || item.grossWeight || '0.000'}g`, 2, y);
      y += 3;
    }
    if (cfg.showHuid && item.huid) {
      doc.setFont('helvetica', 'normal');
      doc.text(`HUID: ${item.huid}`, 2, y);
    }

    // Fold Line
    doc.setDrawColor(200, 200, 200);
    doc.line(wingWidth, 0, wingWidth, heightMm);

    // Wing B (Right)
    const rightX = wingWidth;
    let rY = 4;

    if (cfg.showBarcode) {
      const barcodeWidth = wingWidth - 4;
      const barcodeHeight = Math.min(cfg.barcodeHeightMm, heightMm - 10);
      drawVectorBarcode(doc, item.itemCode, rightX + 2, rY, barcodeWidth, Math.max(barcodeHeight, 6));
      rY += Math.max(barcodeHeight, 6) + 2;
    }

    if (cfg.showHumanReadableBarcode) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text(item.itemCode, rightX + (wingWidth / 2), heightMm - 2, { align: 'center' });
    }
  } else {
    // Standard Horizontal Rectangular Tag (Small / Medium / Custom WxH mm)
    const marginX = margins?.left ?? 2;
    let y = (margins?.top ?? 2) + 2;

    if (cfg.showShopName) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(Math.min(cfg.shopNameFontSizePt, 8.5));
      doc.text(shopName, marginX, y);

      if (cfg.showPurity) {
        doc.setFontSize(6.5);
        doc.text(item.purity || '22K 916', widthMm - marginX, y, { align: 'right' });
      }
      y += 3.5;
    }

    // Specs line
    doc.setFontSize(6);
    let specText = '';
    if (cfg.showGrossWeight) specText += `G: ${item.grossWeight || '0.000'}g  `;
    if (cfg.showNetWeight) specText += `N: ${item.netWeight || item.grossWeight || '0.000'}g  `;
    if (cfg.showStoneWeight && item.stoneWeight && item.stoneWeight !== '0.000') specText += `S: ${item.stoneWeight}g  `;
    if (cfg.showHuid && item.huid) specText += `H: ${item.huid}`;

    if (specText) {
      doc.setFont('helvetica', 'normal');
      doc.text(specText.trim(), marginX, y);
      y += 3.5;
    }

    if (cfg.showCategory && (item.designTitle || item.category)) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.text((item.designTitle || item.category || '').substring(0, 30), marginX, y);
      y += 3;
    }

    // Barcode Area
    if (cfg.showBarcode) {
      const availHeight = heightMm - y - (cfg.showHumanReadableBarcode ? 3.5 : 1);
      const bHeight = Math.max(Math.min(cfg.barcodeHeightMm, availHeight), 4);
      const bWidth = widthMm - (marginX * 2);
      drawVectorBarcode(doc, item.itemCode, marginX, y, bWidth, bHeight);
      y += bHeight + 1.5;
    }

    if (cfg.showHumanReadableBarcode) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text(item.itemCode, widthMm / 2, heightMm - 1.5, { align: 'center' });
    }
  }
}

/**
 * Draws pure vector Code 128 barcode rectangles onto jsPDF canvas.
 * 100% crisp at any resolution or physical printer DPI.
 */
function drawVectorBarcode(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  widthMm: number,
  heightMm: number
) {
  const patterns = encodeCode128B(text);
  let totalModules = 0;
  for (const barModule of patterns) {
    totalModules += barModule;
  }

  const moduleWidthMm = widthMm / totalModules;

  doc.setFillColor(0, 0, 0);

  let currentX = x;
  let isBar = true;

  for (const barModule of patterns) {
    const barWidth = barModule * moduleWidthMm;
    if (isBar) {
      doc.rect(currentX, y, barWidth, heightMm, 'F');
    }
    currentX += barWidth;
    isBar = !isBar;
  }
}
