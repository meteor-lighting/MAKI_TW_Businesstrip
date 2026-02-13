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
              return itemData[header] || '';
          });
          
          appendRow(category, newRow);
          
          // 3. Recalculate Header Totals
          recalculateHeader(reportId);
          
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
            recalculateHeader(reportId);
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
    // Sum up all categories for this reportId
    const categories = ['Flight', 'Accommodation', 'Taxi', 'Internet', 'Social', 'Gift', 'Handing Fee', 'Per Diem', 'Others'];
    
    let totals = {
        '機票費總額': 0,
        '個人住宿費總額': 0,
        '總體住宿費總額': 0,
        '計程車費總額': 0,
        '網路費總額': 0,
        '社交費總額': 0,
        '禮品費總額': 0,
        '手續費總額': 0,
        '日支費總額': 0,
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
                 if (cat === 'Accommodation') val = Number(item['TWD個人金額']) || 0;
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
            if (cat === 'Taxi') totals['計程車費總額'] = sum;
            if (cat === 'Internet') totals['網路費總額'] = sum;
            if (cat === 'Social') totals['社交費總額'] = sum;
            if (cat === 'Gift') totals['禮品費總額'] = sum;
            if (cat === 'Handing Fee') totals['手續費總額'] = sum;
            if (cat === 'Per Diem') totals['日支費總額'] = sum;
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
             else if (cat === 'Others') { totalPersonalTWD += totals['其他費用總額']; totalOverallTWD += totals['其他費用總額']; }
             else if (cat === 'Accommodation') {
                 totalPersonalTWD += totals['個人住宿費總額'];
                 totalOverallTWD += totals['總體住宿費總額'];
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
      let flightRateFound = false;
      if (rateCell) {
        try {
          const flightData = sheetDataToJson('Flight');
          const myFlights = flightData
              .filter(r => String(r['報告編號']) === String(reportId))
              .sort((a, b) => parseInt(a['次序']) - parseInt(b['次序']));
          
          const validFlight = myFlights.find(f => f['幣別'] === 'USD' && Number(f['匯率']) > 1);
          if (validFlight) {
              rate = Number(validFlight['匯率']);
              rateCell.setValue(rate);
              flightRateFound = true;
              Logger.log(`Synced Header Rate from Flight: ${rate}`);
          }
        } catch(e) {}
        
        // If no Flight Rate found, reset to 0 so Auto-Rate can assume control or stay 0
        if (!flightRateFound) {
            rate = 0;
            rateCell.setValue(0);
        }
      }
      
      // --- Calculate Date Range & Duration (And Auto-fetch Rate) ---
      let allDates = [];
      categories.forEach(cat => {
        try {
          const data = sheetDataToJson(cat);
          const reportItems = data.filter(r => String(r['報告編號']) === String(reportId));
          reportItems.forEach(item => {
             // Handle '日期' column.
             let d = item['日期'];
             let dateObj = null;
             if (d instanceof Date) {
                 dateObj = d;
             } else if (typeof d === 'string') {
                 const parts = d.split('-');
                 if (parts.length === 3) {
                     dateObj = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
                 } else if (d.includes('/')) {
                     const partsS = d.split('/');
                     if (partsS.length === 3) dateObj = new Date(partsS[0], parseInt(partsS[1], 10) - 1, partsS[2]);
                 }
                 if (!dateObj) dateObj = new Date(d); 
             }
             if (dateObj && !isNaN(dateObj.getTime())) {
                 allDates.push(dateObj.getTime());
             }
          });
        } catch(e) {}
      });
      
      let diffDays = 0;
      let startDateStr = '';
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
          
          
          // [Auto-Rate Logic] Update USD Rate if it's default/empty
          // Original logic: Fetch Rate for T-1.
          // Note: getExchangeRate/getBotRate now handles decrementing T-1 internally.
          // So we pass the actual Date.
          if ((!rate || rate <= 1) && minDate && rateCell) {
              const yyyy = minDate.getFullYear();
              const mm = String(minDate.getMonth() + 1).padStart(2, '0');
              const dd = String(minDate.getDate()).padStart(2, '0');
              const dateStr = `${yyyy}-${mm}-${dd}`;
              
              // Fixed: Call with object payload + Date without manual -1
              try {
                  const res = getBotRate({ currency: 'USD', date: dateStr });
                  if (res && (res.status === 'success' || res.rate)) {
                      const botRate = res.data?.rate || res.rate;
                      if (botRate && botRate > 1) {
                           rateCell.setValue(botRate);
                           rate = botRate; // Update local rate var for calculation below
                           Logger.log(`[Auto-Rate] Set Header Rate to ${botRate} from ${dateStr}`);
                      }
                  }
              } catch(e) {
                  Logger.log('Auto-rate fetch error: ' + e);
              }
          }
          
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
                 // ... (Detailed time parsing logic) ...
                 let d = f['日期'];
                 let dateObj = null;
                 if (d instanceof Date) dateObj = d;
                 else if (typeof d === 'string') {
                      let p = d.split(/[-/]/);
                      if (p.length === 3) dateObj = new Date(p[0], parseInt(p[1], 10) - 1, p[2]);
                      else dateObj = new Date(d);
                 }
                 
                 if (dateObj && !isNaN(dateObj.getTime())) {
                     // Helper
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
                     
                     if (depTs < minFlightTs) {
                         minFlightTs = depTs;
                         earliestFlightHour = dh + (dm/60);
                     }
                     
                     // Arr
                     let arrT = f['抵達時間'];
                     let ah=0, am=0;
                     if (arrT instanceof Date) { ah=arrT.getHours(); am=arrT.getMinutes(); }
                     else { const t=parseTimeStr(arrT); ah=t.h; am=t.m; }
                     
                     // Determining if arrival is "Last". Logic: Latest Departure implies Last Leg usually.
                     // We track max Departure TS for sorting logic, but we need ARRIVAL time of that leg.
                     // Actually simplest: Track max arrival TS? But Arrival Date isn't always distinct.
                     // Let's assume Flight Date matches. 
                     // Logic: Flight with max (Date+DepTime) is the last flight.
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
      
      // Update Date Columns
      const colDays = headers.indexOf('商旅天數');
      const colStart = headers.indexOf('商旅起始日');
      const colEnd = headers.indexOf('商旅結束日');
      
      if (colDays > -1) headerSheet.getRange(rowIndex, colDays + 1).setValue(diffDays > 0 ? diffDays : 0);
      if (colStart > -1) headerSheet.getRange(rowIndex, colStart + 1).setValue(startDateStr);
      if (colEnd > -1) headerSheet.getRange(rowIndex, colEnd + 1).setValue(endDateStr);

      // Write TWD Totals
      const colTotalPersonalTWD = headers.indexOf('合計TWD個人總額');
      if (colTotalPersonalTWD > -1) headerSheet.getRange(rowIndex, colTotalPersonalTWD + 1).setValue(totalPersonalTWD);
      
      const colTotalOverallTWD = headers.indexOf('合計TWD總體總額');
      if (colTotalOverallTWD > -1) headerSheet.getRange(rowIndex, colTotalOverallTWD + 1).setValue(totalOverallTWD);

      // Now calculate USD totals and Averages
      let totalPersonalUSD = 0;
      let totalOverallUSD = 0;
      
      if (rate > 0) {
          totalPersonalUSD = totalPersonalTWD / rate;
          totalOverallUSD = totalOverallTWD / rate;
      }
      
      const colTotalPersonalUSD = headers.indexOf('合計USD個人總額');
      if (colTotalPersonalUSD > -1) headerSheet.getRange(rowIndex, colTotalPersonalUSD + 1).setValue(totalPersonalUSD);
      
      const colTotalOverallUSD = headers.indexOf('合計USD總體總額');
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
      
      const colAvgPersonalTWD = headers.indexOf('合計TWD個人平均');
      if (colAvgPersonalTWD > -1) headerSheet.getRange(rowIndex, colAvgPersonalTWD + 1).setValue(avgPersonalTWD);
      
      const colAvgOverallTWD = headers.indexOf('合計TWD總體平均');
      if (colAvgOverallTWD > -1) headerSheet.getRange(rowIndex, colAvgOverallTWD + 1).setValue(avgOverallTWD);
      
      const colAvgPersonalUSD = headers.indexOf('合計USD個人平均');
      if (colAvgPersonalUSD > -1) headerSheet.getRange(rowIndex, colAvgPersonalUSD + 1).setValue(avgPersonalUSD);
      
      const colAvgOverallUSD = headers.indexOf('合計USD總體平均');
      if (colAvgOverallUSD > -1) headerSheet.getRange(rowIndex, colAvgOverallUSD + 1).setValue(avgOverallUSD);
      
      if (diffDays === 0) {
          // Reset Averages
          const resetCols = ['合計TWD個人平均', '合計TWD總體平均', '合計USD個人平均', '合計USD總體平均'];
          resetCols.forEach(colName => {
              const cIdx = headers.indexOf(colName);
              if (cIdx > -1) headerSheet.getRange(rowIndex, cIdx + 1).setValue(0);
          });
      }
    }
}
