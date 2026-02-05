import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import ExpenseReportPage from './components/Report/ExpenseReportPage';
import { AuthProvider } from './context/AuthContext';
import './i18n';

// function ProtectedRoute removed as it is unused in this context

function App() {
    return (
        <Router basename={import.meta.env.BASE_URL}>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<SignIn />} />
                    <Route path="/signup" element={<SignUp />} />
                    <Route path="/report" element={<ExpenseReportPage />} />
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;
