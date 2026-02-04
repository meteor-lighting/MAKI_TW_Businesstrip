import React, { createContext, useContext, useState, useEffect } from 'react';
import { sendRequest } from '../services/api';

interface User {
    id: string;
    name: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    signIn: (username: string, password: string) => Promise<void>;
    signUp: (username: string, password: string, email: string) => Promise<void>;
    signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        // Check local storage for existing session (mock implementation)
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error('Failed to parse user from local storage', e);
                localStorage.removeItem('user');
            }
        }
        setIsLoading(false);
    }, []);

    const signIn = async (username: string, password: string) => {
        setIsLoading(true);
        try {
            const response = await sendRequest('signin', { username, password });
            if (response.status === 'success' && response.user) {
                setUser(response.user);
                localStorage.setItem('user', JSON.stringify(response.user));
                // Token handling should be here in real app
            } else {
                throw new Error(response.message || 'Login failed');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const signUp = async (username: string, password: string, email: string) => {
        setIsLoading(true);
        try {
            const response = await sendRequest('signup', { username, password, email });
            if (response.status !== 'success') {
                throw new Error(response.message || 'Signup failed');
            }
            // Auto login after signup? Or require explicit login. 
            // Prompt implies "Sign Up success -> Sign In".
        } finally {
            setIsLoading(false);
        }
    };

    const signOut = () => {
        setUser(null);
        localStorage.removeItem('user');
        // window.location.href = '/'; // Optional redirect
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
