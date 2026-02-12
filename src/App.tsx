import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Report from './pages/Report';
import ExpenseReportPage from './components/Report/ExpenseReportPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import './i18n';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) return <div>Loading...</div>;
    if (!isAuthenticated) return <Navigate to="/" />;

    return <>{children}</>;
}

function App() {
    return (
        <Router>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<SignIn />} />
                    <Route path="/signup" element={<SignUp />} />
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
