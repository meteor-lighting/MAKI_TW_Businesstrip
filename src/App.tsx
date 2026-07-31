import React, { lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import './i18n';

const SignIn = lazy(() => import('./pages/SignIn'));
const SignUp = lazy(() => import('./pages/SignUp'));
const Report = lazy(() => import('./pages/Report'));
const ReportSetup = lazy(() => import('./pages/ReportSetup'));
const ExpenseReportPage = lazy(() => import('./components/Report/ExpenseReportPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Home = lazy(() => import('./pages/Home'));
const History = lazy(() => import('./pages/History'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

function AppLoading() {
    return (
        <div
            role="status"
            aria-live="polite"
            className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-6 text-sm font-medium text-slate-500"
        >
            Loading...
        </div>
    );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated, isLoading } = useAuth();

    if (isLoading) return <AppLoading />;
    if (!isAuthenticated) return <Navigate to="/" />;
    if (user?.mustResetPassword) return <Navigate to="/reset-password" replace />;

    return <>{children}</>;
}

function App() {
    const queryRecovery = new URLSearchParams(window.location.search).has('password-recovery');
    const hashRecovery = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type') === 'recovery';
    const isPasswordRecovery = queryRecovery || hashRecovery;

    // Implicit recovery links place Auth tokens in the hash, which conflicts
    // with HashRouter. Render the reset screen before the router consumes it.
    if (isPasswordRecovery) {
        return (
            <AuthProvider>
                <Suspense fallback={<AppLoading />}>
                    <ResetPassword />
                </Suspense>
            </AuthProvider>
        );
    }

    return (
        <Router>
            <AuthProvider>
                <Suspense fallback={<AppLoading />}>
                    <Routes>
                        <Route path="/" element={isPasswordRecovery ? <ResetPassword /> : <SignIn />} />
                        <Route path="/signup" element={<SignUp />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route
                            path="/home"
                            element={
                                <ProtectedRoute>
                                    <Home />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/history"
                            element={
                                <ProtectedRoute>
                                    <History />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/dashboard"
                            element={
                                <ProtectedRoute>
                                    <Dashboard />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/report/setup"
                            element={
                                <ProtectedRoute>
                                    <ReportSetup />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/report"
                            element={
                                <ProtectedRoute>
                                    <Report />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/report/summary"
                            element={
                                <ProtectedRoute>
                                    <ExpenseReportPage />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </Suspense>
            </AuthProvider>
        </Router>
    );
}

export default App;
