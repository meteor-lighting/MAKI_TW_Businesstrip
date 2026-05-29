/**
 * 終極重算與匯率自動同步引擎 Calculation.gs
 * 每筆明細皆依據「該筆差旅日期前一天」的台灣銀行即期匯率「本本行賣出」進行換算。
 */

function addReportItem(payload) {
  const { reportId, category, itemData } = payload;
  if (!reportId) return { status: 'error', message: 'Missing reportId' };
  if (!category) return { status: 'error', message: 'Missing category' };
  if (!itemData) return { status: 'error', message: 'Missing itemData' };
  
  const lock = LockService.getScriptLock();
  if (lock.tryLock(20000)) {
    try {
      const sheetName = getResolvedSheetName(category);
      const sheet = getSheet(sheetName);
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      // 計算次序
      const seqIdx = headers.indexOf('次序');
      const repIdx = headers.indexOf('報告編號');
      let maxSeq = 0;
      if (seqIdx !== -1 && repIdx !== -1) {
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][repIdx]) === String(reportId)) {
            const seq = parseInt(data[i][seqIdx], 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          }
        }
      }
      const newSeq = maxSeq + 1;
      
      // 財務規則：使用每筆明細「該筆差旅日期前一天」作為匯率查詢日期
      const rateQueryDate = getItemDateMinusOneDay(category, itemData, reportId);
      
      // 自動獲取匯率 (支援所有外幣，調用台灣銀行即期賣出匯率)
      let rate = 1.0;
      if (itemData['幣別'] && itemData['幣別'] !== 'TWD') {
        try {
          const rateResult = getExchangeRate({ currency: itemData['幣別'], date: rateQueryDate });
          if (rateResult && rateResult.status === 'success') {
            rate = parseFloat(rateResult.rate) || 1.0;
          }
        } catch (e) {
          console.warn('Failed to fetch bot rate, using fallback', e);
        }
      }
      
      // 寫入資料行準備
      const row = new Array(headers.length).fill('');
      headers.forEach((h, i) => {
        if (h === '報告編號') row[i] = reportId;
        else if (h === '次序') row[i] = newSeq;
        else if (h === '建立時間' || h === '最後修改時間') {
          row[i] = new Date();
        } else if (h === '匯率') {
          row[i] = rate;
        } else if (h === '總體金額') {
          const overall = parseFloat(itemData['總體金額']) || 0;
          if (overall === 0) {
            const p = parseFloat(itemData['個人金額']) || 0;
            const d = parseFloat(itemData['代墊金額']) || 0;
            row[i] = p + d;
          } else {
            row[i] = overall;
          }
        } else if (itemData[h] !== undefined) {
          let val = itemData[h];
          if (h === '日期' || h === '回程日期' || h === '入住日期' || h === '退房日期' || h === '借車日期' || h === '還車日期' || h === '開始日期' || h === '結束日期') {
            if (val && String(val).trim() !== '') {
              const d = new Date(val);
              if (!isNaN(d.getTime())) {
                val = d;
              }
            }
          }
          row[i] = val;
        }
      });
      
      // 後端先行完成 TWD 台幣折算
      const personalIdx = headers.indexOf('個人金額');
      const overallIdx = headers.indexOf('總體金額');
      const advanceIdx = headers.indexOf('代墊金額');
      const amountIdx = headers.indexOf('金額');
      
      const twdPersonalIdx = headers.indexOf('TWD個人金額');
      const twdOverallIdx = headers.indexOf('TWD總體金額');
      const twdAdvanceIdx = headers.indexOf('TWD代墊金額');
      const twdAmountIdx = headers.indexOf('TWD金額');
      const ppDayIdx = headers.indexOf('每人每天金額');
      
      const rateVal = rate;
      
      if (amountIdx !== -1 && twdAmountIdx !== -1) {
        const amt = parseFloat(itemData['金額']) || 0;
        row[twdAmountIdx] = Math.round(amt * rateVal);
      }
      
      if (personalIdx !== -1 && twdPersonalIdx !== -1) {
        const amt = parseFloat(itemData['個人金額']) || 0;
        row[twdPersonalIdx] = Math.round(amt * rateVal);
      }
      
      if (advanceIdx !== -1 && twdAdvanceIdx !== -1) {
        const amt = parseFloat(itemData['代墊金額']) || 0;
        row[twdAdvanceIdx] = Math.round(amt * rateVal);
      }
      
      if (overallIdx !== -1 && twdOverallIdx !== -1) {
        const amt = parseFloat(row[overallIdx]) || 0;
        row[twdOverallIdx] = Math.round(amt * rateVal);
      }

      // 住宿與租車的每人每日均分金額
      if (ppDayIdx !== -1) {
        const people = parseInt(itemData['代墊人數']) || 1;
        const overallAmount = overallIdx !== -1 ? (parseFloat(row[overallIdx]) || 0) : (parseFloat(itemData['個人金額']) || 0);
        const checkInIdx = headers.indexOf('入住日期') !== -1 ? headers.indexOf('入住日期') : headers.indexOf('借車日期');
        const checkOutIdx = headers.indexOf('退房日期') !== -1 ? headers.indexOf('退房日期') : headers.indexOf('還車日期');
        
        let days = 1;
        if (checkInIdx !== -1 && checkOutIdx !== -1 && itemData[headers[checkInIdx]] && itemData[headers[checkOutIdx]]) {
          try {
            const dIn = new Date(itemData[headers[checkInIdx]]);
            const dOut = new Date(itemData[headers[checkOutIdx]]);
            if (!isNaN(dIn.getTime()) && !isNaN(dOut.getTime())) {
              const diffTime = Math.abs(dOut.getTime() - dIn.getTime());
              days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
            }
          } catch(e) {}
        }
        
        row[ppDayIdx] = Number((overallAmount / people / days).toFixed(2));
      }
      
      sheet.appendRow(row);
      SpreadsheetApp.flush();
      
      // 全局累加計算並寫入 Report Header
      recalculateHeader(reportId, category);
      invalidateCache(category);
      
      return { status: 'success', message: 'Item added successfully' };
    } catch (e) {
      return { status: 'error', message: e.toString() };
    } finally {
      lock.releaseLock();
    }
  } else {
    return { status: 'error', message: 'Database busy' };
  }
}

function updateReportItem(payload) {
  const { reportId, category, sequence, itemData } = payload;
  if (!reportId) return { status: 'error', message: 'Missing reportId' };
  if (!category) return { status: 'error', message: 'Missing category' };
  if (sequence === undefined) return { status: 'error', message: 'Missing sequence' };
  if (!itemData) return { status: 'error', message: 'Missing itemData' };
  
  const lock = LockService.getScriptLock();
  if (lock.tryLock(20000)) {
    try {
      const sheetName = getResolvedSheetName(category);
      const sheet = getSheet(sheetName);
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      const repIdx = headers.indexOf('報告編號');
      const seqIdx = headers.indexOf('次序');
      
      if (repIdx === -1 || seqIdx === -1) {
        return { status: 'error', message: 'Headers invalid' };
      }
      
      let targetRowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][repIdx]) === String(reportId) && String(data[i][seqIdx]) === String(sequence)) {
          targetRowIndex = i + 1;
          break;
        }
      }
      
      if (targetRowIndex === -1) {
        return { status: 'error', message: 'Target item not found for update' };
      }
      
      // 財務規則：使用每筆明細「該筆差旅日期前一天」作為匯率查詢日期
      const rateQueryDate = getItemDateMinusOneDay(category, itemData, reportId);
      
      // 自動獲取匯率 (支援所有幣別)
      let rate = 1.0;
      if (itemData['幣別'] && itemData['幣別'] !== 'TWD') {
        try {
          const rateResult = getExchangeRate({ currency: itemData['幣別'], date: rateQueryDate });
          if (rateResult && rateResult.status === 'success') {
            rate = parseFloat(rateResult.rate) || 1.0;
          }
        } catch (e) {
          console.warn('Failed to fetch bot rate, using fallback', e);
        }
      }
      
      const updatedRow = [...data[targetRowIndex - 1]];
      headers.forEach((h, i) => {
        if (h === '報告編號' || h === '次序' || h === '建立時間') {
          // Keep intact
        } else if (h === '最後修改時間') {
          updatedRow[i] = new Date();
        } else if (h === '匯率') {
          updatedRow[i] = rate;
        } else if (h === '總體金額') {
          const overall = parseFloat(itemData['總體金額']) || 0;
          if (overall === 0) {
            const p = parseFloat(itemData['個人金額']) || 0;
            const d = parseFloat(itemData['代墊金額']) || 0;
            updatedRow[i] = p + d;
          } else {
            updatedRow[i] = overall;
          }
        } else if (itemData[h] !== undefined) {
          let val = itemData[h];
          if (h === '日期' || h === '回程日期' || h === '入住日期' || h === '退房日期' || h === '借車日期' || h === '還車日期' || h === '開始日期' || h === '結束日期') {
            if (val && String(val).trim() !== '') {
              const d = new Date(val);
              if (!isNaN(d.getTime())) {
                val = d;
              }
            }
          }
          updatedRow[i] = val;
        }
      });
      
      // 後端重算 TWD 金額
      const personalIdx = headers.indexOf('個人金額');
      const overallIdx = headers.indexOf('總體金額');
      const advanceIdx = headers.indexOf('代墊金額');
      const amountIdx = headers.indexOf('金額');
      
      const twdPersonalIdx = headers.indexOf('TWD個人金額');
      const twdOverallIdx = headers.indexOf('TWD總體金額');
      const twdAdvanceIdx = headers.indexOf('TWD代墊金額');
      const twdAmountIdx = headers.indexOf('TWD金額');
      const ppDayIdx = headers.indexOf('每人每天金額');
      
      const rateVal = rate;
      
      if (amountIdx !== -1 && twdAmountIdx !== -1) {
        const amt = parseFloat(itemData['金額']) || 0;
        updatedRow[twdAmountIdx] = Math.round(amt * rateVal);
      }
      
      if (personalIdx !== -1 && twdPersonalIdx !== -1) {
        const amt = parseFloat(itemData['個人金額']) || 0;
        updatedRow[twdPersonalIdx] = Math.round(amt * rateVal);
      }
      
      if (advanceIdx !== -1 && twdAdvanceIdx !== -1) {
        const amt = parseFloat(itemData['代墊金額']) || 0;
        updatedRow[twdAdvanceIdx] = Math.round(amt * rateVal);
      }
      
      if (overallIdx !== -1 && twdOverallIdx !== -1) {
        const amt = parseFloat(updatedRow[overallIdx]) || 0;
        updatedRow[twdOverallIdx] = Math.round(amt * rateVal);
      }

      // 住宿與租車的每人每日均分金額
      if (ppDayIdx !== -1) {
        const people = parseInt(itemData['代墊人數']) || 1;
        const overallAmount = overallIdx !== -1 ? (parseFloat(updatedRow[overallIdx]) || 0) : (parseFloat(itemData['個人金額']) || 0);
        const checkInIdx = headers.indexOf('入住日期') !== -1 ? headers.indexOf('入住日期') : headers.indexOf('借車日期');
        const checkOutIdx = headers.indexOf('退房日期') !== -1 ? headers.indexOf('退房日期') : headers.indexOf('還車日期');
        
        let days = 1;
        if (checkInIdx !== -1 && checkOutIdx !== -1 && itemData[headers[checkInIdx]] && itemData[headers[checkOutIdx]]) {
          try {
            const dIn = new Date(itemData[headers[checkInIdx]]);
            const dOut = new Date(itemData[headers[checkOutIdx]]);
            if (!isNaN(dIn.getTime()) && !isNaN(dOut.getTime())) {
              const diffTime = Math.abs(dOut.getTime() - dIn.getTime());
              days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
            }
          } catch(e) {}
        }
        
        updatedRow[ppDayIdx] = Number((overallAmount / people / days).toFixed(2));
      }
      
      sheet.getRange(targetRowIndex, 1, 1, headers.length).setValues([updatedRow]);
      SpreadsheetApp.flush();
      
      // 全局累加計算並寫入 Report Header
      recalculateHeader(reportId, category);
      invalidateCache(category);
      
      return { status: 'success', message: 'Item updated successfully' };
    } catch (e) {
      return { status: 'error', message: e.toString() };
    } finally {
      lock.releaseLock();
    }
  } else {
    return { status: 'error', message: 'Database busy' };
  }
}

function deleteReportItem(payload) {
  const { reportId, category, sequence } = payload;
  if (!reportId || !category || sequence === undefined) {
    return { status: 'error', message: 'Missing parameters' };
  }
  
  const lock = LockService.getScriptLock();
  if (lock.tryLock(20000)) {
    try {
      const sheetName = getResolvedSheetName(category);
      const sheet = getSheet(sheetName);
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      const repIdx = headers.indexOf('報告編號');
      const seqIdx = headers.indexOf('次序');
      
      if (repIdx === -1 || seqIdx === -1) {
        return { status: 'error', message: 'Headers invalid' };
      }
      
      let targetRowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][repIdx]) === String(reportId) && String(data[i][seqIdx]) === String(sequence)) {
          targetRowIndex = i + 1;
          break;
        }
      }
      
      if (targetRowIndex !== -1) {
        sheet.deleteRow(targetRowIndex);
        SpreadsheetApp.flush();
        
        recalculateHeader(reportId, category);
        invalidateCache(category);
      }
      
      return { status: 'success', message: 'Item deleted successfully' };
    } catch (e) {
      return { status: 'error', message: e.toString() };
    } finally {
      lock.releaseLock();
    }
  } else {
    return { status: 'error', message: 'Database busy' };
  }
}

function recalculateHeader(reportId, category) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const headerSheet = ss.getSheetByName('Report Header');
  const headerData = headerSheet.getDataRange().getValues();
  const headers = headerData[0];
  
  const idIdx = headers.indexOf('報告編號');
  if (idIdx === -1) return;
  
  let targetRowIndex = -1;
  for (let i = 1; i < headerData.length; i++) {
    if (String(headerData[i][idIdx]) === String(reportId)) {
      targetRowIndex = i + 1;
      break;
    }
  }
  
  if (targetRowIndex === -1) return;
  
  let rowData = headerData[targetRowIndex - 1];
  
  // 1. 自動從機票段 (Flight) 的日期帶入商旅起始日、商旅結束日、商旅天數
  try {
    const flightItems = sheetDataToJson('Flight', ss, true).filter(r => String(r['報告編號']) === String(reportId));
    let dates = [];
    flightItems.forEach(item => {
      if (item['日期']) {
        const d = new Date(item['日期']);
        if (!isNaN(d.getTime())) dates.push(d);
      }
      if (item['行程類型'] === 'round-trip' && item['回程日期']) {
        const d = new Date(item['回程日期']);
        if (!isNaN(d.getTime())) dates.push(d);
      }
    });
    
    if (dates.length > 0) {
      dates.sort((a, b) => a.getTime() - b.getTime());
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];
      
      const yyyyMin = minDate.getFullYear();
      const mmMin = String(minDate.getMonth() + 1).padStart(2, '0');
      const ddMin = String(minDate.getDate()).padStart(2, '0');
      const minDateStr = `${yyyyMin}/${mmMin}/${ddMin}`;
      
      const yyyyMax = maxDate.getFullYear();
      const mmMax = String(maxDate.getMonth() + 1).padStart(2, '0');
      const ddMax = String(maxDate.getDate()).padStart(2, '0');
      const maxDateStr = `${yyyyMax}/${mmMax}/${ddMax}`;
      
      const diffTime = Math.abs(maxDate.getTime() - minDate.getTime());
      const autoDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      const startIdx = headers.indexOf('商旅起始日');
      const endIdx = headers.indexOf('商旅結束日');
      const daysIdx = headers.indexOf('商旅天數');
      
      if (startIdx !== -1) {
        headerSheet.getRange(targetRowIndex, startIdx + 1).setValue(minDateStr);
        rowData[startIdx] = minDateStr;
      }
      if (endIdx !== -1) {
        headerSheet.getRange(targetRowIndex, endIdx + 1).setValue(maxDateStr);
        rowData[endIdx] = maxDateStr;
      }
      if (daysIdx !== -1) {
        headerSheet.getRange(targetRowIndex, daysIdx + 1).setValue(autoDays);
        rowData[daysIdx] = autoDays;
      }
      
      // 同步批次重算所有明細的外幣匯率（每筆明細會依據該筆自己的差旅日期前一天重算！）
      updateAllExchangeRates(reportId);
    }
  } catch(e) {
    console.error('Failed to auto-populate dates from flight info', e);
  }
  
  // Calculate Business Trip Days
  const startIdx = headers.indexOf('商旅起始日');
  const endIdx = headers.indexOf('商旅結束日');
  const daysIdx = headers.indexOf('商旅天數');
  
  let days = parseFloat(rowData[daysIdx]) || 0;
  if (days === 0 && startIdx !== -1 && endIdx !== -1 && rowData[startIdx] && rowData[endIdx]) {
    try {
      const dStart = new Date(rowData[startIdx]);
      const dEnd = new Date(rowData[endIdx]);
      if (!isNaN(dStart.getTime()) && !isNaN(dEnd.getTime())) {
        const diffTime = Math.abs(dEnd.getTime() - dStart.getTime());
        days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
        if (daysIdx !== -1) {
          headerSheet.getRange(targetRowIndex, daysIdx + 1).setValue(days);
        }
      }
    } catch(e) {}
  }
  
  // 2. Calculate Grand Totals and Individual Category Totals
  const categories = ['Flight', 'Accommodation', 'Rental Car', 'Transportation', 'Gas', 'Parking', 'Internet', 'Social', 'Gift', 'Luggage Fee', 'Handing Fee', 'Per Diem', 'Lunch & Learn', 'Others'];
  let grandTotalTWD = 0;
  let personalTotalTWD = 0;
  let advanceTotalTWD = 0;
  
  let catTotals = {
    'Flight': 0,
    'AccommodationPersonal': 0,
    'AccommodationOverall': 0,
    'RentalCarPersonal': 0,
    'RentalCarOverall': 0,
    'Transportation': 0,
    'Gas': 0,
    'Parking': 0,
    'Internet': 0,
    'Social': 0,
    'Gift': 0,
    'Luggage Fee': 0,
    'Handing Fee': 0,
    'Per Diem': 0,
    'Lunch & Learn': 0,
    'Others': 0
  };
  
  categories.forEach(cat => {
    try {
      const items = sheetDataToJson(cat, ss, true).filter(r => String(r['報告編號']) === String(reportId));
      items.forEach(item => {
        const twdVal = parseFloat(item['TWD金額'] || 0);
        const pTVal = parseFloat(item['TWD個人金額'] || item['TWD個人'] || 0);
        const oTVal = parseFloat(item['TWD總體金額'] || item['TWD總額'] || item['TWD總額TWD'] || 0);
        
        if (cat === 'Accommodation') {
          grandTotalTWD += oTVal;
          personalTotalTWD += pTVal;
          catTotals['AccommodationOverall'] += oTVal;
          catTotals['AccommodationPersonal'] += pTVal;
        } else if (cat === 'Rental Car') {
          grandTotalTWD += oTVal;
          personalTotalTWD += pTVal;
          catTotals['RentalCarOverall'] += oTVal;
          catTotals['RentalCarPersonal'] += pTVal;
        } else if (cat === 'Advance Payment') {
          // Pre-paid advances
        } else {
          grandTotalTWD += twdVal;
          personalTotalTWD += twdVal;
          catTotals[cat] += twdVal;
        }
      });
    } catch(e) {}
  });
  
  // Calculate Advance Payments separately
  try {
    const advItems = sheetDataToJson('Advance Payment', ss, true).filter(r => String(r['報告編號']) === String(reportId));
    advItems.forEach(item => {
      advanceTotalTWD += parseFloat(item['TWD金額'] || 0);
    });
  } catch(e) {}
  
  const rateUSDIdx = headers.indexOf('USD匯率');
  const rateUSD = parseFloat(rowData[rateUSDIdx]) || 30.0; // fallback default
  
  const overallTWDIdx = headers.indexOf('合計TWD總體總額');
  const personalTWDIdx = headers.indexOf('合計TWD個人總額');
  const avgTWDIdx = headers.indexOf('合計TWD總體平均');
  
  const overallUSDIdx = headers.indexOf('合計USD總體總額');
  const personalUSDIdx = headers.indexOf('合計USD個人總額');
  const avgUSDIdx = headers.indexOf('合計USD總體平均');
  
  const advanceTWDIdx = headers.indexOf('預支費用總額');
  
  // 3. Write back Category Totals (TWD and USD)
  const catFieldMap = {
    '機票費總額': catTotals['Flight'],
    '個人住宿費總額': catTotals['AccommodationPersonal'],
    '總體住宿費總額': catTotals['AccommodationOverall'],
    '個人租車費總額': catTotals['RentalCarPersonal'],
    '總體租車費總額': catTotals['RentalCarOverall'],
    '交通運輸費總額': catTotals['Transportation'],
    '瓦斯費總額': catTotals['Gas'],
    '停車費總額': catTotals['Parking'],
    '網路費總額': catTotals['Internet'],
    '社交費總額': catTotals['Social'],
    '禮品費總額': catTotals['Gift'],
    '行李費總額': catTotals['Luggage Fee'],
    '手續費總額': catTotals['Handing Fee'],
    '日支費總額': catTotals['Per Diem'],
    '午餐與學費總額': catTotals['Lunch & Learn'],
    '其他費用總額': catTotals['Others']
  };
  
  for (let key in catFieldMap) {
    const idx = headers.indexOf(key);
    if (idx !== -1) {
      headerSheet.getRange(targetRowIndex, idx + 1).setValue(Number((catFieldMap[key] || 0).toFixed(2)));
    }
  }
  
  const catUSDFieldMap = {
    '機票費USD總額': catTotals['Flight'] / rateUSD,
    '個人住宿費USD總額': catTotals['AccommodationPersonal'] / rateUSD,
    '總體住宿費USD總額': catTotals['AccommodationOverall'] / rateUSD,
    '個人租車費USD總額': catTotals['RentalCarPersonal'] / rateUSD,
    '總體租車費USD總額': catTotals['RentalCarOverall'] / rateUSD,
    '交通運輸費USD總額': catTotals['Transportation'] / rateUSD,
    '瓦斯費USD總額': catTotals['Gas'] / rateUSD,
    '停車費USD總額': catTotals['Parking'] / rateUSD,
    '網路費USD總額': catTotals['Internet'] / rateUSD,
    '社交費USD總額': catTotals['Social'] / rateUSD,
    '禮品費USD總額': catTotals['Gift'] / rateUSD,
    '行李費USD總額': catTotals['Luggage Fee'] / rateUSD,
    '手續費USD總額': catTotals['Handing Fee'] / rateUSD,
    '日支費USD總額': catTotals['Per Diem'] / rateUSD,
    '午餐與學費USD總額': catTotals['Lunch & Learn'] / rateUSD,
    '其他費用USD總額': catTotals['Others'] / rateUSD
  };
  
  for (let key in catUSDFieldMap) {
    const idx = headers.indexOf(key);
    if (idx !== -1) {
      headerSheet.getRange(targetRowIndex, idx + 1).setValue(Number((catUSDFieldMap[key] || 0).toFixed(2)));
    }
  }
  
  // 4. 動態收集並同步有使用到的外幣匯率至 Report Header
  try {
    let usedCurrencies = new Set();
    categories.forEach(cat => {
      try {
        const items = sheetDataToJson(cat, ss, true).filter(r => String(r['報告編號']) === String(reportId));
        items.forEach(item => {
          if (item['幣別'] && String(item['幣別']).toUpperCase() !== 'TWD' && String(item['幣別']).toUpperCase() !== '') {
            usedCurrencies.add(String(item['幣別']).toUpperCase());
          }
        });
      } catch(e) {}
    });
    
    let queryDate = '';
    if (startIdx !== -1 && rowData[startIdx]) {
      const dStart = new Date(rowData[startIdx]);
      if (!isNaN(dStart.getTime())) {
        dStart.setDate(dStart.getDate() - 1);
        queryDate = Utilities.formatDate(dStart, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
    }
    if (!queryDate) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      queryDate = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    
    usedCurrencies.forEach(currency => {
      try {
        let matchedRate = null;
        // 遍歷所有分類明細，尋找該幣別最新一筆明細的匯率數值，作為前端大卡片展示的即期本行賣出匯率
        for (let cat of categories) {
          const items = sheetDataToJson(cat, ss, true).filter(r => String(r['報告編號']) === String(reportId) && String(r['幣別']).toUpperCase() === currency);
          if (items.length > 0) {
            const firstWithRate = items.find(item => parseFloat(item['匯率']) > 0);
            if (firstWithRate) {
              matchedRate = parseFloat(firstWithRate['匯率']);
              break;
            }
          }
        }
        
        // 如果明細中沒找到有匯率的（例如剛新增），才去查起始日前一天的匯率
        if (matchedRate === null) {
          const rateResult = getExchangeRate({ currency: currency, date: queryDate });
          if (rateResult && rateResult.status === 'success') {
            matchedRate = parseFloat(rateResult.rate) || 1.0;
          }
        }
        
        if (matchedRate !== null) {
          const colName = `${currency}匯率`;
          
          let colIdx = headers.indexOf(colName);
          if (colIdx === -1) {
            // 動態追加欄位！
            const newColNum = headers.length + 1;
            headerSheet.getRange(1, newColNum).setValue(colName);
            headers.push(colName); 
            rowData.push('');      
            colIdx = headers.length - 1;
          }
          
          headerSheet.getRange(targetRowIndex, colIdx + 1).setValue(Number(matchedRate.toFixed(4)));
          rowData[colIdx] = matchedRate;
        }
      } catch(e) {
        console.warn(`Failed to process dynamic rate for ${currency}`, e);
      }
    });
  } catch(e) {
    console.error('Failed to auto sync used currencies to header', e);
  }
  
  // 5. Apply Overall update to Report Header cells
  if (overallTWDIdx !== -1) headerSheet.getRange(targetRowIndex, overallTWDIdx + 1).setValue(Math.round(grandTotalTWD));
  if (personalTWDIdx !== -1) headerSheet.getRange(targetRowIndex, personalTWDIdx + 1).setValue(Math.round(personalTotalTWD));
  if (avgTWDIdx !== -1) headerSheet.getRange(targetRowIndex, avgTWDIdx + 1).setValue(Math.round(days > 0 ? grandTotalTWD / days : grandTotalTWD));
  
  if (overallUSDIdx !== -1) headerSheet.getRange(targetRowIndex, overallUSDIdx + 1).setValue(Number((grandTotalTWD / rateUSD).toFixed(2)));
  if (personalUSDIdx !== -1) headerSheet.getRange(targetRowIndex, personalUSDIdx + 1).setValue(Number((personalTotalTWD / rateUSD).toFixed(2)));
  if (avgUSDIdx !== -1) headerSheet.getRange(targetRowIndex, avgUSDIdx + 1).setValue(Number(((days > 0 ? grandTotalTWD / days : grandTotalTWD) / rateUSD).toFixed(2)));
  
  if (advanceTWDIdx !== -1) headerSheet.getRange(targetRowIndex, advanceTWDIdx + 1).setValue(Math.round(advanceTotalTWD));
  
  invalidateCache('Report Header');
}

function updateAllExchangeRates(reportId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const categories = ['Flight', 'Accommodation', 'Rental Car', 'Transportation', 'Gas', 'Parking', 'Internet', 'Social', 'Gift', 'Luggage Fee', 'Handing Fee', 'Per Diem', 'Lunch & Learn', 'Others', 'Advance Payment'];
    const fallbackDate = getTripStartDateMinusOneDay(reportId);
    
    categories.forEach(cat => {
      try {
        const sheet = ss.getSheetByName(cat);
        if (!sheet) return;
        
        const dataRange = sheet.getDataRange();
        const data = dataRange.getValues();
        if (data.length < 2) return;
        
        const headers = data[0];
        const repIdx = headers.indexOf('報告編號');
        const curIdx = headers.indexOf('幣別');
        const amtIdx = headers.indexOf('金額');
        const rateIdx = headers.indexOf('匯率');
        const twdIdx = headers.indexOf('TWD金額');
        
        // 尋找該分類對應的日期欄位
        let dateHeaderName = '日期';
        if (cat === 'Accommodation') dateHeaderName = '入住日期';
        else if (cat === 'Rental Car') dateHeaderName = '借車日期';
        else if (cat === 'Parking' || cat === 'Per Diem') dateHeaderName = '開始日期';
        
        const dateIdx = headers.indexOf(dateHeaderName);
        
        if (repIdx === -1 || curIdx === -1 || amtIdx === -1 || twdIdx === -1) return;
        
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][repIdx]) === String(reportId)) {
            const currency = String(data[i][curIdx]).toUpperCase();
            const amount = parseFloat(data[i][amtIdx]) || 0;
            
            // 依據財務規則，一律且強制自動取得出差開始日期前一天（fallbackDate）的匯率，不因個別發票或明細日期影響
            const queryDate = fallbackDate;
            
            let rate = 1.0;
            if (currency !== 'TWD' && currency !== '') {
              try {
                const rateResult = getExchangeRate({ currency: currency, date: queryDate });
                if (rateResult && rateResult.status === 'success') {
                  rate = parseFloat(rateResult.rate) || 1.0;
                }
              } catch(e) {
                console.warn('Failed to fetch rate inside updateAllExchangeRates', e);
              }
            }
            
            if (rateIdx !== -1) {
              sheet.getRange(i + 1, rateIdx + 1).setValue(rate);
            }
            sheet.getRange(i + 1, twdIdx + 1).setValue(Math.round(amount * rate));
            
            // 特殊加總折算
            if (cat === 'Accommodation' || cat === 'Rental Car') {
              const personalIdx = headers.indexOf('個人金額');
              const twdPersonalIdx = headers.indexOf('TWD個人金額');
              const overallIdx = headers.indexOf('總體金額');
              const twdOverallIdx = headers.indexOf('TWD總體金額');
              const advanceIdx = headers.indexOf('代墊金額');
              const twdAdvanceIdx = headers.indexOf('TWD代墊金額');
              
              if (personalIdx !== -1 && twdPersonalIdx !== -1) {
                const amt = parseFloat(data[i][personalIdx]) || 0;
                sheet.getRange(i + 1, twdPersonalIdx + 1).setValue(Math.round(amt * rate));
              }
              if (overallIdx !== -1 && twdOverallIdx !== -1) {
                const amt = parseFloat(data[i][overallIdx]) || 0;
                sheet.getRange(i + 1, twdOverallIdx + 1).setValue(Math.round(amt * rate));
              }
              if (advanceIdx !== -1 && twdAdvanceIdx !== -1) {
                const amt = parseFloat(data[i][advanceIdx]) || 0;
                sheet.getRange(i + 1, twdAdvanceIdx + 1).setValue(Math.round(amt * rate));
              }
            }
          }
        }
        
        invalidateCache(cat);
      } catch(e) {}
    });
  } catch (e) {
    console.error('Failed to update all exchange rates', e);
  }
}

function getTripStartDateMinusOneDay(reportId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const headerSheet = ss.getSheetByName('Report Header');
    const headerData = headerSheet.getDataRange().getValues();
    const headers = headerData[0];
    
    const repIdx = headers.indexOf('報告編號');
    const startIdx = headers.indexOf('商旅起始日');
    
    if (repIdx !== -1 && startIdx !== -1) {
      for (let i = 1; i < headerData.length; i++) {
        if (String(headerData[i][repIdx]) === String(reportId)) {
          const rawVal = headerData[i][startIdx];
          if (rawVal) {
            const d = new Date(rawVal);
            if (!isNaN(d.getTime())) {
              d.setDate(d.getDate() - 1);
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              return `${yyyy}-${mm}-${dd}`;
            }
          }
          break;
        }
      }
    }
  } catch (e) {
    console.error('Failed to get trip start date minus one day', e);
  }
  
  // Fallback to yesterday
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 輔助函數：取得每筆明細匯率查詢日期（依財務規則一律自動取得「出差開始日期/商旅起始日的前一天」，不受發票/明細日期影響）
function getItemDateMinusOneDay(category, itemData, reportId) {
  if (reportId) {
    const tripStartQuery = getTripStartDateMinusOneDay(reportId);
    if (tripStartQuery) return tripStartQuery;
  }
  
  // Fallback to yesterday
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
