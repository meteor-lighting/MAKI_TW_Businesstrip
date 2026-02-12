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
  const categories = ['Flight', 'Accommodation', 'Taxi', 'Internet', 'Social', 'Gift', 'Handing Fee', 'Per Diem', 'Others'];
  
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
