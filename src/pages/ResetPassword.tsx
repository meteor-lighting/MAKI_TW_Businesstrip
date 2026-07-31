import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
    const { t } = useTranslation();
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);
    const [hasSession, setHasSession] = useState(false);

    useEffect(() => {
        let active = true;

        supabase.auth.getSession()
            .then(({ data, error: sessionError }) => {
                if (!active) return;
                if (sessionError) setError(sessionError.message);
                setHasSession(Boolean(data.session));
            })
            .catch((caught) => active && setError(caught instanceof Error ? caught.message : String(caught)))
            .finally(() => active && setCheckingSession(false));

        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
            if (!active) return;
            if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
                setHasSession(Boolean(session));
                setCheckingSession(false);
            } else if (event === 'SIGNED_OUT') {
                setHasSession(false);
            }
        });

        return () => {
            active = false;
            listener.subscription.unsubscribe();
        };
    }, []);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setMessage('');
        if (password.length < 8) return setError(t('password_min_length'));
        if (password !== confirmation) return setError(t('password_mismatch'));
        setLoading(true);
        try {
            const { error: passwordError } = await supabase.auth.updateUser({ password });
            if (passwordError) throw passwordError;
            setMessage(t('password_updated_message'));
            await supabase.auth.signOut();
            window.setTimeout(() => window.location.assign(appBaseUrl()), 1200);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : String(caught));
        } finally {
            setLoading(false);
        }
    };

    if (checkingSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow">
                    {t('password_reset_session_check')}
                </div>
            </div>
        );
    }

    if (!hasSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="w-full max-w-md rounded-xl bg-white p-8 shadow space-y-4">
                    <h1 className="text-2xl font-bold text-gray-900">{t('password_setup_required')}</h1>
                    <p className="text-sm text-gray-600">
                        {t('password_setup_return_hint')}
                    </p>
                    {error && <div className="text-sm text-red-600">{error}</div>}
                    <a
                        href={appBaseUrl()}
                        className="block w-full rounded bg-indigo-600 p-3 text-center font-medium text-white"
                    >
                        {t('return_to_sign_in')}
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <form onSubmit={submit} className="w-full max-w-md rounded-xl bg-white p-8 shadow space-y-5">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('set_new_password')}</h1>
                    <p className="mt-2 text-sm text-gray-600">{t('password_minimum_hint')}</p>
                </div>
                <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={t('new_password')}
                    className="w-full rounded border border-gray-300 p-3"
                />
                <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    placeholder={t('confirm_password_placeholder')}
                    className="w-full rounded border border-gray-300 p-3"
                />
                {error && <div className="text-sm text-red-600">{error}</div>}
                {message && <div className="text-sm text-green-600">{message}</div>}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded bg-indigo-600 p-3 font-medium text-white disabled:opacity-50"
                >
                    {loading ? t('processing') : t('update_password')}
                </button>
            </form>
        </div>
    );
}

function appBaseUrl() {
    return `${window.location.origin}${import.meta.env.BASE_URL}`;
}
