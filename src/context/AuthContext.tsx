import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadCurrentUser, sendRequest } from '../services/api';
import { supabase } from '../lib/supabase';

export interface User {
    /** Employee code used for display and legacy API compatibility. */
    id: string;
    /** Supabase Auth UUID. Use this value for database ownership checks. */
    authId?: string;
    name: string;
    email: string;
    role?: string;
    canViewOthers?: boolean;
    canCopyOthers?: boolean;
    mustResetPassword?: boolean;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    signIn: (username: string, password: string) => Promise<void>;
    signUp: (username: string, password: string, email: string) => Promise<void>;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshUser = async () => {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
            setUser(null);
            return;
        }
        setUser(await loadCurrentUser());
    };

    useEffect(() => {
        let active = true;
        supabase.auth.getSession()
            .then(async ({ data }) => {
                if (!active) return;
                if (data.session) setUser(await loadCurrentUser());
            })
            .catch((error) => console.error('Unable to restore Supabase session', error))
            .finally(() => active && setIsLoading(false));

        const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
            if (!active) return;
            if (!session) {
                setUser(null);
                setIsLoading(false);
            } else if (
                event === 'SIGNED_IN'
                || event === 'PASSWORD_RECOVERY'
                || event === 'TOKEN_REFRESHED'
                || event === 'USER_UPDATED'
            ) {
                window.setTimeout(() => {
                    loadCurrentUser().then(setUser).catch(console.error).finally(() => setIsLoading(false));
                }, 0);
            }
        });
        return () => {
            active = false;
            listener.subscription.unsubscribe();
        };
    }, []);

    const signIn = async (username: string, password: string) => {
        setIsLoading(true);
        try {
            const response = await sendRequest('signin', { username, password });
            if (response.status !== 'success' || !response.user) throw new Error(response.message || 'Login failed');
            setUser(response.user);
        } finally {
            setIsLoading(false);
        }
    };

    const signUp = async (username: string, password: string, email: string) => {
        setIsLoading(true);
        try {
            await sendRequest('signup', { username, password, email });
        } finally {
            setIsLoading(false);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        sessionStorage.removeItem('activeReportId');
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: Boolean(user),
            isLoading,
            signIn,
            signUp,
            signOut,
            refreshUser,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}
