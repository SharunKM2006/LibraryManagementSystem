import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, BookOpen, GraduationCap, ArrowLeftRight, DoorOpen,
    BarChart3, Sun, Moon, Search, LogOut, Menu, X, Command
} from 'lucide-react';
import { useAuth, useTheme } from '../store.jsx';
import { initials } from '../api';
import CommandPalette from './CommandPalette.jsx';

const NAV = [
    { section: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
    {
        section: 'Circulation',
        items: [
            { to: '/loans', label: 'Loans', icon: ArrowLeftRight },
            { to: '/visits', label: 'Library visits', icon: DoorOpen }
        ]
    },
    {
        section: 'Collections',
        items: [
            { to: '/books', label: 'Catalogue', icon: BookOpen },
            { to: '/students', label: 'Members', icon: GraduationCap }
        ]
    },
    { section: 'Insights', items: [{ to: '/analytics', label: 'Analytics', icon: BarChart3 }] }
];

const TITLES = {
    '/dashboard': ['Dashboard', 'A live read on circulation, occupancy and due dates'],
    '/books': ['Catalogue', 'Every title on the shelves, with stock at a glance'],
    '/students': ['Members', 'The community registered with the library'],
    '/loans': ['Loans', 'Issue, track and recover borrowed copies'],
    '/visits': ['Library visits', 'Who is in the building right now'],
    '/analytics': ['Analytics', 'Trends across circulation, collection and footfall']
};

export default function Layout() {
    const { user, logout } = useAuth();
    const { theme, toggle } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [navOpen, setNavOpen] = useState(false);

    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setPaletteOpen(v => !v);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => { setNavOpen(false); }, [location.pathname]);

    const [title, subtitle] = TITLES[location.pathname] || ['Athenaeum', ''];

    return (
        <div className="shell">
            {navOpen && <div className="sidebar__scrim" onClick={() => setNavOpen(false)} />}
            <aside className={`sidebar ${navOpen ? 'sidebar--open' : ''}`}>
                <div className="sidebar__brand">
                    <span className="brand__mark">A</span>
                    <span className="brand__name">Athenaeum</span>
                    <button className="brand__close" onClick={() => setNavOpen(false)} aria-label="Close menu">
                        <X size={18} />
                    </button>
                </div>

                <nav className="sidebar__nav">
                    {NAV.map(group => (
                        <div className="sidebar__section" key={group.section}>
                            <div className="sidebar__label">{group.section}</div>
                            {group.items.map(item => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                >
                                    <item.icon size={17} strokeWidth={2} />
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="sidebar__foot">
                    <div className="lib-card">
                        <span className="avatar avatar--sm">{initials(user?.fullname)}</span>
                        <span className="lib-card__meta">
                            <strong>{user?.fullname}</strong>
                            <small>{user?.title}</small>
                        </span>
                    </div>
                    <button className="nav-item nav-item--danger" onClick={() => logout()}>
                        <LogOut size={17} strokeWidth={2} />
                        <span>Sign out</span>
                    </button>
                </div>
            </aside>

            <div className="shell__main">
                <header className="topbar">
                    <button className="icon-btn topbar__menu" onClick={() => setNavOpen(true)} aria-label="Open menu">
                        <Menu size={18} />
                    </button>
                    <div className="topbar__title">
                        <h1 className="page-title">{title}</h1>
                        <p className="page-sub">{subtitle}</p>
                    </div>
                    <div className="topbar__actions">
                        <button className="kbd-btn" onClick={() => setPaletteOpen(true)}>
                            <Search size={15} />
                            <span>Search anything</span>
                            <kbd><Command size={11} /> K</kbd>
                        </button>
                        <button className="icon-btn" onClick={toggle} aria-label="Toggle theme">
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <button className="icon-btn icon-btn--danger" onClick={() => logout()} aria-label="Sign out">
                            <LogOut size={18} />
                        </button>
                    </div>
                </header>

                <main className="content">
                    <Outlet />
                </main>
            </div>

            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={navigate} />
        </div>
    );
}
