import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider, ToastProvider, AuthProvider, useAuth } from './store.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Books from './pages/Books.jsx';
import Students from './pages/Students.jsx';
import Loans from './pages/Loans.jsx';
import Visits from './pages/Visits.jsx';
import Analytics from './pages/Analytics.jsx';

function Splash() {
    return (
        <div className="splash">
            <div className="splash__mark">A</div>
            <div className="splash__text">Opening the stacks…</div>
        </div>
    );
}

function Protected({ children }) {
    const { user, loading } = useAuth();
    const location = useLocation();
    if (loading) return <Splash />;
    if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
    return children;
}

function GuestOnly({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <Splash />;
    if (user) return <Navigate to="/dashboard" replace />;
    return children;
}

export default function App() {
    return (
        <ThemeProvider>
            <ToastProvider>
                <AuthProvider>
                    <BrowserRouter>
                        <Routes>
                            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
                            <Route element={<Protected><Layout /></Protected>}>
                                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                                <Route path="/dashboard" element={<Dashboard />} />
                                <Route path="/books" element={<Books />} />
                                <Route path="/students" element={<Students />} />
                                <Route path="/loans" element={<Loans />} />
                                <Route path="/visits" element={<Visits />} />
                                <Route path="/analytics" element={<Analytics />} />
                            </Route>
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </BrowserRouter>
                </AuthProvider>
            </ToastProvider>
        </ThemeProvider>
    );
}
