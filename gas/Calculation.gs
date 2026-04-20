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
                     case '支付幣別': return 'TWD';
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
             invalidateCache('Report Header');
             
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
          const sheet = getSheet(category);
          const data = sheet.getDataRange().getValues();
          const headers = data[0] || [];
          const rIdx = headers.indexOf('報告編號');
          const sIdx = headers.indexOf('次序');
          let nextSeq = 1;
          
          if (rIdx !== -1 && sIdx !== -1 && data.length > 1) {
              const reportRows = data.slice(1).filter(r => String(r[rIdx]) === String(reportId));
              if (reportRows.length > 0) {
                  const maxSeq = Math.max(...reportRows.map(r => Number(r[sIdx]) || 0));
                  nextSeq = maxSeq + 1;
              }
          }
          
          // 2. Prepare Row Data based on Sheet Headers
          
          // Fetch existing start date dynamically
          const headerDataStr = getSheet('Report Header').getDataRange().getValues();
          let oldStart = '';
          for (let i=1; i<headerDataStr.length; i++) {
              if (String(headerDataStr[i][0]) === String(reportId)) {
                  oldStart = String(headerDataStr[i][headerDataStr[0].indexOf('商旅起始日')] || '');
                  break;
              }
          }
          
          const newRow = headers.map(header => {
              if (header === '報告編號') return reportId;
              if (header === '次序') return nextSeq;
              return itemData[header] !== undefined ? itemData[header] : '';
          });
          
          appendRow(category, newRow);
          SpreadsheetApp.flush(); // Force sync so recalculate reads the new row immediately
          
          // 3. Recalculate Header Totals & Dates 
            const newStart = recalculateHeader(reportId, category);

            // 4. Update Exchange Rates based ONLY on what explicitly needs syncing
            if (oldStart !== newStart) {
                updateAllExchangeRates(reportId, newStart, null, true);
                recalculateHeader(reportId, category);
            } else {
                updateAllExchangeRates(reportId, newStart, category, false);
                recalculateHeader(reportId, category);
            }
          
          return { status: 'success', sequence: nextSeq };
      } finally {
          lock.releaseLock();
      }
  } else {
      return { status: 'error', message: 'Busy' };
  }
}

function updateReportItem(payload) {
    // payload: { reportId, category, sequence, itemData }
    const { reportId, category, sequence, itemData } = payload;
    if (!reportId || !category || !sequence || !itemData) return { status: 'error', message: 'Missing params' };
    
    const lock = LockService.getScriptLock();
    if (lock.tryLock(10000)) {
        try {
            const sheet = getSheet(category);
            const data = sheet.getDataRange().getValues();
            if (data.length < 2) return { status: 'error', message: 'Item not found' };
            
            const headers = data[0];
            const rIdx = headers.indexOf('報告編號');
            const sIdx = headers.indexOf('次序');
            
            if (rIdx === -1 || sIdx === -1) {
                return { status: 'error', message: 'Invalid sheet structure' };
            }
            
            let updateRowIndex = -1;
            for (let i = 1; i < data.length; i++) {
                if (String(data[i][rIdx]) === String(reportId) && String(data[i][sIdx]) === String(sequence)) {
                    updateRowIndex = i + 1; // 1-based row index
                    break;
                }
            }
            
            if (updateRowIndex === -1) {
                return { status: 'error', message: 'Item not found' };
            }
            
            const updatedRow = headers.map(header => {
                if (header === '報告編號') return reportId;
                if (header === '次序') return sequence;
                return itemData[header] !== undefined ? itemData[header] : ''; 
            });
            
            const headerDataStr = getSheet('Report Header').getDataRange().getValues();
            let oldStart = '';
            for (let i=1; i<headerDataStr.length; i++) {
                if (String(headerDataStr[i][0]) === String(reportId)) {
                    oldStart = String(headerDataStr[i][headerDataStr[0].indexOf('商旅起始日')] || '');
                    break;
                }
            }
            
            sheet.getRange(updateRowIndex, 1, 1, headers.length).setValues([updatedRow]);
            SpreadsheetApp.flush(); // Force sync so recalculate reads the updated numbers
            
            invalidateCache(category); // Crucial for recalculateHeader to see the update
            
            const newStart = recalculateHeader(reportId, category);
            
            if (oldStart !== newStart) {
                updateAllExchangeRates(reportId, newStart);
                recalculateHeader(reportId, category);
            } else {
                updateAllExchangeRates(reportId, newStart, category);
                recalculateHeader(reportId, category);
            }
            
            return { status: 'success' };
        } finally {
            lock.releaseLock();
        }
    } else {
        return { status: 'error', message: 'Busy' };
    }
}

function deleteReportItem(payload) {
  // payload: { reportId, category, sequence }
  const { reportId, category, sequence } = payload;
  const lock = LockService.getScriptLock();
  
  if (lock.tryLock(10000)) {
    try {
        const sheet = getSheet(category);
        const data = sheet.getDataRange().getValues(); // Get all data
        if (data.length < 2) return { status: 'error', message: 'Item not found' };
        
        const headers = data[0];
        const rIdx = headers.indexOf('報告編號');
        const sIdx = headers.indexOf('次序');
        
        if (rIdx === -1 || sIdx === -1) {
            return { status: 'error', message: 'Invalid sheet structure' };
        }
        
        // Find the specific row
        let deleteRowIndex = -1;
        
        for (let i = 1; i < data.length; i++) { // Skip header
            if (String(data[i][rIdx]) === String(reportId) && String(data[i][sIdx]) === String(sequence)) {
                deleteRowIndex = i + 1; // logical row number
                break;
            }
        }
        
        const headerDataStr = getSheet('Report Header').getDataRange().getValues();
        let oldStart = '';
        for (let i=1; i<headerDataStr.length; i++) {
            if (String(headerDataStr[i][0]) === String(reportId)) {
                oldStart = String(headerDataStr[i][headerDataStr[0].indexOf('商旅起始日')] || '');
                break;
            }
        }
        
        if (deleteRowIndex > 0) {
            sheet.deleteRow(deleteRowIndex);
            SpreadsheetApp.flush(); // Force sync structural mutation so recalculate reads empty
        }
        
        invalidateCache(category); // Force drop stale items
        
        const newStart = recalculateHeader(reportId, category);
        
        if (oldStart !== newStart) {
            updateAllExchangeRates(reportId, newStart);
            recalculateHeader(reportId, category);
        } else {
            updateAllExchangeRates(reportId, newStart, category);
            recalculateHeader(reportId, category);
        }

        return { status: 'success', message: 'Deleted and Synced' };
        
    } finally {
        lock.releaseLock();
    }
  } else {
       return { status: 'error', message: 'Busy' };
  }
}

function updateReportTripInfo(payload) {
    const { reportId, days, startDate, endDate, destination, paymentCurrency } = payload;
    if (!reportId) return { status: 'error', message: 'Missing reportId' };
    
    const lock = LockService.getScriptLock();
    if (lock.tryLock(10000)) {
        try {
            const sheet = getSheet('Report Header');
            const data = sheet.getDataRange().getValues();
            let rowIndex = -1;
            for (let i = 1; i < data.length; i++) {
                if (String(data[i][0]) === String(reportId)) {
                    rowIndex = i + 1;
                    break;
                }
            }
            if (rowIndex === -1) return { status: 'error', message: 'Report not found' };
            
            const headers = data[0];
            const colDays = headers.indexOf('商旅天數');
            const colStart = headers.indexOf('商旅起始日');
            const colEnd = headers.indexOf('商旅結束日');
            const colDest = headers.indexOf('出差國家');
            const colCurrency = headers.indexOf('支付幣別');
            
            // Re-implementing with Array fetch to avoid single cell hit
            const rowRange = sheet.getRange(rowIndex, 1, 1, headers.length);
            const rowData = rowRange.getValues()[0];

            if (colDays > -1 && days !== undefined && days !== '') rowData[colDays] = days;
            if (colStart > -1 && startDate !== undefined && startDate !== '') rowData[colStart] = startDate.replace(/-/g, '/');
            if (colEnd > -1 && endDate !== undefined && endDate !== '') rowData[colEnd] = endDate.replace(/-/g, '/');
            if (colDest > -1 && destination !== undefined) rowData[colDest] = destination;
            
            if (colCurrency > -1 && paymentCurrency !== undefined) rowData[colCurrency] = paymentCurrency;
            else if (colCurrency === -1 && paymentCurrency !== undefined) {
                // Rare case where payment currency completely missed - direct write handled, but usually not hitting this on warm DB
                const headCurRange = sheet.getRange(1, headers.length + 1);
                headCurRange.setValue('支付幣別');
                sheet.getRange(rowIndex, headers.length + 1).setValue(paymentCurrency);
            }
            
            rowRange.setValues([rowData]);

            updateAllExchangeRates(reportId, startDate.replace(/-/g, '/'));
            recalculateHeader(reportId, 'MANUAL_DATE_UPDATE');
            invalidateCache('Report Header');
            
            return { status: 'success' };
        } finally {
            lock.releaseLock();
        }
    } else {
        return { status: 'error', message: 'Busy' };
    }
}

function recalculateHeader(reportId, triggerCategory = null) {
    let startDateStr = '';
    const ALL_CATEGORIES = ['Flight', 'Accommodation', 'Rental Car', 'Transportation', 'Gas', 'Parking', 'Internet', 'Social', 'Gift', 'Luggage Fee', 'Handing Fee', 'Per Diem', 'Advance Payment', 'Lunch & Learn', 'Others'];
    
    // PERF FIX: Now relying on the O(1) Cache Proxy mechanism which warms instantly.
    // Summing ALL categories to guarantee native USD precision and avoid floating-point loss.
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let categoriesToFetch = ALL_CATEGORIES;
    
    // Extract Header and Rate FIRST so they are available for precise USD logic
    const headerSheet = getSheet('Report Header');
    const headerData = headerSheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 0; i < headerData.length; i++) {
        if (String(headerData[i][0]).trim() === String(reportId).trim()) { 
            rowIndex = i + 1; 
            break;
        }
    }
    
    if (rowIndex <= 0) return '';
    
    const headers = headerData[0];
    const rowRange = headerSheet.getRange(rowIndex, 1, 1, headers.length);
    const rowData = rowRange.getValues()[0];
    
    const findCol = (name) => headers.findIndex(h => String(h).trim() === name);

    const rateCol = findCol('USD匯率');
    let rate = 1; 
    if (rateCol > -1) {
        let val = Number(rowData[rateCol]);
        if (val && val > 0) rate = val;
    }

    const myItemsMap = {};
    categoriesToFetch.forEach(c => {
        try {
            const data = sheetDataToJson(c, ss);
            myItemsMap[c] = data.filter(r => String(r['報告編號']) === String(reportId));
        } catch(e) {
            myItemsMap[c] = [];
        }
    });

    const totalsPartial = {};
    categoriesToFetch.forEach(cat => {
        try {
            const reportItems = myItemsMap[cat] || [];
            let sumTWD = 0;
            let sumUSD = 0;
            
            reportItems.forEach(item => {
                 let valTWD = 0;
                 if (cat === 'Accommodation' || cat === 'Rental Car') {
                     valTWD = Number(String(item['TWD個人金額'] || 0).replace(/[^\d.-]/g, '')) || 0;
                 } else {
                     valTWD = Number(String(item['TWD金額'] || 0).replace(/[^\d.-]/g, '')) || 0;
                 }
                 sumTWD += valTWD;
                 
                 // Native USD exact
                 const ccy = String(item['幣別'] || '').trim().toUpperCase();
                 if (ccy === 'USD') {
                     let rawAmt = 0;
                     if (cat === 'Accommodation' || cat === 'Rental Car') {
                         rawAmt = Number(String(item['個人金額'] || item['金額'] || 0).replace(/[^\d.-]/g, '')) || 0;
                     } else {
                         rawAmt = Number(String(item['金額'] || 0).replace(/[^\d.-]/g, '')) || 0;
                     }
                     sumUSD += rawAmt;
                 } else {
                     sumUSD += valTWD / rate;
                 }
            });
            
            if (cat === 'Flight') { totalsPartial['機票費總額'] = sumTWD; totalsPartial['機票費USD總額'] = sumUSD; }
            if (cat === 'Transportation') { totalsPartial['交通運輸費總額'] = sumTWD; totalsPartial['交通運輸費USD總額'] = sumUSD; }
            if (cat === 'Gas') { totalsPartial['瓦斯費總額'] = sumTWD; totalsPartial['瓦斯費USD總額'] = sumUSD; }
            if (cat === 'Parking') { totalsPartial['停車費總額'] = sumTWD; totalsPartial['停車費USD總額'] = sumUSD; }
            if (cat === 'Internet') { totalsPartial['網路費總額'] = sumTWD; totalsPartial['網路費USD總額'] = sumUSD; }
            if (cat === 'Social') { totalsPartial['社交費總額'] = sumTWD; totalsPartial['社交費USD總額'] = sumUSD; }
            if (cat === 'Gift') { totalsPartial['禮品費總額'] = sumTWD; totalsPartial['禮品費USD總額'] = sumUSD; }
            if (cat === 'Luggage Fee') { totalsPartial['行李費總額'] = sumTWD; totalsPartial['行李費USD總額'] = sumUSD; }
            if (cat === 'Handing Fee') { totalsPartial['手續費總額'] = sumTWD; totalsPartial['手續費USD總額'] = sumUSD; }
            if (cat === 'Per Diem') { totalsPartial['日支費總額'] = sumTWD; totalsPartial['日支費USD總額'] = sumUSD; }
            if (cat === 'Advance Payment') { totalsPartial['預支費用總額'] = sumTWD; totalsPartial['預支費用USD總額'] = sumUSD; }
            if (cat === 'Lunch & Learn') { totalsPartial['午餐與學費總額'] = sumTWD; totalsPartial['午餐與學費USD總額'] = sumUSD; }
            if (cat === 'Others') { totalsPartial['其他費用總額'] = sumTWD; totalsPartial['其他費用USD總額'] = sumUSD; }
            
            if (cat === 'Accommodation' || cat === 'Rental Car') {
                const prefix = cat === 'Accommodation' ? '住宿' : '租車';
                totalsPartial[`個人${prefix}費總額`] = sumTWD;
                totalsPartial[`個人${prefix}費USD總額`] = sumUSD;
                
                let ovSumTWD = 0;
                let ovSumUSD = 0;
                reportItems.forEach(item => { 
                    let ovTWD = Number(String(item['TWD總體金額'] || 0).replace(/[^\d.-]/g, '')) || 0;
                    ovSumTWD += ovTWD;
                    const ccy = String(item['幣別'] || '').trim().toUpperCase();
                    if (ccy === 'USD') {
                        ovSumUSD += Number(String(item['總體金額'] || item['金額'] || 0).replace(/[^\d.-]/g, '')) || 0;
                    } else {
                        ovSumUSD += ovTWD / rate;
                    }
                });
                totalsPartial[`總體${prefix}費總額`] = ovSumTWD;
                totalsPartial[`總體${prefix}費USD總額`] = ovSumUSD;
            }
        } catch(e) {}
    });
    
      for (const [key, val] of Object.entries(totalsPartial)) {
        let colIdx = findCol(key);
        if (colIdx === -1) {
          const newCol = headers.length + 1;
          headerSheet.getRange(1, newCol).setValue(key);
          headers.push(key);
          colIdx = headers.length - 1;
          rowData.push(val); 
        } else {
          rowData[colIdx] = val;
        }
      }
      
      let totalPersonalTWD = 0;
      let totalOverallTWD = 0;
      
      const sumColsPersonal = ['機票費總額', '個人住宿費總額', '個人租車費總額', '交通運輸費總額', '瓦斯費總額', '停車費總額', '網路費總額', '社交費總額', '禮品費總額', '行李費總額', '手續費總額', '日支費總額', '午餐與學費總額', '其他費用總額'];
      const sumColsOverall = ['機票費總額', '總體住宿費總額', '總體租車費總額', '交通運輸費總額', '瓦斯費總額', '停車費總額', '網路費總額', '社交費總額', '禮品費總額', '行李費總額', '手續費總額', '日支費總額', '午餐與學費總額', '其他費用總額'];

      const parseSecureNum = (val) => {
          if (val === undefined || val === null || val === '') return 0;
          if (typeof val === 'number') return isNaN(val) ? 0 : val;
          const cleaned = String(val).replace(/[^\d.-]/g, '');
          const n = Number(cleaned);
          return isNaN(n) ? 0 : n;
      };

      sumColsPersonal.forEach(c => {
          let idx = findCol(c);
          if (idx > -1) totalPersonalTWD += parseSecureNum(rowData[idx]);
      });
      sumColsOverall.forEach(c => {
          let idx = findCol(c);
          if (idx > -1) totalOverallTWD += parseSecureNum(rowData[idx]);
      });
      
      const currencyCol = findCol('支付幣別');
      let paymentCurrency = 'TWD';
      if (currencyCol > -1) {
          let val = rowData[currencyCol];
          if (val) paymentCurrency = val;
      }
      
      let allDates = [];
      let diffDays = 0;
      let endDateStr = '';
      const doDateCalc = (!triggerCategory || triggerCategory === 'Flight');

      if (doDateCalc) {
          try {
              const myFlights = myItemsMap['Flight'];
              if (myFlights) {
                  myFlights.forEach(item => {
                      const parseDateStr = (dateVal) => {
                          let dateObj = null;
                          if (dateVal instanceof Date) return dateVal;
                          if (typeof dateVal === 'string') {
                              dateObj = new Date(dateVal.replace(/-/g, '/'));
                          }
                          return dateObj;
                      };
                      if (item['日期']) {
                          let obj = parseDateStr(item['日期']);
                          if (obj && !isNaN(obj.getTime())) allDates.push(obj.getTime());
                      }
                      if (item['行程類型'] === 'round-trip' && item['回程日期']) {
                          let objRet = parseDateStr(item['回程日期']);
                          if (objRet && !isNaN(objRet.getTime())) allDates.push(objRet.getTime());
                      }
                  });
              }
          } catch(e) {}
      } else {
          const cachedStartCol = findCol('商旅起始日');
          if (cachedStartCol > -1) {
               let val = String(rowData[cachedStartCol]);
               if (rowData[cachedStartCol] instanceof Date) {
                   const d = rowData[cachedStartCol];
                   val = d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
               }
               if (val) startDateStr = val;
          }
      }
      
      if (allDates.length > 0) {
          const minDate = new Date(Math.min(...allDates));
          const maxDate = new Date(Math.max(...allDates));
          
          const formatDate = (date) => date.getFullYear() + '/' + String(date.getMonth() + 1).padStart(2, '0') + '/' + String(date.getDate()).padStart(2, '0');
          
          startDateStr = formatDate(minDate);
          endDateStr = formatDate(maxDate);
          
          const utc1 = Date.UTC(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
          const utc2 = Date.UTC(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
          diffDays = Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24)) + 1;
      }

      const colDays = findCol('商旅天數');
      const colStart = findCol('商旅起始日');
      const colEnd = findCol('商旅結束日');
      
      if (doDateCalc) {
          if (colDays > -1) rowData[colDays] = (diffDays > 0 ? diffDays : 0);
          if (colStart > -1) rowData[colStart] = startDateStr;
          if (colEnd > -1) rowData[colEnd] = endDateStr;
      } else {
          if (colDays > -1) {
              const existingDays = Number(rowData[colDays]);
              diffDays = isNaN(existingDays) ? 0 : existingDays;
          }
      }

      const colTotalPersonalTWD = findCol('合計TWD個人總額');
      if (colTotalPersonalTWD > -1) rowData[colTotalPersonalTWD] = totalPersonalTWD;
      
      const colTotalOverallTWD = findCol('合計TWD總體總額');
      if (colTotalOverallTWD > -1) rowData[colTotalOverallTWD] = totalOverallTWD;

      let totalPersonalUSD = 0;
      let totalOverallUSD = 0;
      
      const sumColsPersonalUSD = sumColsPersonal.map(n => n.replace('總額', 'USD總額'));
      const sumColsOverallUSD = sumColsOverall.map(n => n.replace('總額', 'USD總額'));

      // Use native USD if tracked, else fallback to TWD/rate
      sumColsPersonalUSD.forEach((c, i) => {
          let idx = findCol(c);
          if (idx > -1) totalPersonalUSD += parseSecureNum(rowData[idx]);
          else {
              let sibIdx = findCol(sumColsPersonal[i]);
              if (sibIdx > -1) totalPersonalUSD += parseSecureNum(rowData[sibIdx]) / rate;
          }
      });
      
      sumColsOverallUSD.forEach((c, i) => {
          let idx = findCol(c);
          if (idx > -1) totalOverallUSD += parseSecureNum(rowData[idx]);
          else {
              let sibIdx = findCol(sumColsOverall[i]);
              if (sibIdx > -1) totalOverallUSD += parseSecureNum(rowData[sibIdx]) / rate;
          }
      });
      
      const colTotalPersonalUSD = findCol('合計USD個人總額');
      if (colTotalPersonalUSD > -1) rowData[colTotalPersonalUSD] = totalPersonalUSD;
      
      const colTotalOverallUSD = findCol('合計USD總體總額');
      if (colTotalOverallUSD > -1) rowData[colTotalOverallUSD] = totalOverallUSD;
      
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
      if (colAvgPersonalTWD > -1) rowData[colAvgPersonalTWD] = avgPersonalTWD;
      
      const colAvgOverallTWD = findCol('合計TWD總體平均');
      if (colAvgOverallTWD > -1) rowData[colAvgOverallTWD] = avgOverallTWD;
      
      const colAvgPersonalUSD = findCol('合計USD個人平均');
      if (colAvgPersonalUSD > -1) rowData[colAvgPersonalUSD] = avgPersonalUSD;
      
      const colAvgOverallUSD = findCol('合計USD總體平均');
      if (colAvgOverallUSD > -1) rowData[colAvgOverallUSD] = avgOverallUSD;
      
      if (diffDays === 0) {
          const resetCols = ['合計TWD個人平均', '合計TWD總體平均', '合計USD個人平均', '合計USD總體平均'];
          resetCols.forEach(colName => {
              const cIdx = findCol(colName);
              if (cIdx > -1) rowData[cIdx] = 0;
          });
      }
      
      const expandedRange = headerSheet.getRange(rowIndex, 1, 1, headers.length);
      expandedRange.setValues([rowData]);
      invalidateCache('Report Header'); // Fix stale cache ghosting!
    
    return startDateStr;
}

/**
 * Updates Exchange Rate and Recalculates all dependent TWD amounts based on Trip Start Date
 */
function updateAllExchangeRates(reportId, startDateStr, targetCategory = null, forceHeaderRateUpdate = false) {
    if (!startDateStr || startDateStr === '-') return;

    // Gather existing rate so we don't aggressively poll external APIs on minor item edits
    const headerSheet = getSheet('Report Header');
    const headerData = headerSheet.getDataRange().getValues();
    let headerRowIndex = -1;
    let existingUsdRate = 1.0;
    for (let i = 1; i < headerData.length; i++) {
        if (String(headerData[i][0]) === String(reportId)) {
            headerRowIndex = i + 1; 
            const rateCol = headerData[0].indexOf('USD匯率');
            if (rateCol > -1) {
                const val = Number(headerData[i][rateCol]);
                if (val > 0) existingUsdRate = val;
            }
            break;
        }
    }

    // Cache to prevent multiple BOT API calls for the same currency
    const rateCache = { 'TWD': 1.0 }; 
    if (!forceHeaderRateUpdate) {
        rateCache['USD'] = existingUsdRate; // Short-circuit external poll if date hasn't changed
    }
    
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

    let categories = ['Flight', 'Accommodation', 'Rental Car', 'Taxi', 'Gas', 'Parking', 'Internet', 'Social', 'Gift', 'Luggage Fee', 'Handing Fee', 'Per Diem', 'Advance Payment', 'Lunch & Learn', 'Others'];
    
    if (targetCategory) {
        categories = [targetCategory]; // Restrict target
    }
    
    categories.forEach(cat => {
        try {
            // Check cache upstream to completely avoid reading empty sheets physically
            const cachedJson = sheetDataToJson(cat);
            const hasItems = cachedJson.some(row => String(row['報告編號']) === String(reportId));
            if (!hasItems) return; // INSTANT SKIP
            
            const sheet = getSheet(cat);
            if (!sheet) return;
            const rawValues = sheet.getDataRange().getValues();
            if (rawValues.length <= 1) return;
            
            const sheetHeaders = rawValues[0];
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
            
            let hasChanges = false;
            for (let i = 1; i < rawValues.length; i++) {
                 if (String(rawValues[i][idxId]) === String(reportId)) {
                     const currency = String(rawValues[i][idxCurrency]).trim().toUpperCase();
                     
                     if (currency !== 'TWD' && currency !== '') {
                         const rowRate = getRate(currency);
                         
                         if (idxRate > -1) {
                             rawValues[i][idxRate] = rowRate;
                             hasChanges = true;
                         }
                         
                         if (cat === 'Accommodation' || cat === 'Rental Car') {
                             if (idxPersonal > -1 && idxTwdPersonal > -1) {
                                 const val = Number(String(rawValues[i][idxPersonal]).replace(/[^\d.-]/g, '')) || 0;
                                 rawValues[i][idxTwdPersonal] = Math.round(val * rowRate);
                                 hasChanges = true;
                             }
                             if (idxAdvance > -1 && idxTwdAdvance > -1) {
                                 const val = Number(String(rawValues[i][idxAdvance]).replace(/[^\d.-]/g, '')) || 0;
                                 rawValues[i][idxTwdAdvance] = Math.round(val * rowRate);
                                 hasChanges = true;
                             }
                             if (idxOverall > -1 && idxTwdOverall > -1) {
                                 const val = Number(String(rawValues[i][idxOverall]).replace(/[^\d.-]/g, '')) || 0;
                                 rawValues[i][idxTwdOverall] = Math.round(val * rowRate);
                                 hasChanges = true;
                             }
                         } else {
                             // Normal forms
                             if (idxAmount > -1 && idxTwdAmount > -1) {
                                 const val = Number(String(rawValues[i][idxAmount]).replace(/[^\d.-]/g, '')) || 0;
                                 rawValues[i][idxTwdAmount] = Math.round(val * rowRate);
                                 hasChanges = true;
                             }
                         }
                     }
                 }
            }
            if (hasChanges) {
                // Bulk write back to sheet natively
                sheet.getRange(1, 1, rawValues.length, sheetHeaders.length).setValues(rawValues);
                invalidateCache(cat);
            }
        } catch(e) {
            Logger.log('Error updating rates for ' + cat + ': ' + e);
        }
    });

    // 2. Update Header Rate (USD is the primary reference)
    const newUsdRate = getRate('USD');
    
    if (headerRowIndex > -1 && forceHeaderRateUpdate) {
        const headers = headerData[0];
        const rateCol = headers.indexOf('USD匯率');
        if (rateCol > -1) {
            headerSheet.getRange(headerRowIndex, rateCol + 1).setValue(newUsdRate);
            invalidateCache('Report Header');
        }
    }
}
