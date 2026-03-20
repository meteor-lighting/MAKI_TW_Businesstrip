/**
 * Calculation Logic
 */
function createNewReport(payload) {
    // payload: { userId, exchangeRate }
    const lock = LockService.getScriptLock();
    if (lock.tryLock(10000)) {
        try {
             const sheet = getSheet('Report Header');
             const data = sheet.getDataRange().getValues();
             
             // Generate Report ID: BR-XXXXXXXX
             let lastNum = 0;
             if (data.length > 1) { // Header is row 1
                 const lastRow = data[data.length - 1];
                 const lastIdStr = lastRow[0]; 
                 const parts = lastIdStr.split('-');
                 if (parts.length === 2) {
                     lastNum = parseInt(parts[1], 10);
                 }
             }
             const newNum = lastNum + 1;
             const reportId = 'BR-' + String(newNum).padStart(8, '0');
             
             // Dynamic Row Construction based on Headers
             const headers = data[0]; // Row 1 headers
             
             const newRow = headers.map(header => {
                 switch(header) {
                     case '報告編號': return reportId;
                     case '用戶編號': return payload.userId;
                     case '建立時間': return new Date();
                     case 'USD匯率': return payload.exchangeRate || 0; // Default 0 if not provided
                     // Initialize Numeric Columns to 0
                     case '商旅天數':
                     case '機票費總額':
                     case '個人住宿費總額':
                     case '總體住宿費總額':
                     case '計程車費總額':
                     case '網路費總額':
                     case '社交費總額':
                     case '禮品費總額':
                     case '手續費總額':
                     case '日支費總額':
                     case '預支費用總額':
                     case '其他費用總額':
                     case '合計TWD個人總額':
                     case '合計TWD總體總額':
                     case '合計USD個人總額':
                     case '合計USD總體總額':
                     case '合計TWD個人平均':
                     case '合計TWD總體平均':
                     case '合計USD個人平均':
                     case '合計USD總體平均':
                         return 0;
                     default: return ''; // Empty for others (e.g. Start/End Date, Remarks)
                 }
             });
             
             sheet.appendRow(newRow);
             
             return { status: 'success', reportId: reportId };
        } finally {
            lock.releaseLock();
        }
    } else {
        return { status: 'error', message: 'Busy' };
    }
}

function addReportItem(payload) {
  // payload: { reportId, category, itemData: {} }
  const { reportId, category, itemData } = payload;
  
  if (!reportId || !category) return { status: 'error', message: 'Missing params' };
  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) {
      try {
          // 1. Get current items in this category for this report to determine 'Sequence'
          const allData = getDataRows(category);
          // Filter valid rows for this reportId
          const reportRows = allData.filter(r => String(r[0]) === String(reportId));
          const nextSeq = reportRows.length + 1;
          
          // 2. Prepare Row Data based on Sheet Headers
          const sheet = getSheet(category);
          const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
          
          const newRow = headers.map(header => {
              if (header === '報告編號') return reportId;
              if (header === '次序') return nextSeq;
              return itemData[header] !== undefined ? itemData[header] : '';
          });
          
          appendRow(category, newRow);
          
          // Force flush to sheet so subsequent reads in this execution and immediate next HTTP requests see the new row
          SpreadsheetApp.flush();
          
          // 3. Recalculate Header Totals & Dates
          const startDateStr = recalculateHeader(reportId);

          // 4. Update Exchange Rates based on the new Start Date
          updateAllExchangeRates(reportId, startDateStr);
          
          // 5. Recalculate Header AGAIN because TWD amounts may have changed
          recalculateHeader(reportId);
          
          // Final flush to guarantee UI refresh gets the latest data
          SpreadsheetApp.flush();
          
          return { status: 'success', sequence: nextSeq };
      } finally {
          lock.releaseLock();
      }
  } else {
      return { status: 'error', message: 'Busy' };
  }
}

function updateReportItem(payload) {
    // ... item update logic ...
    // Note: Implementing minimal update logic if needed, or placeholder
    return { status: 'success' };
}

function deleteReportItem(payload) {
  // payload: { reportId, category, sequence }
  const { reportId, category, sequence } = payload;
  const lock = LockService.getScriptLock();
  
  if (lock.tryLock(10000)) {
    try {
        const sheet = getSheet(category);
        const data = sheet.getDataRange().getValues(); // Get all data
        // Columns needed: Index 0 (ReportId), Index 1 (Seq).
        // Find row to delete. Row index matches data array index + 1
        
        // Find the specific row
        let deleteRowIndex = -1;
        
        for (let i = 1; i < data.length; i++) { // Skip header
            if (String(data[i][0]) === String(reportId) && String(data[i][1]) === String(sequence)) {
                deleteRowIndex = i + 1; // logical row number
                break;
            }
        }
        
        if (deleteRowIndex > 0) {
            sheet.deleteRow(deleteRowIndex);
            const startDateStr = recalculateHeader(reportId);
            
            // Update Exchange Rates based on the new Start Date
            updateAllExchangeRates(reportId, startDateStr);
            
            // Recalculate Header AGAIN
            recalculateHeader(reportId);

            SpreadsheetApp.flush();

            return { status: 'success', message: 'Deleted' };
        } else {
             return { status: 'error', message: 'Item not found' };
        }
        
    } finally {
        lock.releaseLock();
    }
  } else {
       return { status: 'error', message: 'Busy' };
  }
}

function recalculateHeader(reportId) {
    let startDateStr = '';
    // Sum up all categories for this reportId
    const categories = ['Flight', 'Accommodation', 'Rental Car', 'Taxi', 'Internet', 'Social', 'Gift', 'Handing Fee', 'Per Diem', 'Advance Payment', 'Others'];
    
    let totals = {
        '機票費總額': 0,
        '個人住宿費總額': 0,
        '總體住宿費總額': 0,
        '個人租車費總額': 0,
        '總體租車費總額': 0,
        '計程車費總額': 0,
        '網路費總額': 0,
        '社交費總額': 0,
        '禮品費總額': 0,
        '手續費總額': 0,
        '日支費總額': 0,
        '預支費用總額': 0,
        '其他費用總額': 0
    };
    
    // Accumulate sums
    categories.forEach(cat => {
        try {
            const data = sheetDataToJson(cat);
            const reportItems = data.filter(r => String(r['報告編號']) === String(reportId));
            
            let sum = 0;
            reportItems.forEach(item => {
                 let val = 0;
                 if (cat === 'Accommodation' || cat === 'Rental Car') val = Number(item['TWD個人金額']) || 0;
                 else val = Number(item['TWD金額']) || 0;
                 sum += val;
            });
            
            // Map category to header field name
            if (cat === 'Flight') totals['機票費總額'] = sum;
            if (cat === 'Accommodation') {
                totals['個人住宿費總額'] = sum;
                // Calculate Overall Total as well
                let overallSum = 0;
                 reportItems.forEach(item => {
                     let val = Number(item['TWD總體金額']) || 0;
                     overallSum += val;
                });
                totals['總體住宿費總額'] = overallSum;
            }
            if (cat === 'Rental Car') {
                totals['個人租車費總額'] = sum;
                let overallSum = 0;
                 reportItems.forEach(item => {
                     let val = Number(item['TWD總體金額']) || 0;
                     overallSum += val;
                });
                totals['總體租車費總額'] = overallSum;
            }
            if (cat === 'Taxi') totals['計程車費總額'] = sum;
            if (cat === 'Internet') totals['網路費總額'] = sum;
            if (cat === 'Social') totals['社交費總額'] = sum;
            if (cat === 'Gift') totals['禮品費總額'] = sum;
            if (cat === 'Handing Fee') totals['手續費總額'] = sum;
            if (cat === 'Per Diem') totals['日支費總額'] = sum;
            if (cat === 'Advance Payment') totals['預支費用總額'] = sum;
            if (cat === 'Others') totals['其他費用總額'] = sum;
        } catch (e) {
            // ignore missing sheets
        }
    });
    
    // Update Header
    const headerSheet = getSheet('Report Header');
    const headerData = getDataRows('Report Header');
    let rowIndex = -1;
    for (let i = 0; i < headerData.length; i++) {
        if (String(headerData[i][0]) === String(reportId)) { // ID matches
            rowIndex = i + 2; 
            break;
        }
    }
    
    if (rowIndex > 0) {
      const headers = headerSheet.getRange(1, 1, 1, headerSheet.getLastColumn()).getValues()[0];
      
      // Update totals columns
      for (const [key, val] of Object.entries(totals)) {
        const colIdx = headers.indexOf(key);
        if (colIdx > -1) {
          headerSheet.getRange(rowIndex, colIdx + 1).setValue(val);
        }
      }
      
      // Recalculate separate totals (Personal vs Overall)
      let totalPersonalTWD = 0;
      let totalOverallTWD = 0;
      categories.forEach(cat => {
             // Mapping based on category code naming in 'totals' object
             if (cat === 'Flight') { totalPersonalTWD += totals['機票費總額']; totalOverallTWD += totals['機票費總額']; }
             else if (cat === 'Taxi') { totalPersonalTWD += totals['計程車費總額']; totalOverallTWD += totals['計程車費總額']; }
             else if (cat === 'Internet') { totalPersonalTWD += totals['網路費總額']; totalOverallTWD += totals['網路費總額']; }
             else if (cat === 'Social') { totalPersonalTWD += totals['社交費總額']; totalOverallTWD += totals['社交費總額']; }
             else if (cat === 'Gift') { totalPersonalTWD += totals['禮品費總額']; totalOverallTWD += totals['禮品費總額']; }
             else if (cat === 'Handing Fee') { totalPersonalTWD += totals['手續費總額']; totalOverallTWD += totals['手續費總額']; }
             else if (cat === 'Per Diem') { totalPersonalTWD += totals['日支費總額']; totalOverallTWD += totals['日支費總額']; }
             else if (cat === 'Advance Payment') { /* 預支費用不列入總計計算 */ }
             else if (cat === 'Others') { totalPersonalTWD += totals['其他費用總額']; totalOverallTWD += totals['其他費用總額']; }
             else if (cat === 'Accommodation') {
                 totalPersonalTWD += totals['個人住宿費總額'];
                 totalOverallTWD += totals['總體住宿費總額'];
             }
             else if (cat === 'Rental Car') {
                 totalPersonalTWD += totals['個人租車費總額'];
                 totalOverallTWD += totals['總體租車費總額'];
             }
      });
      
      // Get current rate
      const rateCol = headers.indexOf('USD匯率');
      let rate = 1; 
      let rateCell = null;
      if (rateCol > -1) {
          rateCell = headerSheet.getRange(rowIndex, rateCol + 1);
          let val = Number(rateCell.getValue());
          if (val && val > 0) rate = val;
      }
      
      // [Sync Rate] Logic
      // Always try to sync from Flight first, or reset if no flight
      // Logic moved to updateExchangeRateAndRecalculate, but we keep basic rate read here
      // to support UI display. The actual heavy lifting is done in updateExchangeRateAndRecalculate
      
      // Calculate Date Range & Duration (And Auto-fetch Rate)
      let allDates = [];
      categories.forEach(cat => {
        if (cat === 'Accommodation' || cat === 'Per Diem' || cat === 'Rental Car') return;
        try {
          const data = sheetDataToJson(cat);
          const reportItems = data.filter(r => String(r['報告編號']) === String(reportId));
          reportItems.forEach(item => {
             const parseDateStr = (dateVal) => {
                 let dateObj = null;
                 if (dateVal instanceof Date) {
                     dateObj = dateVal;
                 } else if (typeof dateVal === 'string') {
                     const parts = dateVal.split('-');
                     if (parts.length === 3) {
                         dateObj = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
                     } else if (dateVal.includes('/')) {
                         const partsS = dateVal.split('/');
                         if (partsS.length === 3) dateObj = new Date(partsS[0], parseInt(partsS[1], 10) - 1, partsS[2]);
                     }
                     if (!dateObj) dateObj = new Date(dateVal); 
                 }
                 return dateObj;
             };

             if (item['日期']) {
                 let obj = parseDateStr(item['日期']);
                 if (obj && !isNaN(obj.getTime())) allDates.push(obj.getTime());
             }
          });
        } catch(e) {}
      });
      
      let diffDays = 0;
      let endDateStr = '';
      
      if (allDates.length > 0) {
          const minDate = new Date(Math.min(...allDates));
          const maxDate = new Date(Math.max(...allDates));
          
          const formatDate = (date) => {
              return date.getFullYear() + '/' + 
                     String(date.getMonth() + 1).padStart(2, '0') + '/' + 
                     String(date.getDate()).padStart(2, '0');
          };
          
          startDateStr = formatDate(minDate);
          endDateStr = formatDate(maxDate);
          
          // Calculate Days (inclusive)
          const utc1 = Date.UTC(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
          const utc2 = Date.UTC(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
          diffDays = Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24)) + 1;
          
          // Flight Time Adjustment
          try {
             const flightData = sheetDataToJson('Flight');
             const myFlights = flightData.filter(r => String(r['報告編號']) === String(reportId));
             
             let earliestFlightHour = -1;
             let minFlightTs = Infinity;
             let latestFlightArrivalHour = -1;
             let maxFlightTs = -Infinity;
             
             myFlights.forEach(f => {
                 let d = f['日期'];
                 let dateObj = null;
                 if (d instanceof Date) dateObj = d;
                 else if (typeof d === 'string') {
                      let p = d.split(/[-/]/);
                      if (p.length === 3) dateObj = new Date(p[0], parseInt(p[1], 10) - 1, p[2]);
                      else dateObj = new Date(d);
                 }
                 
                 if (dateObj && !isNaN(dateObj.getTime())) {
                     const parseTimeStr = (tStr) => {
                         let h = 0, m = 0;
                         if (!tStr) return {h, m};
                         let isPM = String(tStr).includes('下午') || /pm/i.test(tStr);
                         let isAM = String(tStr).includes('上午') || /am/i.test(tStr);
                         let cleanTime = String(tStr).replace(/[^0-9:]/g, '');
                         let parts = cleanTime.split(':');
                         if (parts.length >= 2) {
                             h = parseInt(parts[0], 10);
                             m = parseInt(parts[1], 10);
                             if (isPM && h < 12) h += 12;
                             if (isAM && h === 12) h = 0;
                         }
                         return { h, m };
                     };
                     
                     // Dep
                     let depT = f['出發時間'];
                     let dh=0, dm=0;
                     if (depT instanceof Date) { dh=depT.getHours(); dm=depT.getMinutes(); }
                     else { const t=parseTimeStr(depT); dh=t.h; dm=t.m; }
                     let depTs = dateObj.getTime() + dh*3600000 + dm*60000;
                     
                     // Arr
                     let arrT = f['抵達時間'];
                     let ah=0, am=0;
                     if (arrT instanceof Date) { ah=arrT.getHours(); am=arrT.getMinutes(); }
                     else { const t=parseTimeStr(arrT); ah=t.h; am=t.m; }
                     
                     if (depTs > maxFlightTs) {
                         maxFlightTs = depTs;
                         latestFlightArrivalHour = ah + (am/60);
                     }
                 }
             });
             
             // Rules
             if (earliestFlightHour > 14) diffDays -= 0.5;
             if (latestFlightArrivalHour > -1 && latestFlightArrivalHour < 12 && diffDays > 1) diffDays -= 0.5;
             
          } catch(e) {
              Logger.log('Flight time adjustment error: ' + e);
          }
      }
      
      // Helper to find column index robustly
      const findCol = (name) => {
          return headers.findIndex(h => String(h).trim() === name);
      };

      // Update Date Columns
      const colDays = findCol('商旅天數');
      const colStart = findCol('商旅起始日');
      const colEnd = findCol('商旅結束日');
      
      if (colDays > -1) headerSheet.getRange(rowIndex, colDays + 1).setValue(diffDays > 0 ? diffDays : 0);
      if (colStart > -1) headerSheet.getRange(rowIndex, colStart + 1).setValue(startDateStr);
      if (colEnd > -1) headerSheet.getRange(rowIndex, colEnd + 1).setValue(endDateStr);

      // Write TWD Totals
      const colTotalPersonalTWD = findCol('合計TWD個人總額');
      if (colTotalPersonalTWD > -1) headerSheet.getRange(rowIndex, colTotalPersonalTWD + 1).setValue(totalPersonalTWD);
      
      const colTotalOverallTWD = findCol('合計TWD總體總額');
      if (colTotalOverallTWD > -1) headerSheet.getRange(rowIndex, colTotalOverallTWD + 1).setValue(totalOverallTWD);

      // Now calculate USD totals and Averages
      let totalPersonalUSD = 0;
      let totalOverallUSD = 0;
      
      if (rate && rate > 0) {
          totalPersonalUSD = totalPersonalTWD / rate;
          totalOverallUSD = totalOverallTWD / rate;
      }
      
      const colTotalPersonalUSD = findCol('合計USD個人總額');
      if (colTotalPersonalUSD > -1) headerSheet.getRange(rowIndex, colTotalPersonalUSD + 1).setValue(totalPersonalUSD);
      
      const colTotalOverallUSD = findCol('合計USD總體總額');
      if (colTotalOverallUSD > -1) headerSheet.getRange(rowIndex, colTotalOverallUSD + 1).setValue(totalOverallUSD);
      
      // Averages
      let avgPersonalTWD = 0;
      let avgOverallTWD = 0;
      let avgPersonalUSD = 0;
      let avgOverallUSD = 0;
      
      if (diffDays > 0) {
          avgPersonalTWD = totalPersonalTWD / diffDays;
          avgOverallTWD = totalOverallTWD / diffDays;
          avgPersonalUSD = totalPersonalUSD / diffDays;
          avgOverallUSD = totalOverallUSD / diffDays;
      }
      
      const colAvgPersonalTWD = findCol('合計TWD個人平均');
      if (colAvgPersonalTWD > -1) headerSheet.getRange(rowIndex, colAvgPersonalTWD + 1).setValue(avgPersonalTWD);
      
      const colAvgOverallTWD = findCol('合計TWD總體平均');
      if (colAvgOverallTWD > -1) headerSheet.getRange(rowIndex, colAvgOverallTWD + 1).setValue(avgOverallTWD);
      
      const colAvgPersonalUSD = findCol('合計USD個人平均');
      Logger.log(`[AvgCalc] Personal USD Avg: ${avgPersonalUSD}, Col Index: ${colAvgPersonalUSD}`);
      if (colAvgPersonalUSD > -1) headerSheet.getRange(rowIndex, colAvgPersonalUSD + 1).setValue(avgPersonalUSD);
      
      const colAvgOverallUSD = findCol('合計USD總體平均');
      if (colAvgOverallUSD > -1) headerSheet.getRange(rowIndex, colAvgOverallUSD + 1).setValue(avgOverallUSD);
      
      if (diffDays === 0) {
          // Reset Averages
          const resetCols = ['合計TWD個人平均', '合計TWD總體平均', '合計USD個人平均', '合計USD總體平均'];
          resetCols.forEach(colName => {
              const cIdx = findCol(colName);
              if (cIdx > -1) headerSheet.getRange(rowIndex, cIdx + 1).setValue(0);
          });
      }
    }
    
    return startDateStr;
}

/**
 * Updates Exchange Rate and Recalculates all dependent TWD amounts based on Trip Start Date
 */
function updateAllExchangeRates(reportId, startDateStr) {
    if (!startDateStr || startDateStr === '-') return;

    // Cache to prevent multiple BOT API calls for the same currency
    const rateCache = { 'TWD': 1.0 }; 
    
    // Function to get rate
    const getRate = (currency) => {
        if (rateCache[currency] !== undefined) return rateCache[currency];
        const res = getExchangeRate({ currency, date: startDateStr });
        if (res && res.status === 'success' && res.rate) {
            rateCache[currency] = res.rate;
            Logger.log(`[RateUpdate] Fetched ${currency} rate = ${res.rate} for ${startDateStr}`);
        } else {
            rateCache[currency] = 1.0; // Fallback
        }
        return rateCache[currency];
    };

    const categories = ['Flight', 'Accommodation', 'Rental Car', 'Taxi', 'Internet', 'Social', 'Gift', 'Handing Fee', 'Per Diem', 'Advance Payment', 'Others'];
    
    categories.forEach(cat => {
        try {
            const sheet = getSheet(cat);
            if (!sheet) return;
            const data = sheet.getDataRange().getValues();
            if (data.length <= 1) return;
            
            const sheetHeaders = data[0];
            
            const idxId = sheetHeaders.indexOf('報告編號');
            const idxCurrency = sheetHeaders.indexOf('幣別');
            const idxRate = sheetHeaders.indexOf('匯率');
            const idxAmount = sheetHeaders.indexOf('金額');
            const idxTwdAmount = sheetHeaders.indexOf('TWD金額');
            
            const idxPersonal = sheetHeaders.indexOf('個人金額');
            const idxTwdPersonal = sheetHeaders.indexOf('TWD個人金額');
            const idxAdvance = sheetHeaders.indexOf('代墊金額');
            const idxTwdAdvance = sheetHeaders.indexOf('TWD代墊金額');
            const idxOverall = sheetHeaders.indexOf('總體金額');
            const idxTwdOverall = sheetHeaders.indexOf('TWD總體金額');
            
            for (let i = 1; i < data.length; i++) {
                 if (String(data[i][idxId]) === String(reportId)) {
                     const currency = String(data[i][idxCurrency]).trim().toUpperCase();
                     
                     if (currency !== 'TWD' && currency !== '') {
                         const rowRate = getRate(currency);
                         const row = i + 1;
                         
                         if (idxRate > -1) sheet.getRange(row, idxRate + 1).setValue(rowRate);
                         
                         if (cat === 'Accommodation' || cat === 'Rental Car') {
                             if (idxPersonal > -1 && idxTwdPersonal > -1) {
                                 const val = Number(data[i][idxPersonal]) || 0;
                                 sheet.getRange(row, idxTwdPersonal + 1).setValue(Math.round(val * rowRate));
                             }
                             if (idxAdvance > -1 && idxTwdAdvance > -1) {
                                 const val = Number(data[i][idxAdvance]) || 0;
                                 sheet.getRange(row, idxTwdAdvance + 1).setValue(Math.round(val * rowRate));
                             }
                             if (idxOverall > -1 && idxTwdOverall > -1) {
                                 const val = Number(data[i][idxOverall]) || 0;
                                 sheet.getRange(row, idxTwdOverall + 1).setValue(Math.round(val * rowRate));
                             }
                         } else {
                             // Normal forms
                             if (idxAmount > -1 && idxTwdAmount > -1) {
                                 const val = Number(data[i][idxAmount]) || 0;
                                 sheet.getRange(row, idxTwdAmount + 1).setValue(Math.round(val * rowRate));
                             }
                         }
                     }
                 }
            }
        } catch(e) {
            Logger.log('Error updating rates for ' + cat + ': ' + e);
        }
    });

    // 2. Update Header Rate (USD is the primary reference)
    const newUsdRate = getRate('USD');
    const headerSheet = getSheet('Report Header');
    const headerData = headerSheet.getDataRange().getValues();
    let headerRowIndex = -1;
    for (let i = 1; i < headerData.length; i++) {
        if (String(headerData[i][0]) === String(reportId)) {
            headerRowIndex = i + 1; 
            break;
        }
    }
    
    if (headerRowIndex > -1) {
        const headers = headerData[0];
        const rateCol = headers.indexOf('USD匯率');
        if (rateCol > -1) {
            headerSheet.getRange(headerRowIndex, rateCol + 1).setValue(newUsdRate);
        }
    }
    SpreadsheetApp.flush();
}
