import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
    FileText, 
    History,
    LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Home: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { signOut, user } = useAuth();

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-4xl w-full">
                <div className="flex justify-between items-center mb-12">
                    <h1 className="text-3xl font-bold text-gray-900">
                        {t('app_title', 'Business Travel Expense Report')}
                    </h1>
                    <div className="flex items-center gap-4">
                        <span className="text-gray-600">
                            {user?.name || user?.id}
                        </span>
                        <button
                            onClick={signOut}
                            className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                            {t('logout', 'Logout')}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* My Reports Card */}
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 flex flex-col items-center text-center group"
                    >
                        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                            <FileText className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            {t('my_reports', '我的報告')}
                        </h2>
                        <p className="text-gray-500">
                            {t('my_reports_desc', '建立、編輯或查看您的差旅費用報告')}
                        </p>
                    </button>

                    {/* Historical Data Card */}
                    <button
                        onClick={() => navigate('/history')}
                        className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 flex flex-col items-center text-center group"
                    >
                        <div className="w-20 h-20 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
                            <History className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            {t('historical_data', '歷史資料')}
                        </h2>
                        <p className="text-gray-500">
                            {t('historical_data_desc', '查詢、篩選過往差旅紀錄與細項花費')}
                        </p>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Home;
