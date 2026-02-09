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

    return { rate: rates[payload.currency] || 1.0 };
}

function searchFlight(payload) {
  // payload: { code, date }
  // date format: YYYY/MM/DD or YYYY-MM-DD
  const code = (payload.code || '').toUpperCase().trim();
  const dateStr = payload.date || '';

  if (!code || !dateStr) return { data: null };

  try {
    const sheet = getSheet('Flights');
    // Headers Assumption based on user request:
    // Flight Code, Day, Dep, Arr, Dep Time, Arr Time
    // Row 1 is headers. Data from Row 2.
    
    // We need to determine the "Day" from the date.
    // 1=Mon, 2=Tue, ... 7=Sun (ISO) or 0=Sun in JS.
    // Let's assume the sheet uses 1-7 (1=Mon) or English abbreviations.
    // Let's try to match flexible formats.
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return { data: null, message: 'Invalid Date' };
    
    // JS getDay(): 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const jsDay = date.getDay(); 
    // Convert to ISO Day used often in flight schedules (1=Mon, 7=Sun)
    const isoDay = jsDay === 0 ? 7 : jsDay;
    
    const data = sheetDataToJson('Flights'); // Helper from Database.gs
    
    // Helper to normalize day from sheet
    const normalizeSheetDay = (val) => {
        if (!val) return [];
        const s = String(val).trim();
        // If it's a number/string "1", "2"...
        if (!isNaN(s)) return [parseInt(s)];
        // If it's a range "1,3,5" or "1-5" (Too complex for now, assume single day per row or comma separated)
        if (s.includes(',')) return s.split(',').map(d => parseInt(d.trim()));
        // If keys "Mon", "Tue"
        // ... (Skipping complex parsing unless needed)
        // Let's assume exact match of ISO day (1-7) for simplicity first.
        return [parseInt(s)];
    };

    // Filter by Flight Code first
    const flightRows = data.filter(r => 
        String(r['Flight Code']).toUpperCase().trim() === code
    );

    // Find row matching day
    // TODO: Improve day matching if user confirms sheet format.
    // For now assuming the sheet has a 'Day' column with 1-7. 
    // And assuming we just default to the first match if 'Day' is missing or we can't parse.
    // Actually, flight schedules usually differ by day.
    
    let match = flightRows.find(r => {
        const rowDays = normalizeSheetDay(r['Day']); // e.g. [1, 3, 5]
        return rowDays.includes(isoDay);
    });
    
    // If no specific day match found, check if there's a daily flight (Day = "Daily" or empty or 0?)
    if (!match) {
        match = flightRows.find(r => !r['Day'] || String(r['Day']).toLowerCase() === 'daily');
    }
    
    // If still no match, but we have rows for this code, maybe just take the first one?
    // User requirement: "automatically convert date to weekday, then from Flights auto bring..."
    // This implies day matching is important.
    // If not found, return null. 
    // Fallback: If only 1 row exists for this code, return it regardless of day?
    if (!match && flightRows.length === 1) {
        match = flightRows[0];
    }

    if (match) {
        // Return format expected by frontend
        return {
            status: 'success',
            data: {
                departure: match['Dep'] || match['Departure'] || '',
                arrival: match['Arr'] || match['Arrival'] || '',
                depTime: formatTime(match['Dep Time']),
                arrTime: formatTime(match['Arr Time'])
            }
        };
    }
    
    return { status: 'success', data: null, message: 'Flight not found for this date' };

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
