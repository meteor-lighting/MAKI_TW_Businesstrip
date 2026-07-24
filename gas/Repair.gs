function restoreReportHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let headerSheet = ss.getSheetByName('Report Header');
  
  // 1. 確保 Sheet 存在且有標題 (若已刪除則重建)
  if (!headerSheet) {
    headerSheet = ss.insertSheet('Report Header');
  }
  
  // 定義正確的標題順序 (與前端一致)
  const headerConf = [
     '報告編號', '代墊人報告編號', '用戶編號', '商旅天數', 
     '機票費總額', '個人住宿費總額', '總體住宿費總額', 
     '計程車費總額', '網路費總額', '社交費總額', '禮品費總額', 
     '手續費總額', '日支費總額', '其他費用總額', 
     'USD匯率', 
     '合計TWD個人總額', '合計TWD總體總額', '合計TWD平均總額', 
     '合計USD個人總額', '合計USD總體總額', '合計USD平均總額', 
     '建立時間'
  ];
  
  if (headerSheet.getLastRow() === 0) {
      headerSheet.appendRow(headerConf);
  }
  
  // 2. 從各個費用明細表中收集所有的 Report ID
  const categories = ['Flight', 'Accommodation', 'Taxi', 'Internet', 'Social', 'Gift', 'Handing Fee', 'Per Diem', 'Others'];
  let reportIds = new Set();
  
  categories.forEach(cat => {
      const sheet = ss.getSheetByName(cat);
      if (sheet && sheet.getLastRow() > 1) {
          const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues(); // 第一欄通常是報告編號
          data.forEach(row => {
              if (row[0]) reportIds.add(String(row[0]));
          });
      }
  });
  
  // 3. 檢查現有的 Report Header，避免重複
  const existingData = headerSheet.getDataRange().getValues();
  const existingIds = new Set();
  // 從第 2 列開始 (跳過標題)
  for (let i = 1; i < existingData.length; i++) {
      existingIds.add(String(existingData[i][0]));
  }
  
  // 4. 重建遺失的 Header 並觸發重新計算
  let restoredCount = 0;
  reportIds.forEach(id => {
      if (!existingIds.has(id)) {
          // 建立新的一列 (預設值)
          // 注意：用戶編號此時無法從明細得知，暫設為 '1'
          const newRow = [
              id, 
              '', 
              '1', // User ID Default
              0, // 商旅天數 (recalculate 會補算)
              0,0,0,0,0,0,0,0,0,0, // 各類別總額 (10個)
              1, // USD匯率 (預設 1)
              0,0,0,0,0,0, // 合計欄位
              new Date() // 建立時間
          ];
          headerSheet.appendRow(newRow);
          
          // 執行重新計算，填入正確金額與天數
          recalculateHeader(id);
          restoredCount++;
      }
  });
  
  const msg = "已修復 " + restoredCount + " 筆報告表頭。請重新整理網頁查看。";
  Logger.log(msg);
  console.log(msg);
}