import ExcelJS from 'exceljs';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  isNumeric?: boolean;
}

export interface ExcelMetaItem {
  label: string;
  value: string | number;
}

export interface ExportToExcelOptions {
  fileName: string;
  reportTitle: string;
  scopeName?: string;
  metaItems?: ExcelMetaItem[];
  columns: ExcelColumn[];
  data: Record<string, any>[];
  summaryRow?: Record<string, any>;
}

/**
 * Modern, attractive branded Excel (.xlsx) export engine
 * Generates beautifully styled RTL Excel sheets with Royal Rose branding,
 * zebra-striping, KPI summary cards, status badges, and auto-sized columns.
 */
export async function exportToModernExcel({
  fileName,
  reportTitle,
  scopeName = 'جميع الوحدات التشغيلية',
  metaItems = [],
  columns,
  data,
  summaryRow,
}: ExportToExcelOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Royal Rose Inventory ERP';
  workbook.lastModifiedBy = 'Royal Rose Inventory ERP';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheetName = reportTitle.slice(0, 30).replace(/[*?:/\\\[\]]/g, ' ') || 'التقرير';
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ rightToLeft: true, showGridLines: true } as any],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  const totalCols = Math.max(columns.length, 6);

  // 1. Top Breather
  worksheet.addRow([]);
  worksheet.getRow(1).height = 10;

  // 2. Organization Header Banner
  const brandRow = worksheet.addRow(['فندق  Royal Resort — نظام إدارة ومراقبة المخزون التشغيلي (Royal Inventory ERP)']);
  brandRow.height = 34;
  worksheet.mergeCells(2, 1, 2, totalCols);
  const brandCell = worksheet.getCell(2, 1);
  brandCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F2B5C' } // Royal Deep Navy
  };
  brandCell.font = {
    name: 'Segoe UI',
    size: 14,
    bold: true,
    color: { argb: 'FFFFFFFF' }
  };
  brandCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // 3. Report Title Banner
  const titleRow = worksheet.addRow([`📋 ${reportTitle}`]);
  titleRow.height = 28;
  worksheet.mergeCells(3, 1, 3, totalCols);
  const titleCell = worksheet.getCell(3, 1);
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' } // Royal Blue
  };
  titleCell.font = {
    name: 'Segoe UI',
    size: 12,
    bold: true,
    color: { argb: 'FFFFFFFF' }
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // 4. Metadata & Info Card
  worksheet.addRow([]);
  worksheet.getRow(4).height = 8;

  const nowFormatted = new Date().toLocaleString('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true
  });

  const defaultMeta: ExcelMetaItem[] = [
    { label: 'تاريخ وتوقيت التصدير', value: nowFormatted },
    { label: 'نطاق المستودع / الوحدة', value: scopeName },
    { label: 'إجمالي السجلات', value: `${data.length.toLocaleString()} سجل` },
    ...metaItems
  ];

  // Render metadata across 2-column key/value cells
  const metaStartRow = 5;
  const metaRow = worksheet.addRow([]);
  metaRow.height = 24;

  // Merge metadata nicely across columns
  const metaChunks = defaultMeta.slice(0, 4);
  const colSpan = Math.floor(totalCols / metaChunks.length);

  metaChunks.forEach((item, index) => {
    const startCol = index * colSpan + 1;
    const endCol = index === metaChunks.length - 1 ? totalCols : (index + 1) * colSpan;

    worksheet.mergeCells(metaStartRow, startCol, metaStartRow, endCol);
    const cell = worksheet.getCell(metaStartRow, startCol);
    cell.value = `${item.label}: ${item.value}`;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' } // Light Slate
    };
    cell.font = {
      name: 'Segoe UI',
      size: 9.5,
      bold: true,
      color: { argb: 'FF334155' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
  });

  worksheet.addRow([]);
  worksheet.getRow(6).height = 10;

  // 5. Table Header Row
  const headerRowNumber = 7;
  const headerRowValues = columns.map(c => c.header);
  const headerRow = worksheet.addRow(headerRowValues);
  headerRow.height = 28;

  columns.forEach((col, idx) => {
    const colNumber = idx + 1;
    const cell = worksheet.getCell(headerRowNumber, colNumber);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1D4ED8' } // Primary Header Blue
    };
    cell.font = {
      name: 'Segoe UI',
      size: 10.5,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = {
      horizontal: col.align || (col.isNumeric ? 'center' : 'right'),
      vertical: 'middle'
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF1E3A8A' } },
      bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
      left: { style: 'thin', color: { argb: 'FF93C5FD' } },
      right: { style: 'thin', color: { argb: 'FF93C5FD' } },
    };
  });

  // 6. Data Rows
  let currentRowIndex = headerRowNumber + 1;

  data.forEach((rowObj, rowIdx) => {
    const isEven = rowIdx % 2 === 0;
    const rowValues = columns.map(col => {
      const val = rowObj[col.key];
      return val !== undefined && val !== null ? val : '—';
    });

    const dataRow = worksheet.addRow(rowValues);
    dataRow.height = 22;

    columns.forEach((col, colIdx) => {
      const colNumber = colIdx + 1;
      const cell = worksheet.getCell(currentRowIndex, colNumber);
      const rawVal = String(cell.value || '');

      // Base zebra background
      let bgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
      let fontColor = 'FF1E293B';
      let fontBold = false;
      let borderColor = 'FFE2E8F0';

      // Smart status pill styling
      if (rawVal.includes('نافذ') || rawVal.includes('out_of_stock') || rawVal.includes('تالف') || rawVal.includes('استبعاد')) {
        bgColor = 'FFFEE2E2'; // Soft Red
        fontColor = 'FF991B1B';
        fontBold = true;
        borderColor = 'FFFCA5A5';
      } else if (rawVal.includes('وشيك') || rawVal.includes('تحذير') || rawVal.includes('warning') || rawVal.includes('معلق')) {
        bgColor = 'FFFEF3C7'; // Soft Amber
        fontColor = 'FF92400E';
        fontBold = true;
        borderColor = 'FFFCD34D';
      } else if (rawVal.includes('متوفر') || rawVal.includes('مكتمل') || rawVal.includes('سليم') || rawVal.includes('مقبول')) {
        bgColor = 'FFDCFCE7'; // Soft Emerald
        fontColor = 'FF166534';
        fontBold = true;
        borderColor = 'FF86EFAC';
      }

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor }
      };

      cell.font = {
        name: 'Segoe UI',
        size: 9.5,
        bold: fontBold,
        color: { argb: fontColor }
      };

      cell.alignment = {
        horizontal: col.align || (col.isNumeric ? 'center' : 'right'),
        vertical: 'middle'
      };

      cell.border = {
        top: { style: 'thin', color: { argb: borderColor } },
        bottom: { style: 'thin', color: { argb: borderColor } },
        left: { style: 'thin', color: { argb: borderColor } },
        right: { style: 'thin', color: { argb: borderColor } },
      };

      if (col.isNumeric && typeof cell.value === 'number') {
        cell.numFmt = '#,##0.##';
      }
    });

    currentRowIndex++;
  });

  // 7. Summary Row (Optional)
  if (summaryRow) {
    const summaryValues = columns.map(c => summaryRow[c.key] ?? '');
    const sRow = worksheet.addRow(summaryValues);
    sRow.height = 24;

    columns.forEach((col, cIdx) => {
      const cell = worksheet.getCell(currentRowIndex, cIdx + 1);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' }
      };
      cell.font = {
        name: 'Segoe UI',
        size: 10,
        bold: true,
        color: { argb: 'FF0F172A' }
      };
      cell.alignment = {
        horizontal: col.align || (col.isNumeric ? 'center' : 'right'),
        vertical: 'middle'
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF475569' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });
    currentRowIndex++;
  }

  // 8. Footer Note
  worksheet.addRow([]);
  currentRowIndex++;
  worksheet.mergeCells(currentRowIndex, 1, currentRowIndex, totalCols);
  const footerCell = worksheet.getCell(currentRowIndex, 1);
  footerCell.value = 'تم استخراج هذا التقرير آلياً عبر نظام رويال روز للمخزون • سري وللاستخدام الإداري والتشغيلي الداخلي فقط';
  footerCell.font = {
    name: 'Segoe UI',
    size: 8.5,
    italic: true,
    color: { argb: 'FF94A3B8' }
  };
  footerCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // 9. Auto-fit column widths with padding
  columns.forEach((col, idx) => {
    let maxLen = col.header.length;
    data.forEach(row => {
      const cellContent = String(row[col.key] || '');
      if (cellContent.length > maxLen) {
        maxLen = cellContent.length;
      }
    });
    const colNumber = idx + 1;
    worksheet.getColumn(colNumber).width = Math.min(Math.max(maxLen + 4, col.width || 12), 48);
  });

  // 10. Generate Buffer & Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const cleanFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  link.setAttribute('download', cleanFileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
