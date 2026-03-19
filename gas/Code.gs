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
      case 'deleteReport': // Delete a complete report
        result = deleteReport(payload);
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
  
  // 1. Get Header
  const headerData = sheetDataToJson('Report Header');
  const header = headerData.find(r => String(r['報告編號']) === String(reportId));
  
  if (!header) {
      return { status: 'error', message: 'Report not found' };
  }
  
  // 2. Get All Items
  const items = {};
  const categories = ['Flight', 'Accommodation', 'Taxi', 'Internet', 'Social', 'Gift', 'Handing Fee', 'Per Diem', 'Advance Payment', 'Others'];
  
  categories.forEach(cat => {
      try {
          const catData = sheetDataToJson(cat); 
          // Filter by reportId and sort by '次序'
          const reportItems = catData
            .filter(r => String(r['報告編號']) === String(reportId))
            .sort((a, b) => parseInt(a['次序']) - parseInt(b['次序']));
            
          items[cat] = reportItems;
      } catch (e) {
          items[cat] = [];
      }
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
    const userReports = headerData
      .filter(r => String(r['用戶編號']) === String(userId))
      .map(r => ({
        reportId: r['報告編號'],
        days: r['商旅天數'],
        startDate: r['商旅起始日'],
        endDate: r['商旅結束日'],
        status: r['狀態'],
        createdAt: r['建立時間']
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
      const categories = ['Flight', 'Accommodation', 'Taxi', 'Internet', 'Social', 'Gift', 'Handing Fee', 'Per Diem', 'Advance Payment', 'Others'];
      
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
