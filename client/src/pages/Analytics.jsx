import { useEffect, useState } from 'react';
import { BarChart3, Sparkles, Layers, ArrowLeftRight } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../store.jsx';
import { TrendChart, Donut, HBars, Heatmap } from '../components/charts.jsx';

const BRANCH_COLORS = ['#B7791F', '#2C7A7B', '#6B46C1', '#C05621', '#2B6CB0', '#718096'];
const GENRE_COLORS = ['#B7791F', '#2C7A7B', '#6B46C1', '#C05621', '#2B6CB0', '#2F855A', '#97266A', '#4A5568'];

export default function Analytics() {
    const toast = useToast();
    const [data, setData] = useState(null);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        Promise.all([api('/analytics'), api('/stats')])
            .then(([a, s]) => { setData(a); setStats(s); })
            .catch(err => toast.error(err.message));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (!data || !stats) {
        return (
            <div className="grid-2">
                <div className="card skeleton" style={{ height: 320 }} />
                <div className="card skeleton" style={{ height: 320 }} />
            </div>
        );
    }

    const branchSegments = data.branches.map((b, i) => ({
        label: b._id, value: b.students, color: BRANCH_COLORS[i % BRANCH_COLORS.length]
    }));

    const genreItems = data.genres.map((g, i) => ({
        label: g._id, value: g.copies, color: GENRE_COLORS[i % GENRE_COLORS.length]
    }));

    const totalCopies = stats.copies || 1;
    const available = Math.max(0, stats.copies - stats.activeLoans);
    const loans7 = data.trend.reduce((s, d) => s + d.borrowed, 0);
    const returns7 = data.trend.slice(-7).reduce((s, d) => s + d.borrowed, 0);

    const peakLabel = data.peak
        ? `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][(data.peak.weekday || 1) - 1]} at ${String(data.peak.hour).padStart(2, '0')}:00`
        : '—';

    return (
        <div className="stack-lg">
            <div className="kpis kpis--4">
                <div className="kpi">
                    <span className="kpi__icon"><ArrowLeftRight size={17} /></span>
                    <span className="kpi__label">Loans this fortnight</span>
                    <strong className="kpi__value">{loans7}</strong>
                    <span className="kpi__hint">issued in 14 days</span>
                </div>
                <div className="kpi">
                    <span className="kpi__icon"><Layers size={17} /></span>
                    <span className="kpi__label">Shelf availability</span>
                    <strong className="kpi__value">{Math.round((available / totalCopies) * 100)}%</strong>
                    <span className="kpi__hint">{available} of {stats.copies} copies free</span>
                </div>
                <div className="kpi">
                    <span className="kpi__icon"><BarChart3 size={17} /></span>
                    <span className="kpi__label">Issued this week</span>
                    <strong className="kpi__value">{returns7}</strong>
                    <span className="kpi__hint">{stats.returnedLast30} returned in 30 days</span>
                </div>
                <div className="kpi kpi--live">
                    <span className="kpi__icon"><Sparkles size={17} /></span>
                    <span className="kpi__label">Peak footfall</span>
                    <strong className="kpi__value">{data.peak ? `${data.peak.count}×` : '—'}</strong>
                    <span className="kpi__hint"><span className="pulse-dot" />busiest on {peakLabel}</span>
                </div>
            </div>

            <section className="card">
                <div className="card__head">
                    <div>
                        <h3 className="card__title">Circulation rhythm</h3>
                        <p className="card__sub">Every loan issued and returned over the past 14 days</p>
                    </div>
                </div>
                <div className="card__body">
                    <TrendChart data={data.trend} height={230} />
                </div>
            </section>

            <div className="grid-2">
                <section className="card">
                    <div className="card__head">
                        <div>
                            <h3 className="card__title">Most borrowed titles</h3>
                            <p className="card__sub">Where the demand actually sits</p>
                        </div>
                    </div>
                    <div className="card__body">
                        {data.topBooks.length
                            ? <HBars items={data.topBooks.map(t => ({ label: t.title, value: t.loans }))} />
                            : <div className="chart-empty">No loans recorded yet</div>}
                    </div>
                </section>

                <section className="card">
                    <div className="card__head">
                        <div>
                            <h3 className="card__title">Membership by branch</h3>
                            <p className="card__sub">Who the library serves</p>
                        </div>
                    </div>
                    <div className="card__body card__body--center">
                        <Donut segments={branchSegments} />
                    </div>
                </section>
            </div>

            <div className="grid-2">
                <section className="card">
                    <div className="card__head">
                        <div>
                            <h3 className="card__title">Collection by genre</h3>
                            <p className="card__sub">Copies on shelf, grouped by shelf-talker</p>
                        </div>
                    </div>
                    <div className="card__body">
                        <HBars items={genreItems} unit="copies" />
                    </div>
                </section>

                <section className="card">
                    <div className="card__head">
                        <div>
                            <h3 className="card__title">When the room fills up</h3>
                            <p className="card__sub">Footfall density by weekday and hour</p>
                        </div>
                    </div>
                    <div className="card__body">
                        <Heatmap rows={data.heatmap} peak={data.peak} />
                    </div>
                </section>
            </div>
        </div>
    );
}
