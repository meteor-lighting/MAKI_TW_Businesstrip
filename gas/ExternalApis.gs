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
  // Mocking
  return {
    data: [
      { name: 'Taipei', countryName: 'Taiwan' },
      { name: 'Tokyo', countryName: 'Japan' },
      { name: 'New York', countryName: 'United States' }
    ]
  };
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
