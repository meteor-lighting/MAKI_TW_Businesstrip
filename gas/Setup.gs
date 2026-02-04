function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const sheets = [
    { name: 'Member', headers: ['用戶編號', '用戶名稱', '用戶密碼', '用戶電郵地址', '建立時間'] },
    { name: 'Report Header', headers: ['報告編號', '代墊人報告編號', '用戶編號', '商旅天數', '機票費總額', '個人住宿費總額', '總體住宿費總額', '計程車費總額', '網路費總額', '社交費總額', '禮品費總額', '手續費總額', '日支費總額', '其他費用總額', 'USD匯率', '合計TWD個人總額', '合計TWD總體總額', '合計USD個人總額', '合計USD總體總額', '合計TWD個人平均', '合計TWD總體平均', '合計USD個人平均', '合計USD總體平均', '建立時間'] },
    { name: 'Flight', headers: ['報告編號', '次序', '日期', '航班代號', '出發地', '抵達地', '出發時間', '抵達時間', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Accommodation', headers: ['報告編號', '次序', '日期', '地區', '天數', '幣別', '個人金額', 'TWD個人金額', '代墊金額', 'TWD代墊金額', '總體金額', 'TWD總體金額', '代墊人數', '每人每天金額', '匯率', '備註'] },
    { name: 'Taxi', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Internet', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Social', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Gift', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Handing Fee', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
    { name: 'Per Diem', headers: ['報告編號', '次序', '日期', '地區', '幣別', '金額', 'TWD金額', '匯率', '備註'] },
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
