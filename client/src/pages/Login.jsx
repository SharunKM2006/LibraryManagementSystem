import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Sun, Moon, KeyRound } from 'lucide-react';
import { useAuth, useTheme } from '../store.jsx';

const DEMO = [
    { fullname: 'Raghunath', email: 'ragunath@nmamit.in', password: 'abc@123', title: 'Head Librarian' },
    { fullname: 'Puneeth', email: 'puneeth@nmamit.in', password: 'abc@456', title: 'Circulation Desk' },
    { fullname: 'Darshan', email: 'darshan@nmamit.in', password: 'abc@789', title: 'Archive & Reference' }
];

const SPINES = [
    { h: 168, c: '#3E7CB1' }, { h: 138, c: '#A05A6E' }, { h: 186, c: '#6AA84F' },
    { h: 150, c: '#C75B5B' }, { h: 176, c: '#7E57C2' }, { h: 128, c: '#D7A86E' },
    { h: 190, c: '#4DD0E1' }, { h: 158, c: '#A1887F' }, { h: 144, c: '#5FAE8B' },
    { h: 172, c: '#90A4AE' }, { h: 134, c: '#1F3A5F' }, { h: 164, c: '#6AA84F' }
];

export default function Login() {
    const { login } = useAuth();
    const { theme, toggle } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await login(email, password);
            const dest = location.state?.from?.pathname || '/dashboard';
            navigate(dest, { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const fill = (lib) => {
        setEmail(lib.email);
        setPassword(lib.password);
        setError(null);
    };

    return (
        <div className="login">
            <section className="login__art">
                <div className="login__art-inner">
                    <div className="sidebar__brand login__brand">
                        <span className="brand__mark">A</span>
                        <span className="brand__name">Athenaeum</span>
                    </div>
                    <h2 className="login__headline">
                        The library,<br /><em>reimagined</em> for the<br />people who run it.
                    </h2>
                    <p className="login__blurb">
                        Circulation, occupancy, overdue recovery and collection insight —
                        one calm workspace for the whole reading room.
                    </p>
                    <ul className="login__points">
                        <li>Live floor occupancy with check-in / check-out</li>
                        <li>Overdue intelligence &amp; one-tap returns</li>
                        <li>Footfall heatmap and circulation analytics</li>
                    </ul>
                </div>
                <div className="login__shelf" aria-hidden="true">
                    {SPINES.map((s, i) => (
                        <span key={i} className="spine" style={{ height: s.h, background: s.c }} />
                    ))}
                </div>
            </section>

            <section className="login__panel">
                <button className="icon-btn login__theme" onClick={toggle} aria-label="Toggle theme">
                    {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                </button>

                <div className="login__form-wrap">
                    <p className="login__eyebrow">Staff access</p>
                    <h1 className="login__title">Welcome back</h1>
                    <p className="login__sub">Sign in to open the circulation desk.</p>

                    {error && (
                        <div className="login__error">
                            <AlertTriangle size={15} /> {error}
                        </div>
                    )}

                    <form className="login__form" onSubmit={submit}>
                        <div className="field">
                            <label htmlFor="email">Email address</label>
                            <input
                                id="email" type="email" className="input" required
                                placeholder="name@nmamit.in" autoComplete="email"
                                value={email} onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="field">
                            <label htmlFor="password">Password</label>
                            <input
                                id="password" type="password" className="input" required
                                placeholder="••••••••" autoComplete="current-password"
                                value={password} onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <button className="btn btn--primary btn--block btn--lg" disabled={busy}>
                            {busy ? 'Signing in…' : 'Sign in to dashboard'}
                        </button>
                    </form>

                    <div className="login__demo">
                        <p className="login__demo-title"><KeyRound size={13} /> Demo accounts — click to fill</p>
                        <div className="login__demo-list">
                            {DEMO.map(lib => (
                                <button key={lib.email} type="button" className="demo-chip" onClick={() => fill(lib)}>
                                    <strong>{lib.fullname}</strong>
                                    <span>{lib.title}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <p className="login__footnote">MERN stack · MongoDB · Express · React · Node</p>
            </section>
        </div>
    );
}
