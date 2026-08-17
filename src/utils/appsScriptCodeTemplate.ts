/**
 * Production-ready Google Apps Script (Code.gs) template
 * Optimized for Stock Counting Engine with high-speed batch setValues()
 * and complete multi-branch Stock_Data isolation.
 */
export const RECOMMENDED_APPS_SCRIPT_CODE = `/**
 * ==============================================================================
 * STOCK COUNTING ENGINE - GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * ==============================================================================
 * รองรับการเขียนทับ/ต่อท้ายข้อมูลระดับ 2,000+ รายการต่อสาขาด้วย setValues() ความเร็วสูง
 * พร้อมระบบแยกสาขาอิสระในแท็บ Stock_Data และ Branches
 */

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var params = (e && e.parameter) ? e.parameter : {};
  var action = params.action || 'getAll';
  var targetBranchId = params.branchId || params.code || '';

  // 1. Check or create Branches sheet
  var branchSheet = ss.getSheetByName('Branches');
  if (!branchSheet) {
    branchSheet = ss.insertSheet('Branches');
    branchSheet.appendRow(['ID', 'Code', 'Name', 'Region', 'Auditor', 'Status', 'Audit Date', 'Schedule Day', 'Total Items', 'Last Updated']);
  }

  // 2. Check or create Stock_Data sheet
  var stockSheet = ss.getSheetByName('Stock_Data');
  if (!stockSheet) {
    stockSheet = ss.insertSheet('Stock_Data');
    stockSheet.appendRow(['Branch ID', 'Barcode', 'Product Name', 'System Qty', 'Scanned Qty', 'Location', 'Category', 'Audit Date', 'SKU', 'Branch Name', 'Batch ID', 'Import Date', 'Is New Item', 'Last Updated']);
  }

  // Read Branches Data
  var branchData = [];
  var branchValues = branchSheet.getDataRange().getValues();
  if (branchValues.length > 1) {
    for (var i = 1; i < branchValues.length; i++) {
      var row = branchValues[i];
      if (row[0] || row[1] || row[2]) {
        branchData.push({
          id: String(row[0] || row[1] || '').trim(),
          code: String(row[1] || row[0] || '').trim(),
          name: String(row[2] || row[1] || '').trim(),
          region: String(row[3] || 'ทั่วไป').trim(),
          assignedAuditor: String(row[4] || 'เจ้าหน้าที่ Audit').trim(),
          auditStatus: String(row[5] || 'NOT_STARTED').trim(),
          auditDate: row[6] ? (row[6] instanceof Date ? Utilities.formatDate(row[6], "GMT+7", "yyyy-MM-dd") : String(row[6])) : Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd"),
          auditScheduleDay: String(row[7] || 'OTHER').trim(),
          totalItems: Number(row[8] || 0)
        });
      }
    }
  }

  // Read Stock Data
  var stockRows = [];
  var stockValues = stockSheet.getDataRange().getValues();
  if (stockValues.length > 1) {
    for (var j = 1; j < stockValues.length; j++) {
      var sRow = stockValues[j];
      var bId = String(sRow[0] || '').trim();
      if (bId) {
        // If specific branch filter is requested in verification
        if (targetBranchId && bId.toLowerCase() !== targetBranchId.toLowerCase()) {
          continue;
        }
        stockRows.push({
          branchId: bId,
          barcode: String(sRow[1] || '').trim(),
          name: String(sRow[2] || '').trim(),
          systemQty: Number(sRow[3] || 0),
          scannedQty: Number(sRow[4] || 0),
          location: String(sRow[5] || '').trim(),
          category: String(sRow[6] || '').trim(),
          auditDate: sRow[7] ? (sRow[7] instanceof Date ? Utilities.formatDate(sRow[7], "GMT+7", "yyyy-MM-dd") : String(sRow[7])) : '',
          sku: String(sRow[8] || sRow[1] || '').trim(),
          batchId: String(sRow[10] || '').trim(),
          importDate: sRow[11] ? (sRow[11] instanceof Date ? Utilities.formatDate(sRow[11], "GMT+7", "yyyy-MM-dd") : String(sRow[11])) : '',
          isNewItem: String(sRow[12] || '').toUpperCase() === 'TRUE' || sRow[12] === true || String(sRow[12] || '').toUpperCase() === 'YES'
        });
      }
    }
  }

  var responseObj = {
    status: 'success',
    success: true,
    action: action,
    timestamp: new Date().toISOString(),
    branchesCount: branchData.length,
    stockRowsCount: stockRows.length,
    branches: branchData,
    stockData: stockRows
  };

  return ContentService.createTextOutput(JSON.stringify(responseObj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Wait up to 30 seconds for concurrent requests
    lock.waitLock(30000);
  } catch (lockErr) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      success: false,
      message: 'Server busy, please retry in a moment.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var postBody = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var data = JSON.parse(postBody);
    var action = data.action || 'importItems';

    var branchId = String(data.branchId || data.id || data.code || data.branchCode || '').trim();
    var branchCode = String(data.branchCode || data.code || data.branchId || data.id || '').trim();
    var branchName = String(data.name || data.branchName || branchCode).trim();
    var targetSheetName = data.targetSheet || data.sheetName || 'Stock_Data';

    // 1. Get or Create Sheets
    var stockSheet = ss.getSheetByName(targetSheetName) || ss.getSheetByName('Stock_Data');
    if (!stockSheet) {
      stockSheet = ss.insertSheet('Stock_Data');
      stockSheet.appendRow(['Branch ID', 'Barcode', 'Product Name', 'System Qty', 'Scanned Qty', 'Location', 'Category', 'Audit Date', 'SKU', 'Branch Name', 'Last Updated']);
    }

    var branchSheet = ss.getSheetByName('Branches');
    if (!branchSheet) {
      branchSheet = ss.insertSheet('Branches');
      branchSheet.appendRow(['ID', 'Code', 'Name', 'Region', 'Auditor', 'Status', 'Audit Date', 'Schedule Day', 'Total Items', 'Last Updated']);
    }

    var nowStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
    var todayStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");

    // --------------------------------------------------------------------------
    // ACTION: importItems / appendItems / clearBranchData
    // --------------------------------------------------------------------------
    if (action === 'importItems' || action === 'appendItems' || action === 'clearBranchData' || action === 'overwriteStockData') {
      var isFirstChunk = data.isFirstChunk !== false;
      var isOverwrite = data.mode === 'overwrite' || data.overwrite === true || action === 'clearBranchData';
      var deleteOldRows = data.deleteOldBranchRows !== false && isOverwrite && isFirstChunk;

      // Handle Row Deletion for this specific Branch
      if (deleteOldRows || action === 'clearBranchData') {
        var existingData = stockSheet.getDataRange().getValues();
        if (existingData.length > 1) {
          var preservedRows = [existingData[0]]; // Keep headers
          for (var r = 1; r < existingData.length; r++) {
            var rowBId = String(existingData[r][0] || '').trim().toLowerCase();
            // Preserve rows that do NOT match this branch
            if (rowBId !== branchId.toLowerCase() && rowBId !== branchCode.toLowerCase() && rowBId !== branchName.toLowerCase()) {
              preservedRows.push(existingData[r]);
            }
          }
          // Rewrite preserved rows
          stockSheet.clearContents();
          if (preservedRows.length > 0) {
            stockSheet.getRange(1, 1, preservedRows.length, preservedRows[0].length).setValues(preservedRows);
          }
        }
      }

      // Write New Batch Rows (rowValues) if provided
      var rowsToWrite = [];
      if (Array.isArray(data.rowValues) && data.rowValues.length > 0) {
        for (var k = 0; k < data.rowValues.length; k++) {
          var itemRow = data.rowValues[k];
          // Ensure Column 0 is always the selected branch code/id
          var rBranch = String(itemRow[0] || branchCode || branchId).trim();
          var rBarcode = String(itemRow[1] || '').trim();
          var rName = String(itemRow[2] || '').trim();
          var rSysQty = Number(itemRow[3] || 0);
          var rScnQty = Number(itemRow[4] || 0);
          var rLoc = String(itemRow[5] || '').trim();
          var rCat = String(itemRow[6] || '').trim();
          var rDate = itemRow[7] ? String(itemRow[7]) : todayStr;
          var rSku = String(itemRow[8] || rBarcode).trim();
          var rBName = String(itemRow[9] || branchName).trim();
          var rBatchId = String(itemRow[10] || data.batchId || '').trim();
          var rImportDate = String(itemRow[11] || data.importDate || todayStr).trim();
          var rIsNewItem = (itemRow[12] === true || String(itemRow[12] || '').toUpperCase() === 'TRUE' || String(itemRow[12] || '').toUpperCase() === 'YES') ? 'TRUE' : 'FALSE';

          rowsToWrite.push([rBranch, rBarcode, rName, rSysQty, rScnQty, rLoc, rCat, rDate, rSku, rBName, rBatchId, rImportDate, rIsNewItem, nowStr]);
        }
      }

      if (rowsToWrite.length > 0) {
        var lastRow = stockSheet.getLastRow();
        var startRow = lastRow + 1;
        stockSheet.getRange(startRow, 1, rowsToWrite.length, rowsToWrite[0].length).setValues(rowsToWrite);
      }

      // Update Branches Sheet Summary
      var branchRows = branchSheet.getDataRange().getValues();
      var branchRowIdx = -1;
      for (var b = 1; b < branchRows.length; b++) {
        var curId = String(branchRows[b][0] || '').trim().toLowerCase();
        var curCode = String(branchRows[b][1] || '').trim().toLowerCase();
        if (curId === branchId.toLowerCase() || curCode === branchCode.toLowerCase()) {
          branchRowIdx = b + 1;
          break;
        }
      }

      var totalItemsCount = data.totalItems || (data.items ? data.items.length : rowsToWrite.length);
      var auditDateVal = data.auditDate || todayStr;

      if (branchRowIdx > 0) {
        branchSheet.getRange(branchRowIdx, 2).setValue(branchCode);
        branchSheet.getRange(branchRowIdx, 3).setValue(branchName);
        if (action === 'clearBranchData') {
          branchSheet.getRange(branchRowIdx, 6).setValue('NOT_STARTED');
          branchSheet.getRange(branchRowIdx, 9).setValue(0);
        } else {
          branchSheet.getRange(branchRowIdx, 7).setValue(auditDateVal);
          branchSheet.getRange(branchRowIdx, 9).setValue(totalItemsCount);
        }
        branchSheet.getRange(branchRowIdx, 10).setValue(nowStr);
      } else if (action !== 'clearBranchData') {
        branchSheet.appendRow([
          branchId,
          branchCode,
          branchName,
          data.region || 'ทั่วไป',
          data.assignedAuditor || 'เจ้าหน้าที่ Audit',
          'NOT_STARTED',
          auditDateVal,
          data.auditScheduleDay || 'OTHER',
          totalItemsCount,
          nowStr
        ]);
      }

      SpreadsheetApp.flush();

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        success: true,
        action: action,
        branchId: branchId,
        branchCode: branchCode,
        branchName: branchName,
        writtenRows: rowsToWrite.length,
        totalItems: totalItemsCount,
        timestamp: nowStr
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // --------------------------------------------------------------------------
    // ACTION: save (Branch update)
    // --------------------------------------------------------------------------
    if (action === 'save') {
      var bObj = data.branch || {};
      var bId = String(bObj.id || data.id || branchId).trim();
      var bCode = String(bObj.code || data.code || branchCode).trim();
      var bName = String(bObj.name || data.name || branchName).trim();
      var bRegion = String(bObj.region || data.region || 'ทั่วไป').trim();
      var bAuditor = String(bObj.assignedAuditor || data.assignedAuditor || 'เจ้าหน้าที่ Audit').trim();
      var bStatus = String(bObj.auditStatus || data.auditStatus || 'NOT_STARTED').trim();
      var bDate = String(bObj.auditDate || data.auditDate || todayStr).trim();
      var bDay = String(bObj.auditScheduleDay || data.auditScheduleDay || 'OTHER').trim();
      var bItemsCount = Array.isArray(bObj.items) ? bObj.items.length : 0;

      var bRows = branchSheet.getDataRange().getValues();
      var targetIdx = -1;
      for (var bi = 1; bi < bRows.length; bi++) {
        var cId = String(bRows[bi][0] || '').trim().toLowerCase();
        var cCode = String(bRows[bi][1] || '').trim().toLowerCase();
        if (cId === bId.toLowerCase() || cCode === bCode.toLowerCase()) {
          targetIdx = bi + 1;
          break;
        }
      }

      if (targetIdx > 0) {
        branchSheet.getRange(targetIdx, 1, 1, 10).setValues([[
          bId, bCode, bName, bRegion, bAuditor, bStatus, bDate, bDay, bItemsCount, nowStr
        ]]);
      } else {
        branchSheet.appendRow([
          bId, bCode, bName, bRegion, bAuditor, bStatus, bDate, bDay, bItemsCount, nowStr
        ]);
      }

      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        success: true,
        action: 'save',
        branchId: bId,
        branchCode: bCode
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // --------------------------------------------------------------------------
    // ACTION: deleteBranch
    // --------------------------------------------------------------------------
    if (action === 'deleteBranch') {
      var dRows = branchSheet.getDataRange().getValues();
      for (var di = dRows.length - 1; di >= 1; di--) {
        var rowId = String(dRows[di][0] || '').trim().toLowerCase();
        var rowCode = String(dRows[di][1] || '').trim().toLowerCase();
        if (rowId === branchId.toLowerCase() || rowCode === branchCode.toLowerCase()) {
          branchSheet.deleteRow(di + 1);
        }
      }

      // Also clean Stock_Data
      var sRows = stockSheet.getDataRange().getValues();
      for (var si = sRows.length - 1; si >= 1; si--) {
        var sBId = String(sRows[si][0] || '').trim().toLowerCase();
        if (sBId === branchId.toLowerCase() || sBId === branchCode.toLowerCase()) {
          stockSheet.deleteRow(si + 1);
        }
      }

      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        success: true,
        action: 'deleteBranch',
        branchId: branchId
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      success: true,
      action: action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (postErr) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      success: false,
      message: String(postErr.message || postErr)
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
`;
