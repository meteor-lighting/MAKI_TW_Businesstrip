/**
 * Database Helpers
 */

function getResolvedSheetName(name) {
  const categoryMap = {
    'RentalCar': 'Rental Car',
    'LuggageFee': 'Luggage Fee',
    'HandingFee': 'Handing Fee',
    'AdvancePayment': 'Advance Payment',
    'LunchLearn': 'Lunch & Learn',
    'PerDiem': 'Per Diem'
  };
  return categoryMap[name] || name;
}

function getSheet(name) {
  const resolvedName = getResolvedSheetName(name);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(resolvedName);
  if (!sheet) throw new Error(`Sheet "${resolvedName}" not found (requested as "${name}").`);
  return sheet;
}

function getDataRows(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  return data.slice(1);
}

const EXECUTION_MEMO = {};

function invalidateCache(sheetName) {
    const resolvedName = getResolvedSheetName(sheetName);
    const cache = CacheService.getScriptCache();
    const key = 'DB_v3_' + resolvedName;
    const chunksStr = cache.get(key + '_chunks');
    if (chunksStr) {
        const chunks = parseInt(chunksStr, 10);
        if (chunks === 1) cache.remove(key);
        else for (let i=0; i<chunks; i++) cache.remove(key + '_' + i);
        cache.remove(key + '_chunks');
    }
    
    if (EXECUTION_MEMO[resolvedName]) {
        delete EXECUTION_MEMO[resolvedName];
    }
}

function putCache(key, stringData, expiration = 3600) {
    const cache = CacheService.getScriptCache();
    const MAX_LENGTH = 90000;
    if (stringData.length <= MAX_LENGTH) {
        cache.put(key, stringData, expiration);
        cache.put(key + '_chunks', '1', expiration);
    } else {
        const chunks = Math.ceil(stringData.length / MAX_LENGTH);
        for (let i = 0; i < chunks; i++) {
            cache.put(key + '_' + i, stringData.substring(i * MAX_LENGTH, (i+1) * MAX_LENGTH), expiration);
        }
        cache.put(key + '_chunks', String(chunks), expiration);
    }
}

function getCache(key) {
    const cache = CacheService.getScriptCache();
    const chunksStr = cache.get(key + '_chunks');
    if (!chunksStr) return null;
    const chunks = parseInt(chunksStr, 10);
    if (chunks === 1) return cache.get(key);
    let full = '';
    for (let i = 0; i < chunks; i++) {
        const chunk = cache.get(key + '_' + i);
        if (!chunk) return null;
        full += chunk;
    }
    return full;
}

function appendRow(sheetName, rowData) {
  const sheet = getSheet(sheetName);
  sheet.appendRow(rowData);
  invalidateCache(sheetName);
}

// Convert sheet data (2D array) to Array of Objects based on headers
function sheetDataToJson(sheetName, ssPassed = null, forceRefresh = false) {
  const resolvedName = getResolvedSheetName(sheetName);
  if (!forceRefresh && EXECUTION_MEMO[resolvedName]) {
      return EXECUTION_MEMO[resolvedName];
  }

  const cacheKey = 'DB_v3_' + resolvedName;
  if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) {
          const parsed = JSON.parse(cached);
          EXECUTION_MEMO[resolvedName] = parsed;
          return parsed;
      }
  }

  const ss = ssPassed || SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(resolvedName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  
  const headers = data[0];
  const tz = ss.getSpreadsheetTimeZone();
  
  const finalArray = data.slice(1).map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      let val = row[index];
      
      // Fix TimeZone offset issues natively here rather than in frontend
      if (val instanceof Date) {
        // If it's a "Time-Only" field from Google Sheets, the year defaults to 1899
        if (val.getFullYear() === 1899) {
            val = String(val.getHours()).padStart(2, '0') + ':' + String(val.getMinutes()).padStart(2, '0');
        } else {
            // General Date formatting that strips T/Z so browsers act literally
            val = val.getFullYear() + '/' + 
                  String(val.getMonth() + 1).padStart(2, '0') + '/' + 
                  String(val.getDate()).padStart(2, '0') + ' ' + 
                  String(val.getHours()).padStart(2, '0') + ':' + 
                  String(val.getMinutes()).padStart(2, '0') + ':' + 
                  String(val.getSeconds()).padStart(2, '0');
        }
      }
      
      obj[header] = val;
    });
    return obj;
  });
  
  // Save to Cache & Memo
  putCache(cacheKey, JSON.stringify(finalArray));
  EXECUTION_MEMO[resolvedName] = finalArray;
  
  return finalArray;
}
