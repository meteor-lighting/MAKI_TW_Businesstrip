/**
 * Database Helpers
 */

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error(`Sheet "${name}" not found.`);
  return sheet;
}

function getDataRows(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  return data.slice(1);
}

function appendRow(sheetName, rowData) {
  const sheet = getSheet(sheetName);
  sheet.appendRow(rowData);
}

// Convert sheet data (2D array) to Array of Objects based on headers
function sheetDataToJson(sheetName, ssPassed = null) {
  const ss = ssPassed || SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  const headers = data[0];
  const tz = ss.getSpreadsheetTimeZone();
  
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      let val = row[index];
      
      // Fix TimeZone offset issues natively here rather than in frontend
      if (val instanceof Date) {
        // If it's a "Time-Only" field from Google Sheets, the year defaults to 1899
        if (val.getFullYear() === 1899) {
            val = Utilities.formatDate(val, tz, "HH:mm");
        } else {
            // General Date formatting that strips T/Z so browsers act literally
            val = Utilities.formatDate(val, tz, "yyyy/MM/dd HH:mm:ss");
        }
      }
      
      obj[header] = val;
    });
    return obj;
  });
}
