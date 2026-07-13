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
      let rateResult = null;
      if (itemData['幣別'] && itemData['幣別'] !== 'TWD') {
        try {
          rateResult = getExchangeRate({ currency: itemData['幣別'], date: rateQueryDate });
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
        
        if (category === 'Accommodation') {
          const personalAmount = parseFloat(itemData['個人金額']) || 0;
          row[ppDayIdx] = Number((personalAmount / days).toFixed(2));
        } else {
          const people = parseInt(itemData['代墊人數']) || 1;
          const overallAmount = overallIdx !== -1 ? (parseFloat(row[overallIdx]) || 0) : (parseFloat(itemData['個人金額']) || 0);
          row[ppDayIdx] = Number((overallAmount / people / days).toFixed(2));
        }
      }
      
      console.log(
        `[匯率除錯 - 新增明細] 報告編號: ${reportId}, ` +
        `分類: ${category}, ` +
        `原始匯率基準日: ${rateQueryDate}, ` +
        `實際採用匯率日期: ${rateResult && rateResult.date ? rateResult.date : (itemData['幣別'] === 'TWD' ? 'TWD固定匯率' : 'Fallback')}, ` +
        `幣別: ${itemData['幣別'] || 'TWD'}, ` +
        `台銀資料欄位名稱: 即期匯率／本行賣出, ` +
        `取得的即期本行賣出匯率: ${rate}, ` +
        `原幣金額: ${itemData['金額'] || itemData['總體金額'] || 0}, ` +
        `換算後 TWD 金額: ${Math.round((parseFloat(itemData['金額'] || itemData['總體金額']) || 0) * rate)}`
      );

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
      let rateResult = null;
      if (itemData['幣別'] && itemData['幣別'] !== 'TWD') {
        try {
          rateResult = getExchangeRate({ currency: itemData['幣別'], date: rateQueryDate });
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
        
        if (category === 'Accommodation') {
          const personalAmount = parseFloat(itemData['個人金額']) || 0;
          updatedRow[ppDayIdx] = Number((personalAmount / days).toFixed(2));
        } else {
          const people = parseInt(itemData['代墊人數']) || 1;
          const overallAmount = overallIdx !== -1 ? (parseFloat(updatedRow[overallIdx]) || 0) : (parseFloat(itemData['個人金額']) || 0);
          updatedRow[ppDayIdx] = Number((overallAmount / people / days).toFixed(2));
        }
      }
      
      console.log(
        `[匯率除錯 - 修改明細] 報告編號: ${reportId}, ` +
        `分類: ${category}, ` +
        `原始匯率基準日: ${rateQueryDate}, ` +
        `實際採用匯率日期: ${rateResult && rateResult.date ? rateResult.date : (itemData['幣別'] === 'TWD' ? 'TWD固定匯率' : 'Fallback')}, ` +
        `幣別: ${itemData['幣別'] || 'TWD'}, ` +
        `台銀資料欄位名稱: 即期匯率／本行賣出, ` +
        `取得的即期本行賣出匯率: ${rate}, ` +
        `原幣金額: ${itemData['金額'] || itemData['總體金額'] || 0}, ` +
        `換算後 TWD 金額: ${Math.round((parseFloat(itemData['金額'] || itemData['總體金額']) || 0) * rate)}`
      );

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
  
  // 1. 自動從機票段 (Flight) 的日期帶入商旅起始日、商旅結束日、商旅天數 (若使用者手動修改則保留不覆蓋)
  try {
    const manualIdx = headers.indexOf('是否手動天數');
    const isManual = manualIdx !== -1 && String(rowData[manualIdx]).toUpperCase() === 'Y';
    
    if (!isManual) {
      const flightItems = sheetDataToJson('Flight', ss, true).filter(r => String(r['報告編號']) === String(reportId));
      
      let departureDates = [];
      let arrivalDates = [];
      
      flightItems.forEach(item => {
        // 第一段起飛與抵達
        const dep1 = parseDateTime(item['日期'], item['出發時間']);
        if (dep1) departureDates.push(dep1);
        
        const arr1 = parseArrivalDateTime(item['日期'], item['抵達時間'], item['跨日']);
        if (arr1) arrivalDates.push(arr1);
        
        // 若為來回，還有第二段回程
        if (item['行程類型'] === 'round-trip') {
          const dep2 = parseDateTime(item['回程日期'], item['回程出發時間']);
          if (dep2) departureDates.push(dep2);
          
          const arr2 = parseArrivalDateTime(item['回程日期'], item['回程抵達時間'], item['回程跨日']);
          if (arr2) arrivalDates.push(arr2);
        }
      });
      
      if (departureDates.length > 0 && arrivalDates.length > 0) {
        // 抓取第一筆起飛與最後一筆抵達
        const firstDep = new Date(Math.min(...departureDates.map(d => d.getTime())));
        const lastArr = new Date(Math.max(...arrivalDates.map(d => d.getTime())));
        
        // 格式化日期字串 (YYYY/MM/DD)
        const formatYMD = (d) => {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${yyyy}/${mm}/${dd}`;
        };
        
        const minDateStr = formatYMD(firstDep);
        const maxDateStr = formatYMD(lastArr);
        
        // 計算商旅天數 (出發 >= 14:00 算 0.5 天，返台 <= 12:00 算 0.5 天)
        const autoDays = calculateBusinessTripDays(firstDep, lastArr);
        
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
        
        // 自動同步批次重算所有明細的外幣匯率
        updateAllExchangeRates(reportId, minDateStr);
      }
    }
  } catch(e) {
    console.error('Failed to auto-populate dates from flight info', e);
  }
  
  const startIdx = headers.indexOf('商旅起始日');
  const endIdx = headers.indexOf('商旅結束日');
  const daysIdx = headers.indexOf('商旅天數');
  let days = parseFloat(rowData[daysIdx]) || 0;
  
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
  let rateUSD = parseFloat(rowData[rateUSDIdx]) || 30.0; // fallback default
  
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
    usedCurrencies.add('USD'); // 永遠包含 USD，保證 USD 匯率欄位也被更新
    
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
        const yyyy = dStart.getFullYear();
        const mm = String(dStart.getMonth() + 1).padStart(2, '0');
        const dd = String(dStart.getDate()).padStart(2, '0');
        queryDate = `${yyyy}-${mm}-${dd}`;
      }
    }
    if (!queryDate) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      queryDate = `${yyyy}-${mm}-${dd}`;
    }
    
    usedCurrencies.forEach(currency => {
      try {
        let matchedRate = null;
        
        // 財務規則：統一且強制使用商旅開始日期的前一天 (queryDate) 之台灣銀行即期本行賣出匯率
        const rateResult = getExchangeRate({ currency: currency, date: queryDate, forceRefresh: true });
        if (rateResult && rateResult.status === 'success') {
          matchedRate = parseFloat(rateResult.rate) || 1.0;
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
          
          // 如果是 USD 欄位，同時將該數值更新到變數中，供隨後的 USD 統計換算使用！
          if (currency === 'USD') {
            rateUSD = matchedRate;
          }
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

function updateAllExchangeRates(reportId, explicitStartDate) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const categories = ['Flight', 'Accommodation', 'Rental Car', 'Transportation', 'Gas', 'Parking', 'Internet', 'Social', 'Gift', 'Luggage Fee', 'Handing Fee', 'Per Diem', 'Lunch & Learn', 'Others', 'Advance Payment'];
    
    let fallbackDate;
    if (explicitStartDate) {
      const d = new Date(explicitStartDate);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() - 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        fallbackDate = `${yyyy}-${mm}-${dd}`;
      }
    }
    if (!fallbackDate) {
      fallbackDate = getTripStartDateMinusOneDay(reportId);
    }
    
    // 執行緒內記憶體快取，防止同一次重算發起重複的網路請求與公式輪詢
    const localRateCache = {};
    const localRateResultCache = {};

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
        
        if (repIdx === -1 || curIdx === -1) return;
        
        const isAccommodationOrRentalCar = (cat === 'Accommodation' || cat === 'Rental Car');
        if (!isAccommodationOrRentalCar && (amtIdx === -1 || twdIdx === -1)) return;
        
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][repIdx]) === String(reportId)) {
            const currency = String(data[i][curIdx]).toUpperCase();
            
            // 依據財務規則，一律且強制自動取得出差開始日期前一天（fallbackDate）的匯率，不因個別發票或明細日期影響
            const queryDate = fallbackDate;
            
            let rate = 1.0;
            let rateResult = null;
            if (currency !== 'TWD' && currency !== '') {
              if (localRateCache[currency] !== undefined) {
                rate = localRateCache[currency];
                rateResult = localRateResultCache[currency];
              } else {
                try {
                  rateResult = getExchangeRate({ currency: currency, date: queryDate, forceRefresh: true });
                  if (rateResult && rateResult.status === 'success') {
                    rate = parseFloat(rateResult.rate) || 1.0;
                  }
                  localRateCache[currency] = rate;
                  localRateResultCache[currency] = rateResult;
                } catch(e) {
                  console.warn('Failed to fetch rate inside updateAllExchangeRates', e);
                }
              }
            }
            
            if (rateIdx !== -1) {
              sheet.getRange(i + 1, rateIdx + 1).setValue(rate);
            }
            
            if (isAccommodationOrRentalCar) {
              const personalIdx = headers.indexOf('個人金額');
              const twdPersonalIdx = headers.indexOf('TWD個人金額');
              const overallIdx = headers.indexOf('總體金額');
              const twdOverallIdx = headers.indexOf('TWD總體金額');
              const advanceIdx = headers.indexOf('代墊金額');
              const twdAdvanceIdx = headers.indexOf('TWD代墊金額');
              
              let pAmt = 0, oAmt = 0, aAmt = 0;
              if (personalIdx !== -1 && twdPersonalIdx !== -1) {
                pAmt = parseFloat(data[i][personalIdx]) || 0;
                sheet.getRange(i + 1, twdPersonalIdx + 1).setValue(Math.round(pAmt * rate));
              }
              if (overallIdx !== -1 && twdOverallIdx !== -1) {
                oAmt = parseFloat(data[i][overallIdx]) || 0;
                sheet.getRange(i + 1, twdOverallIdx + 1).setValue(Math.round(oAmt * rate));
              }
              if (advanceIdx !== -1 && twdAdvanceIdx !== -1) {
                aAmt = parseFloat(data[i][advanceIdx]) || 0;
                sheet.getRange(i + 1, twdAdvanceIdx + 1).setValue(Math.round(aAmt * rate));
              }
              
              console.log(
                `[匯率除錯] 報告編號: ${reportId}, ` +
                `分類: ${cat}, ` +
                `商旅開始日期: ${explicitStartDate || '由Header取得'}, ` +
                `原始匯率基準日: ${fallbackDate}, ` +
                `實際採用匯率日期: ${rateResult && rateResult.date ? rateResult.date : (currency === 'TWD' ? 'TWD固定匯率' : 'Fallback')}, ` +
                `幣別: ${currency}, ` +
                `台銀資料欄位名稱: 即期匯率／本行賣出, ` +
                `取得的即期本行賣出匯率: ${rate}, ` +
                `原幣金額(總體/個人): ${oAmt}/${pAmt}, ` +
                `換算後 TWD 金額(總體/個人): ${Math.round(oAmt * rate)}/${Math.round(pAmt * rate)}`
              );
            } else {
              let amount = 0;
              if (amtIdx !== -1 && twdIdx !== -1) {
                amount = parseFloat(data[i][amtIdx]) || 0;
                sheet.getRange(i + 1, twdIdx + 1).setValue(Math.round(amount * rate));
              }
              
              console.log(
                `[匯率除錯] 報告編號: ${reportId}, ` +
                `分類: ${cat}, ` +
                `商旅開始日期: ${explicitStartDate || '由Header取得'}, ` +
                `原始匯率基準日: ${fallbackDate}, ` +
                `實際採用匯率日期: ${rateResult && rateResult.date ? rateResult.date : (currency === 'TWD' ? 'TWD固定匯率' : 'Fallback')}, ` +
                `幣別: ${currency}, ` +
                `台銀資料欄位名稱: 即期匯率／本行賣出, ` +
                `取得的即期本行賣出匯率: ${rate}, ` +
                `原幣金額: ${amount}, ` +
                `換算後 TWD 金額: ${Math.round(amount * rate)}`
              );
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

// 輔助函數：解析航班起飛時間
function parseDateTime(dateVal, timeVal) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  
  let hours = 0;
  let minutes = 0;
  if (timeVal) {
    const parts = String(timeVal).trim().split(':');
    if (parts.length >= 2) {
      hours = parseInt(parts[0], 10) || 0;
      minutes = parseInt(parts[1], 10) || 0;
    }
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes, 0);
}

// 輔助函數：解析航班抵台時間 (含跨日處理)
function parseArrivalDateTime(dateVal, timeVal, crossDayVal) {
  const baseDate = parseDateTime(dateVal, timeVal);
  if (!baseDate) return null;
  
  let daysToAdd = 0;
  if (crossDayVal) {
    const clean = String(crossDayVal).replace(/[^\d]/g, '');
    daysToAdd = parseInt(clean, 10) || 0;
  }
  if (daysToAdd > 0) {
    baseDate.setDate(baseDate.getDate() + daysToAdd);
  }
  return baseDate;
}

// 輔助函數：依照起飛起飛與抵達時間計算天數
function calculateBusinessTripDays(firstDep, lastArr) {
  if (!firstDep || !lastArr) return 0;
  
  const dStart = new Date(firstDep.getFullYear(), firstDep.getMonth(), firstDep.getDate());
  const dEnd = new Date(lastArr.getFullYear(), lastArr.getMonth(), lastArr.getDate());
  
  const diffTime = dEnd.getTime() - dStart.getTime();
  if (diffTime < 0) return 0;
  
  const totalDaysDiff = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (totalDaysDiff === 0) {
    let startWeight = 1.0;
    if (firstDep.getHours() >= 14) {
      startWeight = 0.5;
    }
    let endWeight = 1.0;
    const endMinutes = lastArr.getHours() * 60 + lastArr.getMinutes();
    if (endMinutes <= 12 * 60) {
      endWeight = 0.5;
    }
    return Math.min(1.0, startWeight + endWeight - 0.5 > 0 ? startWeight + endWeight - 0.5 : 0.5);
  }
  
  let startDayVal = 1.0;
  if (firstDep.getHours() >= 14) {
    startDayVal = 0.5;
  }
  
  let endDayVal = 1.0;
  const endMinutes = lastArr.getHours() * 60 + lastArr.getMinutes();
  if (endMinutes <= 12 * 60) {
    endDayVal = 0.5;
  }
  
  const midDays = totalDaysDiff - 1;
  return startDayVal + endDayVal + midDays;
}
