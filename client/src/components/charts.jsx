// Hand-rolled SVG charts: trend lines, donuts, horizontal bars and a
// weekday × hour footfall heatmap. No charting dependency needed.

export function TrendChart({ data, height = 190 }) {
    if (!data || !data.length) return <div className="chart-empty">No circulation data yet</div>;

    const w = 720;
    const h = height;
    const padX = 8;
    const padTop = 14;
    const padBottom = 24;
    const max = Math.max(4, ...data.map(d => Math.max(d.borrowed, d.returned)));
    const x = (i) => padX + (i * (w - padX * 2)) / Math.max(1, data.length - 1);
    const y = (v) => padTop + (1 - v / max) * (h - padTop - padBottom);

    const path = (key) => data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
    const area = (key) =>
        `${path(key)} L${x(data.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

    return (
        <div className="chart">
            <svg viewBox={`0 0 ${w} ${h}`} className="chart__svg" preserveAspectRatio="none" role="img"
                aria-label="Loans issued and returned over the last 14 days">
                <defs>
                    <linearGradient id="trendBorrowFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--brass)" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="var(--brass)" stopOpacity="0.02" />
                    </linearGradient>
                </defs>
                {[0, 0.25, 0.5, 0.75, 1].map(f => (
                    <line key={f} x1={padX} x2={w - padX} y1={padTop + f * (h - padTop - padBottom)}
                        y2={padTop + f * (h - padTop - padBottom)} className="chart__grid" />
                ))}
                <path d={area('borrowed')} fill="url(#trendBorrowFill)" />
                <path d={path('borrowed')} className="chart__line chart__line--primary" />
                <path d={path('returned')} className="chart__line chart__line--alt" />
                {data.map((d, i) => (
                    <circle key={i} cx={x(i)} cy={y(d.borrowed)} r="3" className="chart__dot">
                        <title>{d.date}: {d.borrowed} issued, {d.returned} returned</title>
                    </circle>
                ))}
            </svg>
            <div className="chart__xaxis">
                {data.map((d, i) => (
                    <span key={d.date}>{i % 3 === 0 || i === data.length - 1 ? d.date.slice(5) : ''}</span>
                ))}
            </div>
            <div className="chart__legend">
                <span className="legend-item legend-item--primary">Issued</span>
                <span className="legend-item legend-item--alt">Returned</span>
            </div>
        </div>
    );
}

export function Donut({ segments, size = 168 }) {
    const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
    const r = 60;
    const c = 2 * Math.PI * r;
    let offset = 0;

    return (
        <div className="donut">
            <svg width={size} height={size} viewBox="0 0 160 160" role="img" aria-label="Distribution chart">
                <circle cx="80" cy="80" r={r} className="donut__track" />
                {segments.map((seg, i) => {
                    const frac = seg.value / total;
                    const dash = `${(frac * c - 2).toFixed(2)} ${c.toFixed(2)}`;
                    const el = (
                        <circle
                            key={seg.label}
                            cx="80" cy="80" r={r}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth="16"
                            strokeDasharray={dash}
                            strokeDashoffset={-offset * c}
                            transform="rotate(-90 80 80)"
                            className="donut__seg"
                        >
                            <title>{seg.label}: {seg.value} ({Math.round(frac * 100)}%)</title>
                        </circle>
                    );
                    offset += frac;
                    return el;
                })}
                <text x="80" y="76" textAnchor="middle" className="donut__total">{total}</text>
                <text x="80" y="96" textAnchor="middle" className="donut__caption">{size > 150 ? 'members' : ''}</text>
            </svg>
            <ul className="donut__legend">
                {segments.map(seg => (
                    <li key={seg.label}>
                        <span className="swatch" style={{ background: seg.color }} />
                        <span className="donut__label">{seg.label}</span>
                        <span className="donut__value">{seg.value}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function HBars({ items, unit = 'loans' }) {
    const max = Math.max(1, ...items.map(i => i.value));
    return (
        <ul className="hbars">
            {items.map(item => (
                <li key={item.label} className="hbar">
                    <span className="hbar__label" title={item.label}>{item.label}</span>
                    <span className="hbar__track">
                        <span className="hbar__fill" style={{ width: `${(item.value / max) * 100}%` }} />
                    </span>
                    <span className="hbar__value">{item.value} {unit}</span>
                </li>
            ))}
        </ul>
    );
}

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Heatmap({ rows = [], peak }) {
    const map = new Map();
    let max = 1;
    for (const r of rows) {
        // Mongo $dayOfWeek: 1 = Sunday … 7 = Saturday → convert to 0-based
        map.set(`${r._id.weekday - 1}-${r._id.hour}`, r.count);
        if (r.count > max) max = r.count;
    }

    return (
        <div className="heat">
            <div className="heat__grid" style={{ gridTemplateColumns: `46px repeat(${HOURS.length}, 1fr)` }}>
                <span />
                {HOURS.map(h => <span key={h} className="heat__hlabel">{h}</span>)}
                {DAYS.map((day, d) => (
                    <div key={day} className="heat__row">
                        <span className="heat__dlabel">{day}</span>
                        {HOURS.map(h => {
                            const v = map.get(`${d}-${h}`) || 0;
                            const isPeak = peak && peak.weekday - 1 === d && peak.hour === h;
                            return (
                                <span
                                    key={h}
                                    className={`heat__cell ${v === 0 ? 'is-zero' : ''} ${isPeak ? 'is-peak' : ''}`}
                                    style={{ opacity: v === 0 ? 1 : 0.25 + 0.75 * (v / max) }}
                                    title={`${day} ${h}:00 — ${v} visit${v === 1 ? '' : 's'}`}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>
            <div className="heat__scale">
                <span>Quiet</span>
                <span className="heat__scale-cells">
                    {[0.2, 0.4, 0.6, 0.8, 1].map(o => (
                        <span key={o} className="heat__cell" style={{ opacity: o }} />
                    ))}
                </span>
                <span>Busy</span>
            </div>
        </div>
    );
}
