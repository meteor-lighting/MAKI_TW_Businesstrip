# 本地開發記憶庫 (LOCAL_MEMORY.md)

這是一份針對 `MAKI_TW_Businesstrip` (差旅費用申報系統) 開發的歷史記憶及重要進度備忘錄。
當 AI 助理開始新的對話時，請先閱讀本檔案，以快速恢復對專案的脈絡與掌握。

## 專案概述 (Project Overview)
- **架構**：前端使用 React (TypeScript) + Vite 建置，後端依賴 Google Apps Script (GAS) 作為資料庫與 API 服務。
- **樣式**：使用 TailwindCSS 以及 i18n 進行多國語系化。圖示大量使用 `lucide-react`。
- **目的**：供內部員工進行跨國差旅費用申報及歷史單據查詢結算。

## 系統核心功能與進度 (Core Features & Progress)
1. **身份驗證與導航 (Auth & Navigation)**
   - 使用 `src/context/AuthContext.tsx` 進行前端狀態管理。
   - 登入後重定向至 `/home` (提供選擇「我的報告」或「歷史資料」)。
   - 使用 `/dashboard` 檢視個人目前的表單。

2. **報告與費用群組 (Expense Reports)**
   - 將差旅花費區分為多種分類：機票 (Flight)、住宿 (Accommodation)、租車 (Rental Car)、計程車 (Taxi)、瓦斯 (Gas)、停車 (Parking)、網路 (Internet)、交際 (Social)、禮品 (Gift)、行李費 (Luggage Fee)、手續費 (Handing Fee)、日支費 (Per Diem)、預支費用 (Advance Payment)、午餐與學習 (Lunch & Learn)、其他 (Others)。
   - 各類別皆有獨立且順序固定的表單輸入介面 (在 `src/components/Report/forms/` 內)。

3. **歷史資料查詢系統 (History Query)**
   - 位於 `/history` 的專屬查詢介面，包含「員工編號」、「報告名稱」、「地區」及「分類」。
   - **「全部」檢視**：會呈現該員工的綜合差旅列表，並自動加上了由後端計算好的「合計總額(TWD)」。
   - **「單一分類」檢視 (方案 A)**：動態產生對應分類的特定欄位（例如：出發地、抵達地）。
   - **格式優化**：已經處理好字串解析 (如將陣列格式的 JSON 地區字串拆分為一般逗號隔開)、時間 (HH:mm) 及日期 (YYYY/MM/DD) 攔截轉換，並在後端把 `Member` 的真名正確映射至歷史對象。

4. **後端 API 機制 (GAS)**
   - 包含於專案根目錄的 `gas/` 資料夾下 (`Code.gs`, `Setup.gs`, `Auth.gs`)。
   - 前端發送請求時，皆透過 `src/services/api.ts` 的 `sendRequest` 並轉呼叫到 GAS 部署的 `VITE_GAS_APP_URL` 介面上執行。

## 開發守則與約定 (Development Rules)
1. **直接更新此文件**：每次新增重大功能或修復棘手 Bug 後，必須自行更新此 `LOCAL_MEMORY.md`，新增開發日誌。
2. **多語系 (i18n)**：所有 UI 上的文字需要先在 `src/locales/zh.ts` 中註冊 Key，並依賴 `t('key', 'default_value')` 來呈現。
3. **保持元件分離**：獨立表單元件抽離在 `forms` 目錄，而共同 UI (如 DataGrid) 則是抽象獨立的層級。
4. **Git Ignore 同步**：若專案中的 `.gitignore` 內容有發生異動，必須同時記錄、同步並覆蓋儲存到根目錄下的 `gitignore.md` 當中。

---
## 開發日誌 (Changelog)
- **2026-04-02**
  - 修復 `/history` 當選擇特定分類時，沒有正確回傳 `Session Member Name` 導致只顯示 `1, 2, 3` 也就是 USER ID 的問題。
  - 將表格內的日期轉換為 YYYY/MM/DD，時間轉換成 HH:mm 格式。
  - 初步建立 `LOCAL_MEMORY.md` 紀錄。
