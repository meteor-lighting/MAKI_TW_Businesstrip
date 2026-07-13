/**
 * External APIs Proxy
 */
const executionRateCache = {};

const AVIATION_API_KEY = PropertiesService.getScriptProperties().getProperty('AVIATION_API_KEY');
// const GEONAMES_USERNAME = PropertiesService.getScriptProperties().getProperty('GEONAMES_USERNAME');

function searchAirport(payload) {
  // payload: { query } usually IATA code
  // Mocking for now as we don't have real key in env yet.
  // In real implementation: UrlFetchApp.fetch(...)
  
  return {
    data: [
      { iata_code: 'TPE', airport_name: 'Taoyuan International Airport' },
      { iata_code: 'HND', airport_name: 'Haneda Airport' },
      { iata_code: 'NRT', airport_name: 'Narita International Airport' }
    ]
  };
}

function searchCity(payload) {
  // payload: { query }
  const query = (payload.query || '').toLowerCase();
  
  try {
    const sheet = getSheet('Cities');
    // Assuming data starts at A1 and goes down. 
    // Use getRange to get all data in Column A.
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { data: [] };
    
    // Read all cities. Caching this in ScriptProperties or CacheService might be good optimization 
    // but for now direct read is safer for consistency.
    // If the list is huge (e.g. 20k rows), reading might be slow. 
    // Optimization: filtering in sheet? No, sheet filter is for UI. 
    // We fetch all values and filter in memory. JS is fast enough for ~10k items.
    // If >100k, we might need a better approach.
    const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat(); 
    
    // Filter
    // "Most similar": 
    // 1. Starts with query (highest priority)
    // 2. Includes query (secondary)
    
    const matches = [];
    // Limit to 5
    for (const city of values) {
      if (!city) continue;
      const c = String(city);
      const cLower = c.toLowerCase();
      
      if (cLower.includes(query)) {
         matches.push(c);
      }
    }
    
    // Sort: Starts with query comes first
    matches.sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(query);
        const bStarts = b.toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
    });
    
    const top5 = matches.slice(0, 5).map(name => ({ name }));
    
    return { data: top5 };
    
  } catch (e) {
    // If sheet doesn't exist or other error, return empty but don't crash
    console.log('Error searching cities: ' + e);
    return { data: [] };
  }
}

function getExchangeRate(payload) {
  // payload: { currency, date }
  // date: YYYY/MM/DD or YYYY-MM-DD
  const currency = (payload.currency || 'USD').toUpperCase();
  let dateStr = payload.date;
  const forceRefresh = payload.forceRefresh || false;

  if (currency === 'TWD') return { status: 'success', rate: 1.0, date: dateStr, message: 'TWD rate is fixed to 1.0' };

  if (!dateStr) {
      const today = new Date();
      dateStr = `${today.getFullYear()}/${today.getMonth()+1}/${today.getDate()}`;
  }

  const executionRateCacheKey = `${currency}_${dateStr.replace(/[^0-9]/g, '')}`;
  if (executionRateCache[executionRateCacheKey]) {
      return executionRateCache[executionRateCacheKey];
  }

  // GLOBAL CACHE FOR EXTERNAL API
  const scriptCache = CacheService.getScriptCache();
  const cacheKey = `BOT_RATE_${currency}_${dateStr.replace(/[^0-9]/g, '')}`;
  if (!forceRefresh) {
      const cachedResponse = scriptCache.get(cacheKey);
      if (cachedResponse) {
          return JSON.parse(cachedResponse);
      }
  }

  // Target: Previous Day (T-1)
  // If T-1 is holiday, keep going back up to 5 days.
  
  const targetDate = new Date(dateStr);
  if (isNaN(targetDate.getTime())) {
      return { status: 'error', message: `Invalid base date: ${dateStr}` };
  }
  
  let rate = null;
  let usedDate = '';
  const debugLog = [];
  
  const fallbackRates = {
      'USD': 30.0, 'JPY': 0.21, 'EUR': 32.5, 'CNY': 4.2, 'TWD': 1.0, 'THB': 0.9, 'CAD': 23.5, 'HKD': 3.9
  };
  
  // 計算 FinMind 查詢範圍：從基準日 targetDate 往前推 15 天，以防中間遇到長假
  const dStart = new Date(targetDate);
  dStart.setDate(dStart.getDate() - 15);
  const qStart = `${dStart.getFullYear()}-${String(dStart.getMonth() + 1).padStart(2, '0')}-${String(dStart.getDate()).padStart(2, '0')}`;
  const qEnd = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
  
  let apiRecords = [];
  
  // 核心通道一：一次性拉取 15 天歷史匯率（防範 HTTP 402 限流且速度極快）
  try {
      const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanExchangeRate&data_id=${currency}&start_date=${qStart}&end_date=${qEnd}`;
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (response.getResponseCode() === 200) {
          const resJson = JSON.parse(response.getContentText());
          if (resJson && resJson.data && resJson.data.length > 0) {
              apiRecords = resJson.data;
              debugLog.push(`FinMind API range fetch success: loaded ${apiRecords.length} records`);
          } else {
              debugLog.push(`FinMind API returned empty range data`);
          }
      } else {
          debugLog.push(`FinMind API HTTP ${response.getResponseCode()}`);
      }
  } catch (e) {
      debugLog.push(`FinMind API Exception: ${e.toString()}`);
  }
  
  // 開始前推 10 天找尋營業日
  let currentSearchDate = new Date(targetDate);
  let attempts = 0;
  
  while (rate === null && attempts < 10) {
      const yyyy = currentSearchDate.getFullYear();
      const mm = String(currentSearchDate.getMonth() + 1).padStart(2, '0');
      const dd = String(currentSearchDate.getDate()).padStart(2, '0');
      const queryDate = `${yyyy}-${mm}-${dd}`;
      
      // 1. 優先從 FinMind 記憶體資料中讀取
      if (apiRecords.length > 0) {
          const matched = apiRecords.find(r => r.date === queryDate);
          if (matched) {
              const r = parseFloat(matched.spot_sell);
              if (!isNaN(r) && r > 0) {
                  rate = r;
                  usedDate = queryDate;
                  debugLog.push(`[${queryDate}] Channel 1 Match found`);
                  break;
              }
          }
      }
      
      // 2. 備份通道：UrlFetch HTML 爬網頁 (Chrome UA 偽裝)
      if (rate === null) {
          try {
              const url = `https://rate.bot.com.tw/xrt/all/${queryDate}`;
              const response = UrlFetchApp.fetch(url, {
                  muteHttpExceptions: true,
                  headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                  }
              });
              if (response.getResponseCode() === 200) {
                  const html = response.getContentText();
                  const rows = html.split('<tr');
                  let foundRow = false;
                  for (const rowFragment of rows) {
                      if (rowFragment.includes(`(${currency})`)) {
                          foundRow = true;
                          const cellRegex = /class="[^"]*rate-content-sight[^"]*"[^>]*>([\d.]+)<\/td>/g;
                          let result;
                          const cellValues = [];
                          while ((result = cellRegex.exec(rowFragment)) !== null) {
                              cellValues.push(result[1]);
                          }
                          if (cellValues.length >= 2) {
                              const r = parseFloat(cellValues[1]);
                              if (!isNaN(r)) {
                                  rate = r;
                                  usedDate = queryDate;
                              }
                          }
                          break;
                      }
                  }
                  if (foundRow && rate !== null) {
                      debugLog.push(`[${queryDate}] Channel 2 success`);
                  }
              }
          } catch (e) {
              debugLog.push(`[${queryDate}] Channel 2 exception: ${e.toString()}`);
          }
      }
      
      // 3. 備份通道：IMPORTHTML 公式兜底
      if (rate === null) {
          try {
              const ss = SpreadsheetApp.getActiveSpreadsheet();
              let tempSheet = ss.getSheetByName('__TempRateTable');
              if (!tempSheet) {
                  tempSheet = ss.insertSheet('__TempRateTable');
                  tempSheet.hideSheet();
              }
              tempSheet.clear();
              
              const formula = `=IMPORTHTML("https://rate.bot.com.tw/xrt/all/${queryDate}", "table", 1)`;
              tempSheet.getRange('A1').setValue(formula);
              SpreadsheetApp.flush();
              
              let values = [];
              let retries = 0;
              while (retries < 6) {
                  Utilities.sleep(500);
                  values = tempSheet.getDataRange().getValues();
                  if (values.length > 2 && String(values[0][0]).indexOf('#N/A') === -1) {
                      break;
                  }
                  retries++;
              }
              if (values.length > 0 && String(values[0][0]).indexOf('#REF!') !== -1) {
                  debugLog.push(`[${queryDate}] Ch3 blocked (#REF!). Creating helper sheet.`);
                  try {
                      const authSheetName = '允許匯率授權(請點A1允許)';
                      let authSheet = ss.getSheetByName(authSheetName);
                      if (!authSheet) {
                          authSheet = ss.insertSheet(authSheetName, 0);
                          authSheet.getRange('A1').setValue('=IMPORTHTML("https://rate.bot.com.tw/xrt/all/2026-04-30", "table", 1)');
                          authSheet.getRange('B1').setValue('← 請將滑鼠游標移到左邊 A1 單元格的 #REF! 錯誤上，點選彈窗裡的「允許存取 (Allow access)」按鈕。解鎖後此工作表即可刪除。');
                          SpreadsheetApp.flush();
                      }
                  } catch (sheetErr) {
                      debugLog.push(`Helper sheet creation failed: ${sheetErr.toString()}`);
                  }
              }
              
              if (values.length > 1 && String(values[0][0]).indexOf('Error') === -1) {
                  for (let i = 0; i < values.length; i++) {
                      const text = String(values[i][0]);
                      if (text.indexOf(`(${currency})`) !== -1 || text.indexOf(currency) !== -1) {
                          const r = parseFloat(values[i][4]);
                          if (!isNaN(r) && r > 0) {
                              rate = r;
                              usedDate = queryDate;
                              debugLog.push(`[${queryDate}] Channel 3 success`);
                              break;
                          }
                      }
                  }
              }
          } catch (e) {
              debugLog.push(`[${queryDate}] Channel 3 exception: ${e.toString()}`);
          }
      }
      
      if (rate !== null) {
          break;
      }
      
      currentSearchDate.setDate(currentSearchDate.getDate() - 1);
      attempts++;
  }
  
  if (rate !== null) {
      // 成功了！嘗試自動清理授權引導工作表
      try {
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          const authSheet = ss.getSheetByName('允許匯率授權(請點A1允許)');
          if (authSheet) {
              ss.deleteSheet(authSheet);
              SpreadsheetApp.flush();
          }
      } catch (e) {
          console.warn('Failed to delete helper sheet: ' + e);
      }

      const response = { 
          status: 'success', 
          rate: rate, 
          date: usedDate, 
          message: `[V1.3-RangeFetch] Rate for ${currency} on ${usedDate}. Debug: ${debugLog.join('; ')}` 
      };
      scriptCache.put(cacheKey, JSON.stringify(response), 21600);
      executionRateCache[executionRateCacheKey] = response;
      return response;
  } else {
      console.warn(`Could not find rate for ${currency} around ${dateStr}, using fallback.`);
      const fallbackResponse = { 
          status: 'success', 
          rate: fallbackRates[currency] || 1.0, 
          isFallback: true, 
          message: `[V1.3-RangeFetch] Fallback used. Debug: ${debugLog.join('; ')}` 
      };
      scriptCache.put(cacheKey, JSON.stringify(fallbackResponse), 15);
      executionRateCache[executionRateCacheKey] = fallbackResponse;
      return fallbackResponse;
  }
}

// Alias for legacy/mismatched calls
function getBotRate(payload) {
    return getExchangeRate(payload);
}

function searchFlight(payload) {
  // payload: { code, date }
  // date format: YYYY/MM/DD or YYYY-MM-DD
  let code = (payload.code || '').toUpperCase().trim();
  const dateStr = payload.date || '';

  // Remove spaces from code (e.g. "BR 892" -> "BR892")
  code = code.replace(/\s+/g, '');

  if (!code || !dateStr) return { status: 'success', data: null, message: 'Missing code or date' };

  try {
    // Try to get sheet, handle error gracefully if it doesn't exist
    let sheet;
    try {
        sheet = getSheet('Flights');
    } catch (e) {
        console.warn('Flights sheet not found');
        return { status: 'success', data: null, message: 'Flights sheet not found' };
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return { status: 'success', data: null, message: 'Invalid Date' };
    
    // JS getDay(): 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const jsDay = date.getDay(); 
    // Convert to ISO Day used often in flight schedules (1=Mon, 7=Sun)
    const isoDay = jsDay === 0 ? 7 : jsDay;
    
    const data = sheetDataToJson('Flights'); // Helper from Database.gs
    
    if (!data || data.length === 0) {
        return { status: 'success', data: null, message: 'No flight data' };
    }

    // Identify keys based on first row to support different headers
    const firstRow = data[0];
    const keys = Object.keys(firstRow);
    
    // Helper to find key case-insensitively
    const findKey = (candidates) => keys.find(k => candidates.some(c => k.toLowerCase().includes(c.toLowerCase())));

    const keyCode = findKey(['Flight Code', 'FlightNumber', 'Code', '航班代號']);
    const keyDay = findKey(['Day', 'Week', 'Days', '星期']);
    const keyDep = findKey(['Departure', 'Dep', 'Origin', 'From', 'DepartureAirportID', '出發地']);
    const keyArr = findKey(['Arrival', 'Arr', 'Destination', 'To', 'ArrivalAirportID', '抵達地']);
    const keyDepTime = findKey(['Dep Time', 'DepartureTime', 'STD', '出發時間']);
    const keyArrTime = findKey(['Arr Time', 'ArrivalTime', 'STA', '抵達時間']);

    if (!keyCode) {
         console.warn('Flight Code column not found');
         return { status: 'success', data: null, message: 'Flight Code column not found' };
    }

    console.log(`Searching for flight: ${code} on day ${isoDay} (ISO)`);
    console.log(`Keys mapped: Code=${keyCode}, Day=${keyDay}, Dep=${keyDep}, Arr=${keyArr}`);

    // Filter by Flight Code first
    const flightRows = data.filter(r => {
        const rowCode = String(r[keyCode]).toUpperCase().replace(/\s+/g, '');
        return rowCode === code;
    });

    if (flightRows.length === 0) {
        return { status: 'success', data: null, message: `Flight ${code} not found` };
    }

    let match = null;

    // Day matching logic
    if (keyDay) {
        match = flightRows.find(r => {
            const val = r[keyDay];
            if (!val) return false;
            const s = String(val).trim();
            
            // Check for "Daily"
            if (s.toLowerCase() === 'daily') return true;

            // Check if day matches
            // Support: "1", "1,3,5", "Mon", "1-5" (simple range not fully supported yet but comma is)
            if (s.includes(',')) {
                return s.split(',').map(d => parseInt(d.trim())).includes(isoDay);
            }
            // Support exact number match
            if (parseInt(s) === isoDay) return true;
            
            return false;
        });
    }

    // Fallback: If no match found by day, or no day column, use the first row for this code
    // Prioritize day match if possible
    if (!match) {
        // If we have rows but no day match, maybe the schedule is simpler or day col is missing/complex
        // Just take the first one as a best guess
        console.log('No specific day match found, returning first row for flight code.');
        match = flightRows[0];
    }

    if (match) {
        return {
            status: 'success',
            data: {
                departure: match[keyDep] || '',
                arrival: match[keyArr] || '',
                depTime: formatTime(match[keyDepTime]),
                arrTime: formatTime(match[keyArrTime])
            }
        };
    }
    
    return { status: 'success', data: null, message: 'Flight found but no schedule match' };

  } catch (e) {
    console.log('Error searching flight: ' + e);
    return { status: 'error', message: e.toString() };
  }
}

// Helper to format time object from sheet (which might be a Date object) to HH:mm string
function formatTime(val) {
    if (!val) return '';
    if (val instanceof Date) {
        const h = String(val.getHours()).padStart(2, '0');
        const m = String(val.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    }
    return String(val); // If it's already a string
}

function getAllFlights() {
    try {
        let sheet;
        try {
            sheet = getSheet('Flights');
        } catch (e) {
            console.warn('Flights sheet not found');
            return { status: 'success', data: null, message: 'Flights sheet not found' };
        }
        const data = sheetDataToJson('Flights');
        return { status: 'success', data: data };
    } catch (e) {
        return { status: 'error', message: 'Failed to fetch flights: ' + e.toString() };
    }
}

function getAllCities() {
    try {
        const sheet = getSheet('Cities');
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) return { status: 'success', data: [] };
        
        const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().filter(Boolean).map(String);
        return { status: 'success', data: values };
    } catch (e) {
        console.warn('Cities sheet not found or error: ' + e);
        return { status: 'success', data: [] };
    }
}

function getAllCountries() {
    try {
        let sheet;
        try {
            sheet = getSheet('Countries');
        } catch(e) {
            // Automatically initialize the Countries sheet via setupDatabase
            try {
                setupDatabase();
                sheet = getSheet('Countries');
            } catch(setupErr) {
                console.warn('Failed to auto-create Countries sheet: ' + setupErr);
                // Fallback hardcoded if setup fails
                return { status: 'success', data: ['Taiwan', 'United States', 'China', 'Japan', 'South Korea', 'Vietnam', 'Thailand', 'Germany', 'United Kingdom', 'Canada', 'Singapore', 'Australia', 'New Zealand', 'France', 'Italy'] };
            }
        }
        const lastRow = sheet.getLastRow();
        if (lastRow < 2) return { status: 'success', data: [] };
        
        const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().filter(Boolean).map(String);
        return { status: 'success', data: values };
    } catch (e) {
        console.warn('Countries sheet error: ' + e);
        return { status: 'success', data: [] };
    }
}

