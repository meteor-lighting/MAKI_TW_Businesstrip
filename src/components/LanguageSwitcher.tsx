import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LanguageSwitcher: React.FC = () => {
    const { i18n } = useTranslation();

    const toggleLanguage = () => {
        const newLang = i18n.language === 'zh' ? 'en' : 'zh';
        i18n.changeLanguage(newLang);
    };

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-sm font-medium"
            title="Switch Language / 切換語言"
        >
            <Globe size={18} />
            <span>{i18n.language === 'zh' ? 'EN' : '中文'}</span>
        </button>
    );
};

export default LanguageSwitcher;
