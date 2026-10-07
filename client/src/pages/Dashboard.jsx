import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    BookMarked, Layers, ArrowLeftRight, DoorOpen, AlertTriangle, CalendarCheck,
    ArrowRight, Sparkles, UserCheck
} from 'lucide-react';
import { api, fmtDate, fmtTime, fmtDateTime, loanState, relTime, durationBetween } from '../api';
import { useAuth, useToast } from '../store.jsx';
import { TrendChart } from '../components/charts.jsx';

function Kpi({ icon: Icon, label, value, hint, tone, pulse }) {
    return (
        <div className={`kpi ${tone ? `kpi--${tone}` : ''}`}>
            <span className="kpi__icon"><Icon size={17} /></span>
            <span className="kpi__label">{label}</span>
            <strong className="kpi__value">{value}</strong>
            <span className="kpi__hint">
                {pulse && <span className="pulse-dot" />}
                {hint}
            </span>
        </div>
    );
}

export default function Dashboard() {
    const { user } = useAuth();
    const toast = useToast();
    const [stats, setStats] = useState(null);
    const [analytics, setAnalytics] = useState(null);

    const load = () => Promise.all([api('/stats'), api('/analytics')])
        .then(([s, a]) => { setStats(s); setAnalytics(a); })
        .catch(err => toast.error(err.message));

    useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

    const returnLoan = async (borrow) => {
        try {
            await api(`/borrows/${borrow._id}/return`, { method: 'POST' });
            toast.success(`“${borrow.book?.title}” marked as returned`);
            load();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    if (!stats || !analytics) {
        return (
            <div className="kpis">
                {Array.from({ length: 6 }).map((_, i) => <div className="kpi skeleton" key={i} />)}
            </div>
        );
    }

    return (
        <div className="stack-lg">
            <div className="greeting">
                <div>
                    <h2 className="greeting__text">{greeting}, {user?.fullname?.split(' ')[0]}.</h2>
                    <p className="greeting__date">
                        {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        {' · '}peak traffic usually hits {analytics.peak ? `${String(analytics.peak.hour).padStart(2, '0')}:00 on ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][(analytics.peak.weekday || 1) - 1]}` : '—'}
                    </p>
                </div>
                <Link to="/analytics" className="btn btn--soft">
                    Open analytics <ArrowRight size={15} />
                </Link>
            </div>

            <div className="kpis">
                <Kpi icon={BookMarked} label="Titles catalogued" value={stats.titles} hint="distinct works" />
                <Kpi icon={Layers} label="Copies on shelf" value={stats.copies} hint={`${stats.returnedLast30} returned in 30 days`} />
                <Kpi icon={ArrowLeftRight} label="Active loans" value={stats.activeLoans} hint={`${stats.dueSoon} due within 3 days`} />
                <Kpi icon={DoorOpen} label="Inside right now" value={stats.occupancy} hint="live occupancy" pulse tone="live" />
                <Kpi icon={AlertTriangle} label="Overdue" value={stats.overdue} hint="needs chasing" tone={stats.overdue > 0 ? 'danger' : undefined} />
                <Kpi icon={CalendarCheck} label="Visits today" value={stats.visitsToday} hint={`${stats.students} registered members`} />
            </div>

            <div className="grid-2">
                <section className="card">
                    <div className="card__head">
                        <div>
                            <h3 className="card__title">Circulation — last 14 days</h3>
                            <p className="card__sub">Loans issued against copies returned</p>
                        </div>
                        <Link to="/loans" className="link-more">All loans <ArrowRight size={14} /></Link>
                    </div>
                    <div className="card__body">
                        <TrendChart data={analytics.trend} />
                    </div>
                </section>

                <section className="card card--danger">
                    <div className="card__head">
                        <div>
                            <h3 className="card__title">Overdue queue</h3>
                            <p className="card__sub">
                                {stats.overdue > 0
                                    ? `${stats.overdue} loan${stats.overdue === 1 ? '' : 's'} past the return date`
                                    : 'Every loan is inside its window — nice work'}
                            </p>
                        </div>
                    </div>
                    <div className="card__body card__body--flush">
                        {stats.overdueRows.length === 0 ? (
                            <div className="empty empty--sm">
                                <Sparkles size={20} />
                                <p>Nothing overdue today.</p>
                            </div>
                        ) : (
                            <ul className="queue">
                                {stats.overdueRows.map(b => {
                                    const state = loanState(b);
                                    return (
                                        <li className="queue__row" key={b._id}>
                                            <span className="queue__main">
                                                <strong>{b.book?.title}</strong>
                                                <small>
                                                    {b.student?.fullname} · {b.student?.usn} · due {fmtDate(b.dueDate)}
                                                </small>
                                            </span>
                                            <span className={`badge badge--${state.key}`}>{state.label}</span>
                                            <button className="btn btn--soft btn--sm" onClick={() => returnLoan(b)}>
                                                <UserCheck size={14} /> Received
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </section>
            </div>

            <div className="grid-2 grid-2--wide-left">
                <section className="card">
                    <div className="card__head">
                        <div>
                            <h3 className="card__title">Reading floor</h3>
                            <p className="card__sub">Members currently inside the library</p>
                        </div>
                        <Link to="/visits" className="link-more">Front desk <ArrowRight size={14} /></Link>
                    </div>
                    <div className="card__body card__body--flush">
                        {analytics.live.length === 0 ? (
                            <div className="empty empty--sm">
                                <DoorOpen size={20} />
                                <p>The floor is empty right now.</p>
                                <Link to="/visits?new=1" className="btn btn--soft btn--sm">Check someone in</Link>
                            </div>
                        ) : (
                            <ul className="live-list">
                                {analytics.live.map(v => (
                                    <li className="live-row" key={v._id}>
                                        <span className="avatar avatar--xs">{String(v.student?.fullname || '?').slice(0, 1)}</span>
                                        <span className="queue__main">
                                            <strong>{v.student?.fullname}</strong>
                                            <small>{v.student?.usn} · {v.student?.branch}</small>
                                        </span>
                                        <span className="live-row__meta">
                                            <span className="badge badge--live"><span className="pulse-dot" /> inside</span>
                                            <small>in at {fmtTime(v.entryAt)} · {durationBetween(v.entryAt)}</small>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>

                <section className="card">
                    <div className="card__head">
                        <div>
                            <h3 className="card__title">Due soon</h3>
                            <p className="card__sub">Loans closing in over the next three days</p>
                        </div>
                    </div>
                    <div className="card__body card__body--flush">
                        <div className="mini-stats">
                            <div className="mini-stat">
                                <strong>{stats.dueSoon}</strong>
                                <span>due in 3 days</span>
                            </div>
                            <div className="mini-stat">
                                <strong>{stats.returnedLast30}</strong>
                                <span>returned this month</span>
                            </div>
                            <div className="mini-stat">
                                <strong>{stats.visitsToday}</strong>
                                <span>visits logged today</span>
                            </div>
                            <div className="mini-stat">
                                <strong>{stats.students}</strong>
                                <span>members on file</span>
                            </div>
                        </div>
                        <div className="mini-note">
                            <Sparkles size={14} />
                            <span>
                                Last visit log {analytics.live.length > 0
                                    ? `from ${relTime(analytics.live[0].entryAt)}`
                                    : '—'} · collection is{' '}
                                {stats.copies > 0
                                    ? `${Math.round(((stats.copies - stats.activeLoans) / stats.copies) * 100)}% available`
                                    : 'empty'}.
                            </span>
                        </div>
                        <div className="mini-footnote">Updated {fmtDateTime(new Date())}</div>
                    </div>
                </section>
            </div>
        </div>
    );
}
