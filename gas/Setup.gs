function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const sheets = [
    { name: 'Member', headers: ['用戶編號', '用戶名稱', '用戶密碼', '用戶電郵地址', '建立時間', '用戶權限'] },
    {
      name: 'Report Header',
      headers: ['報告編號', '用戶編號', '員工姓名', '部門名稱', '職稱', '出差事由', '出差國家', '商旅天數', '商旅起始日', '商旅結束日', 'USD匯率', '建立時間', '最後修改時間', '狀態', '報告名稱']
    },
    { name: 'Flight', headers: ['報告編號', '次序', '日期', '航班代號', '出發地', '抵達地', '出發時間', '抵達時間', '跨日', '幣別', '金額', 'TWD金額', '匯率', '備註', '行程類型', '回程日期', '回程航班代號', '回程出發地', '回程抵達地', '回程出發時間', '回程抵達時間', '回程跨日'] },
    { name: 'Accommodation', headers: ['報告編號', '次序', '入住日期', '退房日期', '地區', '飯店', '幣別', '個人金額', 'TWD個人金額', '代墊金額', 'TWD代墊金額', '總體金額', 'TWD總體金額', '代墊人數', '每人每天金額', '匯率', '備註'] },
    { name: 'Rental Car', headers: ['報告編號', '次序', '借車日期', '還車日期', '地區', '租車公司', '幣別', '個人金額', 'TWD個人金額', '代墊金額', 'TWD代墊金額', '總體金額', 'TWD總體金額', '代墊人數', '每人每天金額', '匯率', '備註'] },
    { name: 'Transportation', headers: ['報告編號', '次序', '日期', '交通工具', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Gas', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Parking', headers: ['報告編號', '次序', '開始日期', '結束日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Internet', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Social', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Gift', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Luggage Fee', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Handing Fee', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Per Diem', headers: ['報告編號', '次序', '開始日期', '結束日期', '地區', '幣別', '每日金額', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Advance Payment', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Lunch & Learn', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '經銷商', '人數'] },
    { name: 'Countries', headers: ['國家名稱'] },
    { name: 'Cities', headers: ['城市名稱'] }
  ];

  sheets.forEach(conf => {
    let sheet = ss.getSheetByName(conf.name);
    if (!sheet) {
      sheet = ss.insertSheet(conf.name);
    }
    // Set headers if empty
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, conf.headers.length).setValues([conf.headers]);
      
      // Seed default countries if it's the Countries sheet
      if (conf.name === 'Countries') {
        const defaultCountries = [
          ['Taiwan'], ['United States'], ['Japan'], ['South Korea'], ['China'],
          ['Vietnam'], ['Thailand'], ['Singapore'], ['Germany'], ['United Kingdom'],
          ['Canada'], ['Australia'], ['New Zealand'], ['France'], ['Italy']
        ];
        sheet.getRange(2, 1, defaultCountries.length, 1).setValues(defaultCountries);
      }

      // Seed default cities if it's the Cities sheet
      if (conf.name === 'Cities') {
        const defaultCities = [
          ['Taipei'], ['New Taipei City'], ['Taoyuan'], ['Taichung'], ['Tainan'],
          ['Kaohsiung'], ['Hsinchu'], ['Hong Kong'], ['Macau'], ['Tokyo'],
          ['Osaka'], ['Kyoto'], ['Seoul'], ['Busan'], ['Shanghai'],
          ['Beijing'], ['Shenzhen'], ['Guangzhou'], ['Singapore'], ['Bangkok'],
          ['Ho Chi Minh City'], ['Hanoi'], ['Manila'], ['Jakarta'], ['Kuala Lumpur'],
          ['New York'], ['Los Angeles'], ['San Francisco'], ['Seattle'], ['Chicago'],
          ['London'], ['Paris'], ['Berlin'], ['Munich'], ['Frankfurt'],
          ['Amsterdam'], ['Sydney'], ['Melbourne']
        ];
        sheet.getRange(2, 1, defaultCities.length, 1).setValues(defaultCities);
      }
    }
  });

  Logger.log('Database setup completed.');
}
