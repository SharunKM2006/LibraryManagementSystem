import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DoorOpen, LogIn, LogOut, Search, Trash2, Timer, Users, Activity, X } from 'lucide-react';
import { api, durationBetween, fmtDate, fmtTime, initials, relTime } from '../api';
import { useToast } from '../store.jsx';
import Modal from '../components/Modal.jsx';
import Confirm from '../components/Confirm.jsx';
import { Heatmap } from '../components/charts.jsx';

export default function Visits() {
    const toast = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const [visits, setVisits] = useState([]);
    const [students, setStudents] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [checkIn, setCheckIn] = useState(null); // studentId
    const [confirmId, setConfirmId] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = () => {
        setLoading(true);
        Promise.all([api('/visits'), api('/students'), api('/analytics')])
            .then(([v, s, a]) => { setVisits(v); setStudents(s); setAnalytics(a); })
            .catch(err => toast.error(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (searchParams.get('new') === '1') {
            setCheckIn('');
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const inside = useMemo(() => visits.filter(v => !v.exitAt), [visits]);

    const insideIds = useMemo(() => new Set(inside.map(v => v.student?._id)), [inside]);
    const eligible = students.filter(s => !insideIds.has(s._id));

    const todayStr = new Date().toDateString();
    const visitsToday = visits.filter(v => new Date(v.entryAt).toDateString() === todayStr);

    const avgStay = useMemo(() => {
        const done = visits.filter(v => v.exitAt && Date.now() - new Date(v.entryAt) < 7 * 864e5);
        if (!done.length) return '—';
        const avg = done.reduce((sum, v) => sum + (new Date(v.exitAt) - new Date(v.entryAt)), 0) / done.length;
        const mins = Math.round(avg / 60000);
        return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
    }, [visits]);

    const handleCheckIn = async (e) => {
        e.preventDefault();
        if (!checkIn) return;
        setBusy(true);
        try {
            const created = await api('/visits/checkin', { method: 'POST', body: { studentId: checkIn } });
            setVisits(list => [created, ...list]);
            toast.success(`${created.student.fullname} checked in`);
            setCheckIn(null);
            api('/analytics').then(setAnalytics).catch(() => {});
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    const checkOut = async (visit) => {
        try {
            const updated = await api(`/visits/${visit._id}/checkout`, { method: 'POST' });
            setVisits(list => list.map(v => (v._id === updated._id ? updated : v)));
            toast.success(`${updated.student?.fullname} checked out after ${durationBetween(updated.entryAt, updated.exitAt)}`);
            api('/analytics').then(setAnalytics).catch(() => {});
        } catch (err) {
            toast.error(err.message);
        }
    };

    const remove = async () => {
        setBusy(true);
        try {
            await api(`/visits/${confirmId}`, { method: 'DELETE' });
            setVisits(list => list.filter(v => v._id !== confirmId));
            toast.success('Visit log removed');
            setConfirmId(null);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return visits;
        return visits.filter(v =>
            [v.student?.fullname, v.student?.usn, v.student?.branch]
                .some(x => String(x || '').toLowerCase().includes(q))
        );
    }, [visits, query]);

    const peakLabel = analytics?.peak
        ? `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][(analytics.peak.weekday || 1) - 1]} ${String(analytics.peak.hour).padStart(2, '0')}:00`
        : '—';

    return (
        <div className="stack-lg">
            <div className="kpis kpis--4">
                <div className="kpi kpi--live">
                    <span className="kpi__icon"><Users size={17} /></span>
                    <span className="kpi__label">Inside now</span>
                    <strong className="kpi__value">{inside.length}</strong>
                    <span className="kpi__hint"><span className="pulse-dot" />live occupancy</span>
                </div>
                <div className="kpi">
                    <span className="kpi__icon"><DoorOpen size={17} /></span>
                    <span className="kpi__label">Checked in today</span>
                    <strong className="kpi__value">{visitsToday.length}</strong>
                    <span className="kpi__hint">{visitsToday.filter(v => v.exitAt).length} already left</span>
                </div>
                <div className="kpi">
                    <span className="kpi__icon"><Timer size={17} /></span>
                    <span className="kpi__label">Average stay</span>
                    <strong className="kpi__value">{avgStay}</strong>
                    <span className="kpi__hint">over the last 7 days</span>
                </div>
                <div className="kpi">
                    <span className="kpi__icon"><Activity size={17} /></span>
                    <span className="kpi__label">Busiest slot</span>
                    <strong className="kpi__value">{peakLabel}</strong>
                    <span className="kpi__hint">{analytics?.peak ? `${analytics.peak.count} visits in 8 weeks` : 'collecting…'}</span>
                </div>
            </div>

            <div className="grid-2">
                <section className="card">
                    <div className="card__head">
                        <div>
                            <h3 className="card__title">On the floor right now</h3>
                            <p className="card__sub">Check members in and out from the front desk</p>
                        </div>
                        <button className="btn btn--primary btn--sm" onClick={() => setCheckIn('')}>
                            <LogIn size={15} /> Check in
                        </button>
                    </div>
                    <div className="card__body card__body--flush">
                        {inside.length === 0 ? (
                            <div className="empty empty--sm">
                                <DoorOpen size={20} />
                                <p>Nobody is inside. The room is all quiet.</p>
                            </div>
                        ) : (
                            <ul className="live-list">
                                {inside.map(v => (
                                    <li className="live-row" key={v._id}>
                                        <span className="avatar avatar--xs">{initials(v.student?.fullname)}</span>
                                        <span className="queue__main">
                                            <strong>{v.student?.fullname}</strong>
                                            <small>{v.student?.usn} · {v.student?.branch} · in {relTime(v.entryAt)}</small>
                                        </span>
                                        <span className="live-row__meta">
                                            <small className="mono">{durationBetween(v.entryAt)}</small>
                                            <button className="btn btn--soft btn--sm" onClick={() => checkOut(v)}>
                                                <LogOut size={14} /> Check out
                                            </button>
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
                            <h3 className="card__title">Footfall heatmap</h3>
                            <p className="card__sub">Visits by weekday × hour across the last 8 weeks</p>
                        </div>
                    </div>
                    <div className="card__body">
                        {analytics
                            ? <Heatmap rows={analytics.heatmap} peak={analytics.peak} />
                            : <div className="chart-empty">Crunching visit history…</div>}
                    </div>
                </section>
            </div>

            <section className="card">
                <div className="card__head">
                    <div>
                        <h3 className="card__title">Visit log</h3>
                        <p className="card__sub">{visible.length} entries in view</p>
                    </div>
                    <div className="searchbox searchbox--sm">
                        <Search size={14} />
                        <input
                            className="searchbox__input"
                            placeholder="Search member or USN…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            aria-label="Search visits"
                        />
                        {query && (
                            <button className="searchbox__clear" onClick={() => setQuery('')} aria-label="Clear">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="card__body card__body--flush">
                    {loading ? (
                        <div className="empty empty--sm"><p>Loading visit history…</p></div>
                    ) : visible.length === 0 ? (
                        <div className="empty empty--sm">
                            <DoorOpen size={20} />
                            <p>No visit records match.</p>
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Member</th>
                                        <th>Date</th>
                                        <th>Entry</th>
                                        <th>Exit</th>
                                        <th>Duration</th>
                                        <th>Status</th>
                                        <th className="col-actions">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.slice(0, 120).map(v => (
                                        <tr key={v._id}>
                                            <td>
                                                <span className="cell-member">
                                                    <span className="avatar avatar--xs">{initials(v.student?.fullname)}</span>
                                                    <span className="cell-member__meta">
                                                        <strong>{v.student?.fullname}</strong>
                                                        <small className="mono">{v.student?.usn}</small>
                                                    </span>
                                                </span>
                                            </td>
                                            <td>{fmtDate(v.entryAt)}</td>
                                            <td className="mono">{fmtTime(v.entryAt)}</td>
                                            <td className="mono">{v.exitAt ? fmtTime(v.exitAt) : '—'}</td>
                                            <td className="mono">{durationBetween(v.entryAt, v.exitAt)}</td>
                                            <td>
                                                {v.exitAt
                                                    ? <span className="badge badge--returned">Completed</span>
                                                    : <span className="badge badge--live"><span className="pulse-dot" /> inside</span>}
                                            </td>
                                            <td className="col-actions">
                                                {!v.exitAt && (
                                                    <button className="icon-btn icon-btn--sm icon-btn--success" title="Check out" onClick={() => checkOut(v)}>
                                                        <LogOut size={14} />
                                                    </button>
                                                )}
                                                <button className="icon-btn icon-btn--sm icon-btn--danger" title="Delete record" onClick={() => setConfirmId(v._id)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </section>

            <Modal
                open={checkIn !== null}
                title="Check a member in"
                subtitle="They appear on the floor card immediately"
                onClose={() => setCheckIn(null)}
                footer={
                    <>
                        <button className="btn btn--ghost" onClick={() => setCheckIn(null)} disabled={busy}>Cancel</button>
                        <button className="btn btn--primary" form="checkin-form" disabled={busy || !checkIn}>
                            {busy ? 'Checking in…' : 'Check in'}
                        </button>
                    </>
                }
            >
                <form id="checkin-form" className="form-grid" onSubmit={handleCheckIn}>
                    <div className="field field--2">
                        <label>Member</label>
                        <select className="select select--input" required value={checkIn || ''}
                            onChange={e => setCheckIn(e.target.value)}>
                            <option value="">Choose a member…</option>
                            {eligible.map(s => (
                                <option key={s._id} value={s._id}>{s.fullname} · {s.usn}</option>
                            ))}
                        </select>
                    </div>
                    <div className="field field--2 hint-row">
                        <span className="hint">
                            {eligible.length === 0
                                ? 'Every registered member is already inside the library.'
                                : `${inside.length} inside right now · members already checked in are hidden from this list.`}
                        </span>
                    </div>
                </form>
            </Modal>

            <Confirm
                open={!!confirmId}
                title="Delete this visit record?"
                message="The entry will be removed from the visit history and footfall analytics."
                confirmLabel="Delete record"
                busy={busy}
                onConfirm={remove}
                onClose={() => setConfirmId(null)}
            />
        </div>
    );
}
