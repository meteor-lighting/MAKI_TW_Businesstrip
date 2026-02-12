/**
 * External APIs Proxy
 */

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
    if (lastRow < 1) return { data: [] };
    
    // Read all cities. Caching this in ScriptProperties or CacheService might be good optimization 
    // but for now direct read is safer for consistency.
    // If the list is huge (e.g. 20k rows), reading might be slow. 
    // Optimization: filtering in sheet? No, sheet filter is for UI. 
    // We fetch all values and filter in memory. JS is fast enough for ~10k items.
    // If >100k, we might need a better approach.
    const values = sheet.getRange(1, 1, lastRow, 1).getValues().flat(); 
    
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

  if (currency === 'TWD') return { status: 'success', rate: 1.0 };

  // If no date, use today? Or return error? 
  // For now default to today if missing, but usually provided.
  if (!dateStr) {
      const today = new Date();
      dateStr = `${today.getFullYear()}/${today.getMonth()+1}/${today.getDate()}`;
  }

  // Target: Previous Day (T-1)
  // If T-1 is holiday, keep going back up to 5 days.
  
  const targetDate = new Date(dateStr);
  if (isNaN(targetDate.getTime())) return { status: 'error', message: 'Invalid Date' };

  // Note: We need T-1 relative to the Input Date.
  // We will loop back starting from T-1.
  
  // Start from T-1
  let currentSearchDate = new Date(targetDate);
  currentSearchDate.setDate(currentSearchDate.getDate() - 1);
  
  let attempts = 0;
  let rate = null;
  let usedDate = '';
  const debugLog = [];
  // Loop up to 5 days back
  while (rate === null && attempts < 5) {
      const yyyy = currentSearchDate.getFullYear();
      const mm = String(currentSearchDate.getMonth() + 1).padStart(2, '0');
      const dd = String(currentSearchDate.getDate()).padStart(2, '0');
      const queryDate = `${yyyy}-${mm}-${dd}`; // BOT uses YYYY-MM-DD in URL
      console.log(`Fetching rate for ${currency} on ${queryDate} (Attempt ${attempts + 1})`);
      
      try {
          const url = `https://rate.bot.com.tw/xrt/all/${queryDate}`;
          const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
          
          if (response.getResponseCode() !== 200) {
              debugLog.push(`[${queryDate}] HTTP ${response.getResponseCode()}`);
          } else {
              const html = response.getContentText();
              
              // Robust parsing: Split by table rows
              const rows = html.split('<tr');
              let foundRow = false;
              
              for (const rowFragment of rows) {
                  // Re-add <tr to make it look like tag if needed, but not strictly necessary for content check
                  // Check if this row fragment contains our currency code in parens e.g. (USD)
                  if (rowFragment.includes(`(${currency})`)) {
                      foundRow = true;
                      
                      // Find all `rate-content-sight` cells in this row
                      // Pattern: <td ... class="...rate-content-sight..." ...>RATE</td>
                      const cellRegex = /class="[^"]*rate-content-sight[^"]*"[^>]*>([\d.]+)<\/td>/g;
                      let result;
                      const cellValues = [];
                      
                      while ((result = cellRegex.exec(rowFragment)) !== null) {
                          cellValues.push(result[1]);
                      }
                      
                      // Typically: cellValues[0] = Spot Buy, cellValues[1] = Spot Sell
                      if (cellValues.length >= 2) {
                          const r = parseFloat(cellValues[1]);
                          if (!isNaN(r)) {
                              rate = r;
                              usedDate = queryDate;
                          } else {
                              debugLog.push(`[${queryDate}] Rate parsing NaN: ${cellValues[1]}`);
                          }
                      } else {
                          debugLog.push(`[${queryDate}] Insufficient cells found: ${cellValues.length}`);
                      }
                      break; // Stop looking at other rows
                  }
              }
              
              if (!foundRow) {
                  debugLog.push(`[${queryDate}] Row for (${currency}) not found`);
              }
          }
      } catch (e) {
          console.warn(`Fetch error for ${queryDate}: ${e}`);
          debugLog.push(`[${queryDate}] Exception: ${e.toString()}`);
      }

      // If failed (rate is still null), go back 1 more day
      currentSearchDate.setDate(currentSearchDate.getDate() - 1);
      attempts++;
  }

  if (rate !== null) {
      return { 
          status: 'success', 
          rate: rate, 
          date: usedDate, 
          message: `Rate for ${currency} on ${usedDate}` 
      };
  } else {
      // Fallback to mock/default if all fail
      console.warn(`Could not find rate for ${currency} around ${dateStr}, using fallback.`);
      const fallbackRates = {
          'USD': 30.0, 'JPY': 0.21, 'EUR': 32.5, 'CNY': 4.2, 'TWD': 1.0
      };
      return { 
          status: 'success', 
          rate: fallbackRates[currency] || 1.0, 
          isFallback: true,
          message: `Fallback used. Debug: ${debugLog.join('; ')}` 
      };
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
