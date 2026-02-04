# Business Travel Expense Report Application

A web-based application for managing and submitting business travel expenses. Built with React (Vite) on the frontend and Google Apps Script (GAS) with Google Sheets on the backend.

## Features

- **Form Management**: Dedicated forms for Flight, Accommodation, Taxi, and other expense categories.
- **Auto Exchange Rate**: Automatically fetches historical exchange rates (Bank of Taiwan) for USD expenses based on flight dates.
- **Smart Validation**: Disables forms until a flight (establishing the trip timeline) is added. Prevents data entry errors.
- **Summary Dashboard**: Real-time calculation of personal and overall totals with daily averages.
- **Excel Export**: Download reports directly as Excel files.

## Technical Stack

- **Frontend**: React, TypeScript, TailwindCSS, Vite
- **Backend/Database**: Google Apps Script, Google Sheets
- **Deployment**: GitHub Pages (Frontend), GAS Web App (Backend)

## Setup & Installation

### 1. Prerequisites
- Node.js (v20+ recommended)
- A Google Account (for Spreadsheet & GAS)

### 2. Frontend Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/meteor-lighting/MAKI_TW_Businesstrip.git
   cd MAKI_TW_Businesstrip
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure Environment Variables:
   - Create a `.env` file in the root directory.
   - Add your backend URL:
     ```env
     VITE_GAS_APP_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
     ```
4. Run locally:
   ```bash
   npm run dev
   ```

### 3. Backend Setup (Google Apps Script)
1. Create a new Google Sheet.
2. Go to **Extensions > Apps Script**.
3. Copy the code from `backend_code.md` (or the `gas/` folder if available) into your GAS project files (`Code.gs`, `Calculation.gs`, etc.).
   - Ensure you use the content from `backend_code.md` to get the latest logic (Auto-Rate, etc.).
4. Deploy as Web App:
   - Click **Deploy > New deployment**.
   - Select **Web app**.
   - Description: "v1".
   - Execute as: **Me**.
   - Who has access: **Anyone** (or restricted based on your organization needs, but frontend needs access).
   - Click **Deploy** and copy the **Web App URL**.
5. Update your frontend `.env` with this URL.

## Deployment (GitHub Actions)

This project is configured with GitHub Actions for automated deployment to GitHub Pages.

### How to Deploy
1. **Push to Main**: Any commit pushed to the `main` branch will trigger the workflow.
   ```bash
   git add .
   git commit -m "Your update message"
   git push origin main
   ```
2. **Monitor**: Go to the **Actions** tab in your GitHub repository to see the build progress.
3. **Settings**: Ensure GitHub Pages is enabled in your repo settings:
   - Go to **Settings > Pages**.
   - Under **Build and deployment**, select **Source** as `GitHub Actions`. (Or checks if the action automatically configures this, usually it pushes to a `gh-pages` branch or artifact). *Note: The provided workflow uses `actions/deploy-pages`, so ensure Pages is set to use GitHub Actions as the source.*

## Development Notes

- **`src/pages/Report.tsx`**: Main logic for the report form.
- **`gas/Calculation.gs`**: Backend calculation logic.
- **Auto-Rate Logic**: The backend automatically fetches the exchange rate for (Start Date - 1 day) when the first flight is added.
