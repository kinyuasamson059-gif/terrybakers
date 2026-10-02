const ExcelJS = require('exceljs');

async function createStyledWorkbook(sheetName, columns, rows, title = '') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Terry Bakers Bakery System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ showGridLines: true }]
    });

    let startRow = 1;

    // Optional Title Banner
    if (title) {
        worksheet.mergeCells(1, 1, 1, columns.length);
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `TERRY BAKERS — ${title.toUpperCase()}`;
        titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF8B4513' } // Saddle brown / bakery theme
        };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(1).height = 32;

        worksheet.mergeCells(2, 1, 2, columns.length);
        const subCell = worksheet.getCell('A2');
        subCell.value = `Generated on ${new Date().toLocaleString()} | Offline Local Bakery System`;
        subCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF555555' } };
        subCell.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(2).height = 18;

        startRow = 4;
    }

    // Header Row
    const headerRow = worksheet.getRow(startRow);
    columns.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = col.header;
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2C3E50' } // Executive dark slate
        };
        cell.alignment = { vertical: 'middle', horizontal: col.align || 'left' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            bottom: { style: 'medium', color: { argb: 'FF333333' } },
            right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
        };
    });
    headerRow.height = 24;

    // Data Rows
    rows.forEach((rowObj, rIdx) => {
        const row = worksheet.getRow(startRow + 1 + rIdx);
        columns.forEach((col, cIdx) => {
            const cell = row.getCell(cIdx + 1);
            let val = rowObj[col.key];
            if (val === undefined || val === null) val = '';
            cell.value = val;

            cell.font = { name: 'Calibri', size: 10 };
            cell.alignment = { vertical: 'middle', horizontal: col.align || 'left' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFEFEFEF' } },
                left: { style: 'thin', color: { argb: 'FFEFEFEF' } },
                bottom: { style: 'thin', color: { argb: 'FFEFEFEF' } },
                right: { style: 'thin', color: { argb: 'FFEFEFEF' } }
            };

            // Number formatting
            if (col.format === 'currency') {
                cell.numFmt = '#,##0.00';
            } else if (col.format === 'number') {
                cell.numFmt = '#,##0';
            } else if (col.format === 'percent') {
                cell.numFmt = '0.00%';
            }

            // Alternating zebra fill
            if (rIdx % 2 === 1) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF9FAFB' }
                };
            }
        });
        row.height = 20;
    });

    // Auto-fit column widths
    columns.forEach((col, idx) => {
        let maxLen = (col.header || '').length;
        rows.forEach(r => {
            const cellVal = String(r[col.key] || '');
            if (cellVal.length > maxLen) maxLen = cellVal.length;
        });
        worksheet.getColumn(idx + 1).width = Math.max(maxLen + 4, col.width || 12);
    });

    return workbook;
}

module.exports = {
    createStyledWorkbook
};
