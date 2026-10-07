import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Search, CornerDownLeft, BookOpen, GraduationCap, LayoutDashboard,
    ArrowLeftRight, DoorOpen, BarChart3, Plus, UserPlus, LogOut
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../store.jsx';

const NAV_ITEMS = [
    { label: 'Go to Dashboard', icon: LayoutDashboard, to: '/dashboard', group: 'Navigate' },
    { label: 'Go to Catalogue', icon: BookOpen, to: '/books', group: 'Navigate' },
    { label: 'Go to Loans', icon: ArrowLeftRight, to: '/loans', group: 'Navigate' },
    { label: 'Go to Members', icon: GraduationCap, to: '/students', group: 'Navigate' },
    { label: 'Go to Library visits', icon: DoorOpen, to: '/visits', group: 'Navigate' },
    { label: 'Go to Analytics', icon: BarChart3, to: '/analytics', group: 'Navigate' },
    { label: 'Add a book', icon: Plus, to: '/books?new=1', group: 'Quick actions' },
    { label: 'Register a member', icon: UserPlus, to: '/students?new=1', group: 'Quick actions' },
    { label: 'Issue a loan', icon: Plus, to: '/loans?new=1', group: 'Quick actions' },
    { label: 'Check a member in', icon: Plus, to: '/visits?new=1', group: 'Quick actions' },
    { label: 'Sign out', icon: LogOut, to: '/logout', group: 'Quick actions' }
];

function score(query, text) {
    // Cheap subsequence match: exact substring scores highest.
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    const idx = t.indexOf(q);
    if (idx === 0) return 100;
    if (idx > 0) return 70 - Math.min(idx, 30);
    let qi = 0;
    for (let i = 0; i < t.length && qi < q.length; i++) {
        if (t[i] === q[qi]) qi++;
    }
    return qi === q.length ? 20 : -1;
}

export default function CommandPalette({ open, onClose, onNavigate }) {
    const { logout } = useAuth();
    const location = useLocation();
    const [query, setQuery] = useState('');
    const [cursor, setCursor] = useState(0);
    const [results, setResults] = useState({ books: [], students: [] });
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);
    const loadedRef = useRef('');

    useEffect(() => {
        if (open) {
            setQuery('');
            setCursor(0);
            inputRef.current?.focus();
        }
    }, [open]);

    // Fetch books + members once per open, then filter locally as you type.
    useEffect(() => {
        if (!open) return;
        const key = location.key;
        if (loadedRef.current === key) return;
        loadedRef.current = key;
        let cancelled = false;
        setLoading(true);
        Promise.all([api('/books'), api('/students')])
            .then(([books, students]) => {
                if (!cancelled) setResults({ books, students });
            })
            .catch(() => { /* palette still works for navigation */ })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [open, location.key]);

    const items = useMemo(() => {
        const q = query.trim();
        const list = [];

        for (const nav of NAV_ITEMS) {
            const s = q ? score(q, nav.label) : 50;
            if (s > 0) list.push({ ...nav, score: s + 5, key: `nav-${nav.to}` });
        }

        if (q) {
            for (const b of results.books) {
                const s = score(q, `${b.title} ${b.author}`);
                if (s > 0) list.push({
                    key: `b-${b._id}`, group: 'Catalogue', icon: BookOpen,
                    label: b.title, sub: b.author, to: `/books?q=${encodeURIComponent(b.title)}`,
                    score: s, cover: true
                });
            }
            for (const st of results.students) {
                const s = score(q, `${st.usn} ${st.fullname}`);
                if (s > 0) list.push({
                    key: `s-${st._id}`, group: 'Members', icon: GraduationCap,
                    label: st.fullname, sub: st.usn, to: `/students?q=${encodeURIComponent(st.usn)}`,
                    score: s
                });
            }
        }

        return list.sort((a, b) => b.score - a.score).slice(0, 12);
    }, [query, results]);

    useEffect(() => { setCursor(0); }, [query, items.length]);

    if (!open) return null;

    const run = (item) => {
        if (!item) return;
        onClose();
        if (item.to === '/logout') { logout(); return; }
        onNavigate(item.to);
    };

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, items.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); run(items[cursor]); }
        else if (e.key === 'Escape') { onClose(); }
    };

    let lastGroup = null;

    return (
        <div className="palette-overlay" onMouseDown={onClose}>
            <div className="palette" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
                <div className="palette__input-row">
                    <Search size={17} className="palette__search-icon" />
                    <input
                        ref={inputRef}
                        className="palette__input"
                        placeholder="Search books, members, or jump somewhere…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Command palette"
                    />
                    {loading && <span className="palette__loading">loading…</span>}
                    <kbd className="palette__esc">esc</kbd>
                </div>

                <div className="palette__list">
                    {items.length === 0 && (
                        <div className="palette__empty">No matches for “{query}”</div>
                    )}
                    {items.map((item, i) => {
                        const showGroup = item.group && item.group !== lastGroup;
                        lastGroup = item.group;
                        return (
                            <div key={item.key}>
                                {showGroup && <div className="palette__group">{item.group}</div>}
                                <button
                                    className={`palette__item ${i === cursor ? 'is-active' : ''}`}
                                    onMouseEnter={() => setCursor(i)}
                                    onClick={() => run(item)}
                                >
                                    <span className="palette__item-icon">
                                        <item.icon size={15} />
                                    </span>
                                    <span className="palette__item-label">{item.label}</span>
                                    {item.sub && <span className="palette__item-sub">{item.sub}</span>}
                                    {i === cursor && <CornerDownLeft size={13} className="palette__enter" />}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <div className="palette__foot">
                    <span><kbd>↑↓</kbd> move</span>
                    <span><kbd>↵</kbd> open</span>
                    <span><kbd>esc</kbd> close</span>
                </div>
            </div>
        </div>
    );
}
