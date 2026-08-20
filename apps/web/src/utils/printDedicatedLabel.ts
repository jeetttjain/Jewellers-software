import { JewelleryItemSummary, LabelTemplate, DEFAULT_LABEL_CONFIG, encodeCode128B } from '@jewellery-pos/shared';

export interface PrintDedicatedOptions {
  items: (Partial<JewelleryItemSummary> & { itemCode: string })[];
  template: Partial<LabelTemplate>;
  shopName?: string;
  shopGstin?: string;
}

export function printDedicatedLabel(options: PrintDedicatedOptions) {
  const { items, template, shopName = 'KAMAL JEWELLERS', shopGstin = '' } = options;

  const widthMm = parseFloat(String(template.widthMm || '50.00')) || 50;
  const heightMm = parseFloat(String(template.heightMm || '25.00')) || 25;
  const cfg = { ...DEFAULT_LABEL_CONFIG, ...(template.config || {}) };
  const preset = template.preset || 'SMALL_RECTANGLE';

  const itemsToPrint = items.length > 0
    ? items
    : [{ itemCode: 'DEMO-JWL-TEST01', purity: '22K 916', grossWeight: '12.450', netWeight: '11.200', huid: 'AB8812', designTitle: '22K Filigree Gold Choker' }];

  const itemsHtml = itemsToPrint.map((item) => renderLabelHtml(item, preset, widthMm, heightMm, cfg, shopName, shopGstin)).join('');

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Jewellery Label Print Job</title>
        <style>
          @page {
            size: ${widthMm}mm ${heightMm}mm;
            margin: 0;
          }
          @media print {
            html, body {
              width: ${widthMm}mm;
              height: ${heightMm}mm;
              margin: 0;
              padding: 0;
              background: #ffffff;
            }
            .label-page {
              width: ${widthMm}mm;
              height: ${heightMm}mm;
              page-break-after: always;
              box-sizing: border-box;
              margin: 0;
              padding: 1mm;
              overflow: hidden;
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              background: #ffffff;
            }
            .label-page:last-child {
              page-break-after: avoid;
            }
          }
          body {
            margin: 0;
            padding: 0;
            font-family: system-ui, -apple-system, sans-serif;
            background: #f1f5f9;
          }
          .label-page {
            width: ${widthMm}mm;
            height: ${heightMm}mm;
            box-sizing: border-box;
            padding: 1mm;
            margin: 2mm auto;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
        </style>
      </head>
      <body>
        ${itemsHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
              setTimeout(function() {
                if (window.frameElement) {
                  window.frameElement.remove();
                }
              }, 1000);
            }, 150);
          };
        </script>
      </body>
    </html>
  `);
  doc.close();
}

function generateBarcodeSvgInline(code: string): string {
  const bars = encodeCode128B(code);
  let totalModules = 0;
  for (let i = 0; i < bars.length; i++) totalModules += bars[i];

  let currentX = 0;
  let rects = '';
  let isBar = true;

  for (let i = 0; i < bars.length; i++) {
    const w = bars[i];
    if (isBar) {
      rects += `<rect x="${currentX}" y="0" width="${w}" height="30" fill="black" />`;
    }
    currentX += w;
    isBar = !isBar;
  }

  return `<svg viewBox="0 0 ${totalModules} 30" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block;">${rects}</svg>`;
}

function renderLabelHtml(
  item: Partial<JewelleryItemSummary> & { itemCode: string },
  preset: string,
  widthMm: number,
  heightMm: number,
  cfg: any,
  shopName: string,
  shopGstin: string
): string {
  const barcodeSvg = generateBarcodeSvgInline(item.itemCode);

  if (preset === 'DUMBBELL_2INCH') {
    return `
      <div class="label-page" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; font-size: ${cfg.fontSizePt || 8}pt;">
        <div style="width: 42%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; border-right: 1px dashed #ccc; padding-right: 1mm;">
          ${cfg.showShopName ? `<div style="font-weight: bold; font-size: ${cfg.shopNameFontSizePt || 8}pt; text-transform: uppercase; white-space: nowrap; overflow: hidden;">${shopName}</div>` : ''}
          <div style="font-family: monospace; font-size: 6.5pt; font-weight: bold;">
            ${cfg.showPurity ? `<div>${item.purity || '22K 916'} ${item.huid ? `<span style="font-size: 5.5pt; font-weight: normal;">H:${item.huid}</span>` : ''}</div>` : ''}
            ${cfg.showGrossWeight ? `<div>G: ${item.grossWeight || '0.000'}g</div>` : ''}
            ${cfg.showNetWeight ? `<div style="font-weight: 800;">N: ${item.netWeight || item.grossWeight || '0.000'}g</div>` : ''}
          </div>
        </div>
        <div style="width: 14%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 5pt; color: #999; text-transform: uppercase;">
          WRAP
        </div>
        <div style="width: 42%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; border-left: 1px dashed #ccc; padding-left: 1mm;">
          ${cfg.showCategory ? `<div style="font-size: 5.5pt; color: #666; white-space: nowrap; overflow: hidden; width: 100%;">${item.category || item.designTitle || 'Jewellery'}</div>` : ''}
          ${cfg.showBarcode ? `<div style="width: 90%; height: ${cfg.barcodeHeightMm || 8}mm;">${barcodeSvg}</div>` : ''}
          ${cfg.showHumanReadableBarcode ? `<div style="font-family: monospace; font-weight: bold; font-size: 6.5pt;">${item.itemCode}</div>` : ''}
        </div>
      </div>
    `;
  }

  return `
    <div class="label-page">
      ${cfg.showShopName ? `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 0.5mm;">
          <span style="font-weight: bold; font-size: ${cfg.shopNameFontSizePt || 8}pt; text-transform: uppercase; white-space: nowrap; overflow: hidden;">${shopName}</span>
          ${cfg.showPurity ? `<span style="font-family: monospace; font-weight: bold; font-size: 6.5pt;">${item.purity || '22K 916'}</span>` : ''}
        </div>
      ` : ''}
      <div style="display: flex; flex-wrap: wrap; gap: 1mm; font-family: monospace; font-size: 6pt; margin: 0.5mm 0;">
        ${cfg.showGrossWeight ? `<span>G:${item.grossWeight || '0.000'}g</span>` : ''}
        ${cfg.showNetWeight ? `<span style="font-weight: bold;">N:${item.netWeight || item.grossWeight || '0.000'}g</span>` : ''}
        ${cfg.showStoneWeight && item.stoneWeight && item.stoneWeight !== '0.000' ? `<span>S:${item.stoneWeight}g</span>` : ''}
        ${cfg.showHuid && item.huid ? `<span>H:${item.huid}</span>` : ''}
      </div>
      ${cfg.showBarcode ? `<div style="width: 100%; height: ${cfg.barcodeHeightMm || 8}mm; margin-top: auto;">${barcodeSvg}</div>` : ''}
      ${cfg.showHumanReadableBarcode ? `<div style="font-family: monospace; font-weight: bold; font-size: 6.5pt; text-align: center; margin-top: 0.5mm;">${item.itemCode}</div>` : ''}
    </div>
  `;
}
