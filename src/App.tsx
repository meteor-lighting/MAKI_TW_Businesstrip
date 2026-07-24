import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Report from './pages/Report';
import ExpenseReportPage from './components/Report/ExpenseReportPage';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import History from './pages/History';
import ResetPassword from './pages/ResetPassword';
import { AuthProvider, useAuth } from './context/AuthContext';
import './i18n';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated, isLoading } = useAuth();

    if (isLoading) return <div>Loading...</div>;
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
                <ResetPassword />
            </AuthProvider>
        );
    }

    return (
        <Router>
            <AuthProvider>
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
            </AuthProvider>
        </Router>
    );
}

export default App;
