import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

// --------------------------------- theme ----------------------------------
const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('athenaeum-theme');
        if (saved) return saved;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('athenaeum-theme', theme);
    }, [theme]);

    const toggle = useCallback(() => setTheme(t => (t === 'dark' ? 'light' : 'dark')), []);
    const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
    return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

// --------------------------------- toasts ---------------------------------
const ToastCtx = createContext(null);

let toastSeq = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const push = useCallback((type, msg) => {
        const id = ++toastSeq;
        setToasts(list => [...list, { id, type, msg }]);
        setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), 4000);
    }, []);

    const toast = useMemo(() => ({
        success: (m) => push('success', m),
        error: (m) => push('error', m),
        info: (m) => push('info', m)
    }), [push]);

    return (
        <ToastCtx.Provider value={toast}>
            {children}
            <div className="toasts" role="status" aria-live="polite">
                {toasts.map(t => (
                    <div key={t.id} className={`toast toast--${t.type}`}>
                        <span className="toast__dot" />
                        <span>{t.msg}</span>
                    </div>
                ))}
            </div>
        </ToastCtx.Provider>
    );
}

export const useToast = () => useContext(ToastCtx);

// ---------------------------------- auth ----------------------------------
const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api('/auth/me')
            .then(data => setUser(data.librarian))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const login = useCallback(async (email, password) => {
        const data = await api('/auth/login', { method: 'POST', body: { email, password } });
        setUser(data.librarian);
        return data.librarian;
    }, []);

    const logout = useCallback(async () => {
        try { await api('/auth/logout', { method: 'POST' }); } finally { setUser(null); }
    }, []);

    const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
    return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
