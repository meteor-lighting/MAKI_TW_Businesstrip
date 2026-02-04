import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Resources
const resources = {
    en: {
        translation: {
            "app_title": "Business Travel Expense Report",
            "sign_in": "Sign In",
            "sign_up": "Sign Up",
            "username": "Username",
            "password": "Password",
            "email": "Email",
            "submit": "Submit",
            "loading": "Loading...",
            "error": "Error",
            "success": "Success",
            "welcome": "Welcome",
            "report": "Report",
        }
    },
    zh: {
        translation: {
            "app_title": "商務旅行費用報告",
            "sign_in": "登入",
            "sign_up": "註冊",
            "username": "用戶名稱",
            "password": "密碼",
            "email": "電郵地址",
            "submit": "送出",
            "loading": "載入中...",
            "error": "錯誤",
            "success": "成功",
            "welcome": "歡迎",
            "report": "報告",
        }
    }
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: "zh", // default language
        fallbackLng: "en",
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
