import XLSX from 'xlsx-js-style';

export const exportStyledExcel = (
  data: any[],
  fileName: string,
  sheetName: string = 'Sheet1',
  numericColumns: string[] = [],
  centerColumns: string[] = [],
  currencyColumns: string[] = []
) => {
  // Convert JSON data to worksheet starting at A4
  const ws = XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.sheet_add_json(ws, data, { origin: 'A4' });

  // Get table columns count
  const tempHeaders = data.length > 0 ? Object.keys(data[0]) : [];
  const colCount = tempHeaders.length || 1;

  // Add Title on A1
  ws['A1'] = { t: 's', v: sheetName.toUpperCase() };
  
  // Add Subtitle on A2 (with download date)
  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  ws['A2'] = { t: 's', v: `Dicetak Pada: ${dateStr}` };

  // Set merges for Title and Subtitle
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }, // Merge A1 to last col
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } }  // Merge A2 to last col
  ];

  // Get range of sheet
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A4');

  // Define styles
  const titleStyle = {
    font: { name: 'Arial', sz: 14, bold: true, color: { rgb: '1E3A8A' } },
    alignment: { vertical: 'center', horizontal: 'center' }
  };

  const subtitleStyle = {
    font: { name: 'Arial', sz: 10, italic: true, color: { rgb: '475569' } },
    alignment: { vertical: 'center', horizontal: 'center' }
  };

  const headerStyle = {
    fill: { fgColor: { rgb: '1E3A8A' } }, // Dark Navy Blue
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'medium', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } }
    }
  };

  const bodyStyleDefault = {
    font: { name: 'Arial', sz: 9 },
    alignment: { vertical: 'center', horizontal: 'left' },
    border: {
      top: { style: 'thin', color: { rgb: '808080' } }, // Clearly visible grey
      bottom: { style: 'thin', color: { rgb: '808080' } },
      left: { style: 'thin', color: { rgb: '808080' } },
      right: { style: 'thin', color: { rgb: '808080' } }
    }
  };

  const bodyStyleNumeric = {
    ...bodyStyleDefault,
    alignment: { vertical: 'center', horizontal: 'right' }
  };

  const bodyStyleCenter = {
    ...bodyStyleDefault,
    alignment: { vertical: 'center', horizontal: 'center' }
  };

  // Iterate over all cells
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellRef];
      if (!cell) continue;

      if (R === 0) {
        cell.s = titleStyle;
      } else if (R === 1) {
        cell.s = subtitleStyle;
      } else if (R === 2) {
        // Empty row (A3)
      } else if (R === 3) {
        // Table Header row (row 4 in Excel)
        cell.s = headerStyle;
      } else {
        // Data rows
        const headerRef = XLSX.utils.encode_cell({ r: 3, c: C });
        const headerName = ws[headerRef]?.v ? String(ws[headerRef].v) : '';

        const isNumeric = numericColumns.includes(headerName) || currencyColumns.includes(headerName);
        const isCurrency = currencyColumns.includes(headerName);
        const isCenter = centerColumns.includes(headerName);

        if (isNumeric) {
          cell.s = bodyStyleNumeric;
          if (typeof cell.v === 'number') {
            cell.t = 'n';
            if (isCurrency) {
              cell.z = '"Rp "#,##0'; // format: Rp 1.000.000
            } else {
              cell.z = '#,##0'; // format: 1.000
            }
          }
        } else if (isCenter) {
          cell.s = bodyStyleCenter;
        } else {
          cell.s = bodyStyleDefault;
        }
      }
    }
  }

  // Adjust column widths automatically based on content length
  const colWidths = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    let maxWidth = 12; // Min width
    for (let R = range.s.r; R <= range.e.r; ++R) {
      // Exclude row 0, 1, 2 from auto-width checking to avoid merges distorting widths
      if (R < 3) continue;
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellRef];
      if (cell && cell.v) {
        const valStr = String(cell.v);
        if (valStr.length > maxWidth) {
          maxWidth = valStr.length;
        }
      }
    }
    colWidths.push({ wch: maxWidth + 3 }); // add margin
  }
  ws['!cols'] = colWidths;

  // Set row heights
  const rowHeights = [];
  for (let R = range.s.r; R <= range.e.r; ++R) {
    if (R === 0) rowHeights.push({ hpt: 30 }); // Title height
    else if (R === 1) rowHeights.push({ hpt: 20 }); // Subtitle height
    else if (R === 2) rowHeights.push({ hpt: 10 }); // Spacing height
    else if (R === 3) rowHeights.push({ hpt: 25 }); // Header height
    else rowHeights.push({ hpt: 20 }); // Body height
  }
  ws['!rows'] = rowHeights;

  // Write workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
};
