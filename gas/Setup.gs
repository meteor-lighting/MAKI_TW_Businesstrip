function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const sheets = [
    { name: 'Member', headers: ['用戶編號', '用戶名稱', '用戶密碼', '用戶電郵地址', '建立時間'] },
    {
      name: 'Report Header',
      headers: ['報告編號', '用戶編號', '員工姓名', '部門名稱', '職稱', '出差事由', '出差地點', '商旅天數', '商旅起始日', '商旅結束日', 'USD匯率', '建立時間', '最後修改時間', '狀態']
    },
    { name: 'Flight', headers: ['報告編號', '次序', '日期', '航班代號', '出發地', '抵達地', '出發時間', '抵達時間', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Accommodation', headers: ['報告編號', '次序', '入住日期', '退房日期', '地區', '飯店', '幣別', '個人金額', 'TWD個人金額', '代墊金額', 'TWD代墊金額', '總體金額', 'TWD總體金額', '代墊人數', '每人每天金額', '匯率', '備註'] },
    { name: 'Taxi', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Internet', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Social', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Gift', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Handing Fee', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Per Diem', headers: ['報告編號', '次序', '開始日期', '結束日期', '地區', '幣別', '每日金額', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Advance Payment', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Others', headers: ['報告編號', '分類', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] }
  ];

  sheets.forEach(conf => {
    let sheet = ss.getSheetByName(conf.name);
    if (!sheet) {
      sheet = ss.insertSheet(conf.name);
    }
    // Set headers if empty
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, conf.headers.length).setValues([conf.headers]);
    }
  });

  Logger.log('Database setup completed.');
}
