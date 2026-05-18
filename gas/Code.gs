/**
 * Main Entry Point
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    message: 'Business Travel Expense Report API is running.'
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const payload = data.payload || {};
    let result = {};

    switch (action) {
      // Auth
      case 'signup':
        result = handleSignUp(payload);
        break;
      case 'signin':
        result = handleSignIn(payload);
        break;
      case 'forgotPassword':
        result = handleForgotPassword(payload);
        break;
      case 'changePassword':
        result = handleChangePassword(payload);
        break;
      
      // Report
      case 'createReport': // Initialize new report
        result = createNewReport(payload);
        break;
      case 'getReport': // Get header and all details
        result = getReportFullData(payload);
        break;
      case 'getUserReports': // Get all reports for a user
        result = getUserReports(payload);
        break;
      case 'queryHistory':
        result = queryHistoryData(payload);
        break;
      case 'copyReport': // Copy existing report
        result = copyReport(payload);
        break;
      case 'deleteReport': // Delete a complete report
        result = deleteReport(payload);
        break;
      case 'updateReportStatus': // Lock or unlock a report
        result = updateReportStatus(payload);
        break;
      case 'updateReportName': // Update report custom name
        result = updateReportName(payload);
        break;
      case 'updateReportTripInfo': // Update trip days and dates manually
        result = updateReportTripInfo(payload);
        break;
      
      // Admin APIs
      case 'getAllMembers':
        result = getAllMembers(payload);
        break;
      case 'updateMemberPermission':
        result = updateMemberPermission(payload);
        break;
      
      // Items CRUD
      case 'addItem':
        result = addReportItem(payload);
        break;
      case 'updateItem':
        result = updateReportItem(payload);
        break;
      case 'deleteItem':
        result = deleteReportItem(payload);
        break;
      case 'copyItems':
        result = copyItems(payload);
        break;

      // External APIs
      case 'searchAirport':
        result = searchAirport(payload);
        break;
      case 'searchCity':
        result = searchCity(payload);
        break;
      case 'getExchangeRate':
        result = getExchangeRate(payload);
        break;
      case 'searchFlight':
        result = searchFlight(payload);
        break;
      case 'getAllFlights':
        result = getAllFlights();
        break;
      case 'getAllCities':
        result = getAllCities();
        break;
      case 'getAllCountries':
        result = getAllCountries();
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString(),
      stack: err.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getReportFullData(payload) {
  const { reportId, userId } = payload;
  
  if (!reportId) { // Fallback to allowing missing userId if old client caches? Better to enforce it.
    return { status: 'error', message: 'Missing reportId' };
  }
  
  if (!userId) {
    return { status: 'error', message: 'Missing userId' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Get Header
  const headerDataRaw = sheetDataToJson('Report Header', ss);
  let header = headerDataRaw.find(r => String(r['報告編號']) === String(reportId));
  
  if (!header) {
      return { status: 'error', message: 'Report not found' };
  }

  // Security Check
  if (String(header['用戶編號']) !== String(userId)) {
      const memberDataRaw = sheetDataToJson('Member', ss);
      const member = memberDataRaw.find(m => String(m['用戶編號']) === String(userId));
      
      let isAdmin = false;
      let canViewOthers = false;
      
      if (member) {
          canViewOthers = (member['可查看他人'] === 'Y' || String(member['可查看他人']).toUpperCase() === 'TRUE');

          if (member['用戶權限'] === '管理員') {
              isAdmin = true;
          }
      }
      
      if (!isAdmin && !canViewOthers) {
          return { status: 'error', message: '您沒有權限查看他人報告' };
      }
  }

  // Populate true user name if missing
  if (!header['員工姓名'] || header['員工姓名'] === '') {
      try {
          const memberDataRaw = sheetDataToJson('Member', ss);
          const member = memberDataRaw.find(m => String(m['用戶編號']) === String(header['用戶編號']));
          if (member) {
              header['員工姓名'] = member['用戶名稱'];
          }
      } catch (e) {
          console.warn('Could not fetch Member data for getReportFullData', e);
      }
  }
  
  // 2. Get All Items
  const items = {};
  const categories = ['Flight', 'Accommodation', 'Rental Car', 'Transportation', 'Gas', 'Parking', 'Internet', 'Social', 'Gift', 'Luggage Fee', 'Handing Fee', 'Per Diem', 'Advance Payment', 'Lunch & Learn', 'Others'];
  categories.forEach(cat => {
      let reportItems = [];
      try {
          const cachedData = sheetDataToJson(cat, ss);
          reportItems = cachedData.filter(r => String(r['報告編號']) === String(reportId));
          // Sort by sequence if applicable
          if (reportItems.length > 0 && reportItems[0]['次序'] !== undefined) {
              reportItems.sort((a, b) => parseInt(a['次序'] || 0) - parseInt(b['次序'] || 0));
          }
      } catch (e) {
          console.warn(`Error processing category ${cat}`, e);
      }
      items[cat] = reportItems;
  });

  return {
      status: 'success',
      data: {
          header: header,
          items: items
      }
  };
}

// -----------------------------------------------------------------------------

function getUserReports(payload) {
  const userId = payload.userId;
  
  if (!userId) {
    return { status: 'error', message: 'Missing userId' };
  }

  try {
    const headerData = sheetDataToJson('Report Header');
    const memberData = sheetDataToJson('Member');
    
    // Create mapping of userId -> userName and check permission
    const userMap = {};
    let canViewOthers = false;
    let isAdmin = false;

    if (memberData && memberData.length > 0) {
      memberData.forEach(m => {
        userMap[String(m['用戶編號'])] = m['用戶名稱'];
        if (String(m['用戶編號']) === String(userId)) {
          canViewOthers = (m['可查看他人'] === 'Y' || String(m['可查看他人']).toUpperCase() === 'TRUE');

          if (m['用戶權限'] === '管理員') {
             isAdmin = true;
             canViewOthers = true;
          }
        }
      });
    }

    // Apply permission logic
    let filteredData = headerData;
    if (!isAdmin && !canViewOthers) {
      filteredData = headerData.filter(r => String(r['用戶編號']) === String(userId));
    }

    const userReports = filteredData
      .map(r => ({
        reportId: String(r['報告編號']),
        userId: String(r['用戶編號']),
        userName: userMap[String(r['用戶編號'])] || r['員工姓名'] || r['用戶編號'],
        days: r['商旅天數'],
        startDate: r['商旅起始日'],
        endDate: r['商旅結束日'],
        status: r['狀態'],
        createdAt: r['建立時間'],
        reportName: r['報告名稱'],
        paymentCurrency: String(r['支付幣別'] || 'TWD').trim(),
        totalAmount: Number(String(r['合計TWD總體總額'] || '0').replace(/[^\d.-]/g, '')),
        advanceAmount: Number(String(r['預支費用總額'] || '0').replace(/[^\d.-]/g, '')),
        totalUSDAmount: Number(String(r['合計USD總體總額'] || '0').replace(/[^\d.-]/g, '')),
        rate: Number(String(r['USD匯率'] || '1').replace(/[^\d.-]/g, ''))
      }))
      // Sort by creation date descending
      .sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // latest first
      });

    return {
      status: 'success',
      data: userReports
    };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}
// -----------------------------------------------------------------------------

function deleteReport(payload) {
  const reportId = payload.reportId;
  const userId = payload.userId;
  const role = payload.role;
  
  if (!reportId || !userId) {
    return { status: 'error', message: 'Missing reportId or userId' };
  }

  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) {
    try {
      // 1. Verify ownership and status
      const headerSheet = getSheet('Report Header');
      const headerDataRange = headerSheet.getDataRange();
      const headerValues = headerDataRange.getValues();
      const headers = headerValues[0];
      
      const reportIdIndex = headers.indexOf('報告編號');
      const userIdIndex = headers.indexOf('用戶編號');
      const statusIndex = headers.indexOf('狀態');
      
      let targetRowIndex = -1;
      let isVerified = false;
      let errorMsg = 'Report not found or validation failed';
      
      for (let i = 1; i < headerValues.length; i++) {
        if (String(headerValues[i][reportIdIndex]).trim() === String(reportId).trim()) {
          // Found report, verify ownership and status
          if (role !== 'admin' && String(headerValues[i][userIdIndex]).trim() !== String(userId).trim()) {
             errorMsg = 'Unauthorized: Report belongs to another user (Sheet userId: ' + String(headerValues[i][userIdIndex]) + ', Request userId: ' + String(userId) + ')';
             break;
          }
          
          if (statusIndex !== -1) {
            const statusVal = String(headerValues[i][statusIndex] || '').trim();
            if (statusVal && statusVal !== '') {
               errorMsg = 'Cannot delete report with an existing status: ' + statusVal;
               break;
            }
          }

          targetRowIndex = i + 1; // 1-based index for deletion
          isVerified = true;
          break;
        }
      }
      
      if (!isVerified) {
        // If it was legitimately not found in the physical sheet, it might be a ghost cache record.
        // Force invalidate the cache here so the frontend can self-heal on next refresh.
        if (errorMsg === 'Report not found or validation failed') {
            invalidateCache('Report Header');
            return { status: 'success', message: 'Report was already deleted.' }; // Silent success post-condition
        }
        return { status: 'error', message: errorMsg };
      }

      // 2. Delete from Report Header
      headerSheet.deleteRow(targetRowIndex);

      // 3. Delete from all item sheets
      const categories = ['Flight', 'Accommodation', 'Rental Car', 'Transportation', 'Gas', 'Parking', 'Internet', 'Social', 'Gift', 'Luggage Fee', 'Handing Fee', 'Per Diem', 'Advance Payment', 'Lunch & Learn', 'Others'];
      
      categories.forEach(cat => {
        try {
          const cachedJson = sheetDataToJson(cat);
          const hasItems = cachedJson.some(row => String(row['報告編號']) === String(reportId));
          if (!hasItems) return; // INSTANT SKIP!
          
          const sheet = getSheet(cat);
          if (!sheet) return;
          const data = sheet.getDataRange().getValues();
          if (data.length <= 1) return;
          
          const catHeaders = data[0];
          const catReportIdIdx = catHeaders.indexOf('報告編號');
          if (catReportIdIdx === -1) return;

          // Delete backwards to prevent index shifting
          for (let i = data.length - 1; i > 0; i--) {
            if (String(data[i][catReportIdIdx]).trim() === String(reportId).trim()) {
              sheet.deleteRow(i + 1);
            }
          }
        } catch (catErr) {
           // Skip if sheet doesn't exist or fails (failsafe)
        }
      });
      
      // Removed sync flush to vastly improve performance
      invalidateCache('Report Header');
      categories.forEach(cat => invalidateCache(cat));
      
      return { status: 'success', message: 'Report deleted successfully' };
      
    } catch (err) {
      return { status: 'error', message: err.toString() };
    } finally {
      lock.releaseLock();
    }
  } else {
    return { status: 'error', message: 'System is busy. Please try again later.' };
  }
}

// -----------------------------------------------------------------------------

function updateReportStatus(payload) {
  const reportId = payload.reportId;
  const status = payload.status;
  
  if (!reportId) return { status: 'error', message: 'Missing reportId' };
  
  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) {
    try {
      const headerSheet = getSheet('Report Header');
      const data = headerSheet.getDataRange().getValues();
      const headers = data[0];
      const idIdx = headers.indexOf('報告編號');
      const statusIdx = headers.indexOf('狀態');
      
      if (idIdx === -1 || statusIdx === -1) {
        return { status: 'error', message: 'Headers not found' };
      }
      
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx]) === String(reportId)) {
          rowIndex = i + 1;
          break;
        }
      }
      
      if (rowIndex === -1) {
        return { status: 'error', message: 'Report not found' };
      }
      
      headerSheet.getRange(rowIndex, statusIdx + 1).setValue(status || '');
      invalidateCache('Report Header');
      return { status: 'success', message: 'Status updated successfully' };
    } catch(e) {
      return { status: 'error', message: e.toString() };
    } finally {
      lock.releaseLock();
    }
  } else {
    return { status: 'error', message: 'System busy, try again later' };
  }
}

function updateReportName(payload) {
  const reportId = payload.reportId;
  const reportName = payload.reportName;
  
  if (!reportId) return { status: 'error', message: 'Missing reportId' };
  
  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) {
    try {
      const headerSheet = getSheet('Report Header');
      const data = headerSheet.getDataRange().getValues();
      const headers = data[0];
      const idIdx = headers.indexOf('報告編號');
      const nameIdx = headers.indexOf('報告名稱');
      
      if (idIdx === -1) {
        return { status: 'error', message: 'Headers not found' };
      }
      if (nameIdx === -1) {
        return { status: 'error', message: 'Please add 報告名稱 column to Report Header sheet' };
      }
      
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx]) === String(reportId)) {
          rowIndex = i + 1;
          break;
        }
      }
      
      if (rowIndex === -1) {
        return { status: 'error', message: 'Report not found' };
      }
      
      headerSheet.getRange(rowIndex, nameIdx + 1).setValue(reportName || '');
      invalidateCache('Report Header');
      return { status: 'success', message: 'Report name updated successfully' };
    } catch(e) {
      return { status: 'error', message: e.toString() };
    } finally {
      lock.releaseLock();
    }
  } else {
    return { status: 'error', message: 'System busy, try again later' };
  }
}

/**
 * Historical Data Query API
 */
function queryHistoryData(payload) {
  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) {
    try {
      // payload = { employeeId, category, destination, reportName }
      let matchedReports = sheetDataToJson('Report Header');
      
      // Populate true member names into matchedReports BEFORE filtering
      const memberData = sheetDataToJson('Member');
      const userMap = {};
      if (memberData && memberData.length > 0) {
        memberData.forEach(m => {
          userMap[String(m['用戶編號'])] = m['用戶名稱'];
        });
      }
      
      matchedReports = matchedReports.map(r => ({
        ...r,
        '員工姓名': userMap[String(r['用戶編號'])] || r['員工姓名'] || r['用戶編號']
      }));

      // Filter by Employee ID
      if (payload.employeeId) {
        matchedReports = matchedReports.filter(r => String(r['員工姓名']).includes(payload.employeeId) || String(r['用戶編號']).includes(payload.employeeId));
      }
      
      // Filter by Destination
      let destArray = [];
      let isGlobalDestFiltered = false;
      if (payload.destination) {
        destArray = payload.destination.split(',').map(s => s.trim()).filter(Boolean);
        
        // If we only want Reports, we strictly filter the Report Header right now.
        // If we want specific items, we defer this filter to ensure we don't accidentally drop a report
        // whose item has a matching lower-level destination but whose header lacks it.
        if (!payload.category || payload.category === 'All') {
          matchedReports = matchedReports.filter(r => {
            const reportDest = String(r['出差國家'] || '');
            return destArray.some(d => reportDest.toLowerCase().includes(d.toLowerCase()));
          });
          isGlobalDestFiltered = true;
        }
      }
      
      // Filter by Report Name
      if (payload.reportName) {
        matchedReports = matchedReports.filter(r => String(r['報告名稱'] || '').includes(payload.reportName));
      }

      // If category is all, just return matched reports
      if (!payload.category || payload.category === 'All') {
        // Since "合計TWD總體總額" exists in the Report Header, we don't need to recalculate.
        // We can just map it to guarantee its existence, or let the frontend read it directly.

        return {
          status: 'success',
          type: 'reports',
          data: matchedReports,
          message: 'Historical reports fetched'
        };
      } else {
        // Find specific items within the matched reports
        const validReportIds = matchedReports.map(r => String(r['報告編號']));
        
        // Ensure safety on category mapping (Prevent accessing invalid sheets)
        let safeCategory = payload.category;
        
        let targetItems = [];
        try {
          const catItems = sheetDataToJson(safeCategory);
          
          targetItems = catItems.filter(item => validReportIds.includes(String(item['報告編號'])));
          
          // Destination filter for specific items
          if (payload.destination && !isGlobalDestFiltered && destArray.length > 0) {
            targetItems = targetItems.filter(item => {
              // Check item-specific location columns
              const itemRegion = String(item['地區'] || item['出差國家'] || item['出發地'] || item['抵達地'] || '');
              
              return destArray.some(d => itemRegion.toLowerCase().includes(d.toLowerCase()));
            });
          }
          
          // Flight Specific Filters
          if (safeCategory === 'Flight') {
            if (payload.flightDeparture) {
              const q = String(payload.flightDeparture).toLowerCase();
              targetItems = targetItems.filter(item => String(item['出發地'] || '').toLowerCase().includes(q));
            }
            if (payload.flightArrival) {
              const q = String(payload.flightArrival).toLowerCase();
              targetItems = targetItems.filter(item => String(item['抵達地'] || '').toLowerCase().includes(q));
            }
            if (payload.flightCurrency) {
              const q = String(payload.flightCurrency).toLowerCase();
              targetItems = targetItems.filter(item => String(item['幣別'] || '').toLowerCase().includes(q));
            }
          }
          
          // Accommodation Specific Filters
          if (safeCategory === 'Accommodation') {
            if (payload.accommodationCurrency) {
              const q = String(payload.accommodationCurrency).toLowerCase();
              targetItems = targetItems.filter(item => String(item['幣別'] || '').toLowerCase().includes(q));
            }
          }
          
          // Attach report context (Report Name, Employee ID) to each item
          targetItems = targetItems.map(item => {
            const parentR = matchedReports.find(r => String(r['報告編號']) === String(item['報告編號']));
            return {
              ...item,
              '_報告名稱': parentR ? parentR['報告名稱'] : '',
              '_員工編號': parentR ? parentR['用戶編號'] : '',
              '_員工姓名': parentR ? parentR['員工姓名'] : ''
            };
          });
          
        } catch(e) {
          console.error(e);
        }

        return {
          status: 'success',
          type: 'items',
          data: targetItems,
          message: 'Historical items fetched'
        };
      }
    } catch (e) {
      throw e;
    } finally {
      lock.releaseLock();
    }
  } else {
    return { status: 'error', message: 'Database busy' };
  }
}

// -----------------------------------------------------------------------------

function copyReport(payload) {
  const sourceReportId = payload.sourceReportId;
  const userId = payload.userId;
  if (!sourceReportId || !userId) {
    return { status: 'error', message: 'Missing sourceReportId or userId' };
  }

  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) {
    try {
      const headerSheet = getSheet('Report Header');
      const headerData = headerSheet.getDataRange().getValues();
      
      // 1. Generate new Report ID
      let lastNum = 0;
      if (headerData.length > 1) {
          // Iterate backwards or just search for max
          for (let i = 1; i < headerData.length; i++) {
             const p = String(headerData[i][0]).split('-');
             if (p.length === 2 && p[0] === 'BR') {
                const n = parseInt(p[1], 10);
                if (n > lastNum) lastNum = n;
             }
          }
      }
      const newNum = lastNum + 1;
      const newReportId = 'BR-' + String(newNum).padStart(8, '0');

      // 2. Duplicate Header
      const headers = headerData[0];
      const idIdx = headers.indexOf('報告編號');
      const userIdx = headers.indexOf('用戶編號');
      const timeIdx = headers.indexOf('建立時間');
      const modIdx = headers.indexOf('最後修改時間');
      const statusIdx = headers.indexOf('狀態');
      const nameIdx = headers.indexOf('報告名稱');
      const empIdx = headers.indexOf('員工姓名');
      
      let sourceRow = null;
      for (let i = 1; i < headerData.length; i++) {
        if (String(headerData[i][idIdx]) === String(sourceReportId)) {
          sourceRow = [...headerData[i]];
          break;
        }
      }
      
      if (!sourceRow) {
        return { status: 'error', message: 'Source report not found' };
      }
      
      const memberData = sheetDataToJson('Member');
      let canCopyOthers = false;
      const targetUser = memberData.find(m => String(m['用戶編號']) === String(userId));
      if (targetUser) {
         canCopyOthers = (targetUser['可查看他人'] === 'Y' || String(targetUser['可查看他人']).toUpperCase() === 'TRUE');
         if (targetUser['用戶權限'] === '管理員') canCopyOthers = true;
      }
      if (!canCopyOthers && String(sourceRow[userIdx]) !== String(userId)) {
         return { status: 'error', message: '您沒有複製他人報告的權限' };
      }
      
      // Overwrite specific fields
      sourceRow[idIdx] = newReportId;
      if (userIdx !== -1) sourceRow[userIdx] = userId;
      if (timeIdx !== -1) sourceRow[timeIdx] = new Date();
      if (modIdx !== -1) sourceRow[modIdx] = '';
      if (statusIdx !== -1) sourceRow[statusIdx] = '';
      
      // Update Name with suffix if it exists
      if (nameIdx !== -1) {
        if (sourceRow[nameIdx]) {
           sourceRow[nameIdx] = String(sourceRow[nameIdx]) + ' (複製)';
        } else {
           sourceRow[nameIdx] = sourceReportId + ' (複製)'; 
        }
      }
      
      // Populate true member name if mapping is possible, but frontend handles this via userMap anyway.
      
      headerSheet.appendRow(sourceRow);
      
      // 3. Duplicate Items in all category sheets
      const categories = ['Flight', 'Accommodation', 'Rental Car', 'Transportation', 'Gas', 'Parking', 'Internet', 'Social', 'Gift', 'Luggage Fee', 'Handing Fee', 'Per Diem', 'Advance Payment', 'Lunch & Learn', 'Others'];
      
      categories.forEach(cat => {
        try {
          const cachedJson = sheetDataToJson(cat);
          const hasItems = cachedJson.some(row => String(row['報告編號']) === String(sourceReportId));
          if (!hasItems) return; // INSTANT SKIP!
          
          const sheet = getSheet(cat);
          if (!sheet) return;
          const data = sheet.getDataRange().getValues();
        if (data.length < 2) return;
        
        const catHeaders = data[0];
        const catIdIdx = catHeaders.indexOf('報告編號');
        if (catIdIdx === -1) return;
        
        let targetRows = [];
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][catIdIdx]) === String(sourceReportId)) {
            const rowCopy = [...data[i]];
            rowCopy[catIdIdx] = newReportId;
            
            // Re-map internal dates which might format weirdly in Google Sheet if we don't handle Date objects
            // Actually `getValues()` returns native Date objects for dates, and so `setValues()` will write them correctly.
            targetRows.push(rowCopy);
          }
        }
        
        if (targetRows.length > 0) {
           sheet.getRange(sheet.getLastRow() + 1, 1, targetRows.length, targetRows[0].length).setValues(targetRows);
        }
        } catch(catErr) {}
      });
      
      invalidateCache('Report Header');
      categories.forEach(cat => invalidateCache(cat));
      
      return { status: 'success', reportId: newReportId };
      
    } catch(e) {
      return { status: 'error', message: e.toString() };
    } finally {
      lock.releaseLock();
    }
  } else {
    return { status: 'error', message: 'Database busy' };
  }
}

// -----------------------------------------------------------------------------

function copyItems(payload) {
  const category = payload.category;
  const sourceItems = payload.sourceItems; // Array of item objects
  const targetReportId = payload.targetReportId;
  const userId = payload.userId;

  if (!category || !sourceItems || !Array.isArray(sourceItems) || sourceItems.length === 0 || !targetReportId || !userId) {
    return { status: 'error', message: 'Missing parameters or sourceItems is empty' };
  }

  const headerSheet = getSheet('Report Header');
  const headerData = headerSheet.getDataRange().getValues();
  const hHeaders = headerData[0];
  const hIdIdx = hHeaders.indexOf('報告編號');
  const hUserIdx = hHeaders.indexOf('用戶編號');
  let targetReportOwner = null;
  for (let i = 1; i < headerData.length; i++) {
     if (String(headerData[i][hIdIdx]) === String(targetReportId)) {
        targetReportOwner = String(headerData[i][hUserIdx]);
        break;
     }
  }

  const memberData = sheetDataToJson('Member');
  let canCopyOthers = false;
  let isAdmin = false;
  const targetUser = memberData.find(m => String(m['用戶編號']) === String(userId));
  if (targetUser) {
      canCopyOthers = (targetUser['可查看他人'] === 'Y' || String(targetUser['可查看他人']).toUpperCase() === 'TRUE');
      if (targetUser['用戶權限'] === '管理員') {
          canCopyOthers = true;
          isAdmin = true;
      }
  }

  // To copy items TO a report, you MUST own the target report, OR be an admin.
  if (!isAdmin && targetReportOwner !== String(userId)) {
      return { status: 'error', message: '您不可編輯或複製明細至他人的報告' };
  }
  
  // Notice we only check target ownership here. The sourceItems are assumed checked in UI, 
  // but if they try to hack, they are just copying data to their own report anyway, which is safe if canCopyOthers is true.
  if (!canCopyOthers) {
      // Check if all source items actually belong to reports they own? 
      // We know they can't see the items without either canViewOthers or owning them anyway.
  }

  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) {
    try {
      const sheet = getSheet(category);
      if (!sheet) {
        return { status: 'error', message: 'Category sheet not found' };
      }

      const data = sheet.getDataRange().getValues();
      if (data.length < 1) {
         return { status: 'error', message: 'Sheet is empty' };
      }
      
      const headers = data[0];
      const reportIdIdx = headers.indexOf('報告編號');
      const sequenceIdx = headers.indexOf('次序');
      
      if (reportIdIdx === -1) {
        return { status: 'error', message: '報告編號 column not found' };
      }

      // Find max sequence for target report
      let maxSeq = 0;
      if (sequenceIdx !== -1) {
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][reportIdIdx]) === String(targetReportId)) {
            const seq = parseInt(data[i][sequenceIdx], 10);
            if (!isNaN(seq) && seq > maxSeq) {
              maxSeq = seq;
            }
          }
        }
      }

      const newRows = [];
      const timestamp = new Date();

      sourceItems.forEach(item => {
        maxSeq++;
        const newRow = new Array(headers.length).fill('');
        
        headers.forEach((h, i) => {
          if (h === '報告編號') {
            newRow[i] = targetReportId;
          } else if (h === '次序') {
            newRow[i] = maxSeq;
          } else if (h === '建立時間' || h === '最後修改時間') {
            newRow[i] = timestamp;
          } else if (item[h] !== undefined) {
             newRow[i] = item[h];
          }
        });
        
        newRows.push(newRow);
      });

      if (newRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
        SpreadsheetApp.flush();
        recalculateHeader(targetReportId, category);
      }

      invalidateCache(category);

      return { status: 'success', message: 'Items copied successfully', targetReportId: targetReportId };

    } catch (e) {
      return { status: 'error', message: e.toString() };
    } finally {
      lock.releaseLock();
    }
  } else {
    return { status: 'error', message: 'Database busy' };
  }
}

// -----------------------------------------------------------------------------
// Admin Member Management API
// -----------------------------------------------------------------------------

function getAllMembers(payload) {
  // Only admin
  if (payload.role !== 'admin') {
    return { status: 'error', message: 'Unauthorized' };
  }
  
  try {
    const memberData = sheetDataToJson('Member');
    
    // Process and sort members safely
    const result = memberData.map(m => ({
      id: String(m['用戶編號']),
      name: m['用戶名稱'] || '',
      email: m['用戶電郵地址'] || '',
      role: m['用戶權限'] === '管理員' ? 'admin' : 'user',
      canViewOthers: (m['可查看他人'] === 'Y' || String(m['可查看他人']).toUpperCase() === 'TRUE'),
      canCopyOthers: (m['可查看他人'] === 'Y' || String(m['可查看他人']).toUpperCase() === 'TRUE')
    })).sort((a, b) => a.id.localeCompare(b.id));

    return {
      status: 'success',
      data: result
    };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

function updateMemberPermission(payload) {
  const { targetUserId, canViewOthers, canCopyOthers, role } = payload;
  
  // Only admin
  if (role !== 'admin') {
    return { status: 'error', message: 'Unauthorized' };
  }
  
  if (!targetUserId) {
    return { status: 'error', message: 'Missing targetUserId' };
  }
  
  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) {
    try {
      const sheet = getSheet('Member');
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      const idIdx = headers.indexOf('用戶編號');
      let canViewOthersIdx = headers.indexOf('可查看他人');
      
      if (idIdx === -1) {
        return { status: 'error', message: 'Member sheet headers invalid' };
      }
      
      // If the column does not exist, append it
      if (canViewOthersIdx === -1) {
        canViewOthersIdx = headers.length;
        sheet.getRange(1, canViewOthersIdx + 1).setValue('可查看他人');
        headers.push('可查看他人'); // keep array in sync
      }
      
      let targetRowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx]) === String(targetUserId)) {
          targetRowIndex = i + 1;
          break;
        }
      }
      
      if (targetRowIndex === -1) {
        return { status: 'error', message: 'User not found' };
      }
      
      if (canViewOthers !== undefined) {
        const newValueView = canViewOthers ? 'Y' : '';
        sheet.getRange(targetRowIndex, canViewOthersIdx + 1).setValue(newValueView);
      }
      
      invalidateCache('Member');
      
      return { status: 'success', message: 'Permission updated successfully' };
    } catch(e) {
      return { status: 'error', message: e.toString() };
    } finally {
      lock.releaseLock();
    }
  } else {
    return { status: 'error', message: 'System busy, please try again' };
  }
}
