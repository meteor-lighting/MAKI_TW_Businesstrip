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
  // payload: { reportId }
  const reportId = payload.reportId;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create sheet mapping for O(1) sheet retrieval and cache them
  const allSheets = ss.getSheets();
  const sheetMap = {};
  allSheets.forEach(s => sheetMap[s.getName()] = s);

  // 1. Get Header
  const headerSheet = sheetMap['Report Header'];
  if (!headerSheet) return { status: 'error', message: 'Report Header sheet not found' };
  
  const headerDataRaw = headerSheet.getDataRange().getValues();
  if (headerDataRaw.length < 2) return { status: 'error', message: 'Report not found' };
  
  const hCols = headerDataRaw[0];
  let header = null;
  const idIdx = hCols.indexOf('報告編號');
  
  if (idIdx === -1) return { status: 'error', message: 'Invalid Report Header sheet structure' };
  
  for (let i = 1; i < headerDataRaw.length; i++) {
     if (String(headerDataRaw[i][idIdx]) === String(reportId)) {
         let obj = {};
         hCols.forEach((col, idx) => obj[col] = headerDataRaw[i][idx]);
         header = obj;
         break;
     }
  }
  
  if (!header) {
      return { status: 'error', message: 'Report not found' };
  }

  // Populate true user name if missing
  if (!header['員工姓名'] || header['員工姓名'] === '') {
      try {
          const memberSheet = sheetMap['Member'];
          if (memberSheet) {
              const memberRaw = memberSheet.getDataRange().getValues();
              if (memberRaw.length >= 2) {
                  const mCols = memberRaw[0];
                  const mIdIdx = mCols.indexOf('用戶編號');
                  const mNameIdx = mCols.indexOf('用戶名稱');
                  if (mIdIdx !== -1 && mNameIdx !== -1) {
                      for (let i = 1; i < memberRaw.length; i++) {
                         if (String(memberRaw[i][mIdIdx]) === String(header['用戶編號'])) {
                             header['員工姓名'] = memberRaw[i][mNameIdx];
                             break;
                         }
                      }
                  }
              }
          }
      } catch (e) {
          console.warn('Could not fetch Member data for getReportFullData', e);
      }
  }
  
  // 2. Get All Items
  const items = {};
  const categories = ['Flight', 'Accommodation', 'Rental Car', 'Taxi', 'Gas', 'Parking', 'Internet', 'Social', 'Gift', 'Luggage Fee', 'Handing Fee', 'Per Diem', 'Advance Payment', 'Lunch & Learn', 'Others'];
  
  categories.forEach(cat => {
      let reportItems = [];
      const sheet = sheetMap[cat];
      
      if (sheet) {
          try {
              const dataVals = sheet.getDataRange().getValues();
              if (dataVals.length >= 2) {
                  const cols = dataVals[0];
                  const rIdx = cols.indexOf('報告編號');
                  const oIdx = cols.indexOf('次序');
                  
                  if (rIdx !== -1) {
                      for (let i = 1; i < dataVals.length; i++) {
                          if (String(dataVals[i][rIdx]) === String(reportId)) {
                              let obj = {};
                              cols.forEach((col, idx) => obj[col] = dataVals[i][idx]);
                              reportItems.push(obj);
                          }
                      }
                      
                      // Sort by sequence if applicable
                      if (oIdx !== -1) {
                          reportItems.sort((a, b) => parseInt(a['次序'] || 0) - parseInt(b['次序'] || 0));
                      }
                  }
              }
          } catch (e) {
              console.warn(`Error processing category ${cat}`, e);
          }
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
  const role = payload.role || 'user';
  
  if (!userId && role !== 'admin') {
    return { status: 'error', message: 'Missing userId' };
  }

  try {
    const headerData = sheetDataToJson('Report Header');
    const memberData = sheetDataToJson('Member');
    
    // Create mapping of userId -> userName
    const userMap = {};
    if (memberData && memberData.length > 0) {
      memberData.forEach(m => {
        userMap[String(m['用戶編號'])] = m['用戶名稱'];
      });
    }

    let filteredData = headerData;
    
    if (role !== 'admin') {
      filteredData = headerData.filter(r => String(r['用戶編號']) === String(userId));
    }

    const userReports = filteredData
      .map(r => ({
        reportId: r['報告編號'],
        userName: userMap[String(r['用戶編號'])] || r['員工姓名'] || r['用戶編號'],
        days: r['商旅天數'],
        startDate: r['商旅起始日'],
        endDate: r['商旅結束日'],
        status: r['狀態'],
        createdAt: r['建立時間'],
        reportName: r['報告名稱']
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
          if (String(headerValues[i][userIdIndex]).trim() !== String(userId).trim()) {
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
        return { status: 'error', message: errorMsg };
      }

      // 2. Delete from Report Header
      headerSheet.deleteRow(targetRowIndex);

      // 3. Delete from all item sheets
      const categories = ['Flight', 'Accommodation', 'Rental Car', 'Taxi', 'Gas', 'Parking', 'Internet', 'Social', 'Gift', 'Luggage Fee', 'Handing Fee', 'Per Diem', 'Advance Payment', 'Lunch & Learn', 'Others'];
      
      categories.forEach(cat => {
        try {
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
      
      SpreadsheetApp.flush(); // Ensure changes are applied before responding
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
      SpreadsheetApp.flush();
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
      SpreadsheetApp.flush();
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
      const headers = sheetDataToJson('Report Header');
      
      let matchedReports = headers;

      // Filter by Employee ID
      if (payload.employeeId) {
        matchedReports = matchedReports.filter(r => String(r['員工姓名']).includes(payload.employeeId) || String(r['用戶編號']).includes(payload.employeeId));
      }
      
      // Filter by Destination
      if (payload.destination) {
        matchedReports = matchedReports.filter(r => String(r['出差地點'] || '').includes(payload.destination));
      }
      
      // Filter by Report Name
      if (payload.reportName) {
        matchedReports = matchedReports.filter(r => String(r['報告名稱'] || '').includes(payload.reportName));
      }

      // If category is all, just return matched reports
      if (!payload.category || payload.category === 'All') {
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
