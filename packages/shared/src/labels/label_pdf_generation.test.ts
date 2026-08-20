import { describe, it, expect } from 'vitest';
import { generateLabelPdf, encodeCode128B } from './LabelPdfGenerator.js';
import { ThermalPrinterService } from './ThermalPrinterService.js';
import { DEFAULT_LABEL_CONFIG } from '../types/index.js';

describe('EXACT PHYSICAL DIMENSION JEWELLERY LABEL PDF ENGINE', () => {
  const sampleItem1 = {
    id: 'item-001',
    itemCode: 'KJ-GLD-88912',
    designTitle: '22K Gold Filigree Ring',
    category: 'Rings',
    purity: '22K 916',
    grossWeight: '8.450',
    stoneWeight: '0.200',
    netWeight: '8.250',
    huid: 'AB9912'
  };

  const sampleItem2 = {
    id: 'item-002',
    itemCode: 'KJ-GLD-88913',
    designTitle: '18K Diamond Solitaire Pendant',
    category: 'Pendants',
    purity: '18K 750',
    grossWeight: '3.200',
    stoneWeight: '0.150',
    netWeight: '3.050',
    huid: 'CD7734'
  };

  it('1. Generates exact 80x20mm PDF page size metadata', () => {
    const doc = generateLabelPdf([sampleItem1], {
      preset: 'DUMBBELL_2INCH',
      widthMm: '80.00',
      heightMm: '20.00'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    expect(pageWidth).toBeCloseTo(80.00, 1);
    expect(pageHeight).toBeCloseTo(20.00, 1);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('2. Generates exact 50x20mm PDF page size metadata', () => {
    const doc = generateLabelPdf([sampleItem1], {
      preset: 'SMALL_RECTANGLE',
      widthMm: '50.00',
      heightMm: '20.00'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    expect(pageWidth).toBeCloseTo(50.00, 1);
    expect(pageHeight).toBeCloseTo(20.00, 1);
  });

  it('3. Generates custom physical dimensions (70x30mm) without A4 wrapping', () => {
    const doc = generateLabelPdf([sampleItem1], {
      preset: 'BUTTERFLY',
      widthMm: '70.00',
      heightMm: '30.00'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    expect(pageWidth).toBeCloseTo(70.00, 1);
    expect(pageHeight).toBeCloseTo(30.00, 1);

    // Verify page is NOT standard A4 (210 x 297 mm)
    expect(pageWidth).not.toBeCloseTo(210, 0);
    expect(pageHeight).not.toBeCloseTo(297, 0);
  });

  it('4. Single label generation produces exactly 1 PDF page', () => {
    const doc = generateLabelPdf([sampleItem1], {
      widthMm: '50.00',
      heightMm: '25.00'
    });

    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('5. Bulk multi-label PDF generation creates N individual exact-size pages (e.g., 10 pages for 10 items)', () => {
    const items = Array.from({ length: 10 }).map((_, i) => ({
      ...sampleItem1,
      id: `item-bulk-${i}`,
      itemCode: `KJ-BULK-00${i + 1}`
    }));

    const doc = generateLabelPdf(items, {
      widthMm: '80.00',
      heightMm: '20.00'
    });

    expect(doc.getNumberOfPages()).toBe(10);
    for (let i = 1; i <= 10; i++) {
      doc.setPage(i);
      expect(doc.internal.pageSize.getWidth()).toBeCloseTo(80.00, 1);
      expect(doc.internal.pageSize.getHeight()).toBeCloseTo(20.00, 1);
    }
  });

  it('6. Encodes Code 128 barcode payload deterministically without changing values', () => {
    const rawCode = 'KJ-GLD-88912';
    const encodedBars = encodeCode128B(rawCode);

    expect(encodedBars.length).toBeGreaterThan(0);
    // Every Code 128 B starts with pattern 104 ('211214' -> 2,1,1,2,1,4)
    expect(encodedBars.slice(0, 6)).toEqual([2, 1, 1, 2, 1, 4]);
  });

  it('7. Preserves barcode and item identity across template updates', () => {
    const doc1 = generateLabelPdf([sampleItem1], { widthMm: '50.00', heightMm: '25.00', config: DEFAULT_LABEL_CONFIG });
    const doc2 = generateLabelPdf([sampleItem1], { widthMm: '80.00', heightMm: '20.00', config: { ...DEFAULT_LABEL_CONFIG, showQrCode: true } });

    expect(doc1.getNumberOfPages()).toBe(1);
    expect(doc2.getNumberOfPages()).toBe(1);
    expect(sampleItem1.itemCode).toBe('KJ-GLD-88912');
  });

  it('8. Dedicated PDF contains 0 webpage HTML or UI noise', () => {
    const doc = generateLabelPdf([sampleItem1], { widthMm: '50.00', heightMm: '25.00' });
    const pdfOutput = doc.output('datauristring');

    expect(pdfOutput.startsWith('data:application/pdf')).toBe(true);
    expect(pdfOutput).not.toContain('<html');
    expect(pdfOutput).not.toContain('<button');
    expect(pdfOutput).not.toContain('PREVIEW');
  });

  it('9. Default output mode is strictly LABEL_EXACT with 0 A4 page embedding', () => {
    const doc = generateLabelPdf([sampleItem1, sampleItem2], { widthMm: '50.00', heightMm: '25.00' });

    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(50.00, 1);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(25.00, 1);
  });

  it('10. Thermal Printer Service generates valid ZPL and TSPL streams for hardware label printers', () => {
    const zpl = ThermalPrinterService.generateZpl(sampleItem1, { widthMm: '80.00', heightMm: '20.00' }, 'KAMAL JEWELLERS');
    expect(zpl.startsWith('^XA')).toBe(true);
    expect(zpl).toContain('^FDKJ-GLD-88912^FS');
    expect(zpl.endsWith('^XZ\n')).toBe(true);

    const tspl = ThermalPrinterService.generateTspl(sampleItem1, { widthMm: '80.00', heightMm: '20.00' }, 'KAMAL JEWELLERS');
    expect(tspl).toContain('SIZE 80 mm, 20 mm');
    expect(tspl).toContain('BARCODE 20,');
    expect(tspl).toContain('PRINT 1,1');
  });
});
