import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { sendRequest } from '../services/api';

import LanguageSwitcher from '../components/LanguageSwitcher';

export default function SignIn() {
    const { t } = useTranslation();
    const { signIn } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    // Forgot Password State
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await signIn(username, password);
            navigate('/report');
        } catch (err: any) {
            setError(err.message || t('error'));
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);
        try {
            const res = await sendRequest('forgotPassword', { email: resetEmail });
            if (res.status === 'success') {
                setSuccessMsg(t('password_reset_sent'));
                setTimeout(() => {
                    setIsForgotPassword(false);
                    setSuccessMsg('');
                    setResetEmail('');
                }, 3000);
            } else {
                setError(res.message || t('error'));
            }
        } catch (err: any) {
            setError(err.message || t('error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 relative">
            <div className="absolute top-4 right-4">
                <LanguageSwitcher />
            </div>
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        {isForgotPassword ? t('reset_password') : t('sign_in')}
                    </h2>
                </div>

                {isForgotPassword ? (
                    /* Forgot Password Form */
                    <form className="mt-8 space-y-6" onSubmit={handleForgotPassword}>
                        <div className="rounded-md shadow-sm -space-y-px">
                            <div>
                                <label htmlFor="reset-email" className="sr-only">{t('email')}</label>
                                <input
                                    id="reset-email"
                                    name="email"
                                    type="email"
                                    required
                                    className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                    placeholder={t('enter_email')}
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        {error && <div className="text-red-500 text-sm">{error}</div>}
                        {successMsg && <div className="text-green-500 text-sm">{successMsg}</div>}

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {loading ? t('loading') : t('send_reset_email')}
                            </button>
                        </div>

                        <div className="text-center">
                            <button
                                type="button"
                                className="font-medium text-indigo-600 hover:text-indigo-500"
                                onClick={() => {
                                    setIsForgotPassword(false);
                                    setError('');
                                    setSuccessMsg('');
                                }}
                            >
                                {t('back_to_login')}
                            </button>
                        </div>
                    </form>
                ) : (
                    /* Sign In Form */
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div className="rounded-md shadow-sm -space-y-px">
                            <div>
                                <label htmlFor="username" className="sr-only">{t('username')}</label>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                    placeholder={t('username')}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="sr-only">{t('password')}</label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                    placeholder={t('password')}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        {error && <div className="text-red-500 text-sm">{error}</div>}

                        <div className="flex items-center justify-between">
                            <div className="text-sm">
                                <button
                                    type="button"
                                    className="font-medium text-indigo-600 hover:text-indigo-500"
                                    onClick={() => {
                                        setIsForgotPassword(true);
                                        setError('');
                                    }}
                                >
                                    {t('forgot_password')}
                                </button>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {loading ? t('loading') : t('sign_in')}
                            </button>
                        </div>

                        <div className="text-center">
                            <button
                                type="button"
                                className="font-medium text-indigo-600 hover:text-indigo-500"
                                onClick={() => navigate('/signup')}
                            >
                                {t('sign_up')}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
