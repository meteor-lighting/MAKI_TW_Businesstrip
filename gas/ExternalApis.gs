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
  // If currency is TWD, return 1.
  if (payload.currency === 'TWD') return { rate: 1.0 };
  
  // Scraping BOT or using other API.
  // Mocking:
  const rates = {
    'USD': 0,
    'JPY': 0.21,
    'EUR': 35.0
  };
  
  return { rate: rates[payload.currency] || 1.0 };
}
