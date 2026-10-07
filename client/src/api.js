// Thin fetch wrapper for the Express REST API + shared formatting helpers.
export async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(`/api${path}`, {
        method,
        credentials: 'same-origin',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON response */ }
    if (!res.ok) {
        const err = new Error((data && data.error) || `Request failed (${res.status})`);
        err.status = res.status;
        throw err;
    }
    return data;
}

// ------------------------------- formatting -------------------------------
export function fmtDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d)) return '—';
    return `${fmtDate(value)} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

export function fmtTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d)) return '—';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function relTime(value) {
    const diff = Date.now() - new Date(value).getTime();
    if (isNaN(diff)) return '';
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
}

export function durationBetween(a, b) {
    const ms = new Date(b || Date.now()) - new Date(a);
    if (isNaN(ms) || ms < 0) return '—';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    return `${h}h ${mins % 60}m`;
}

const DAY = 864e5;

// Loan state machine: returned / overdue / due soon / active.
export function loanState(borrow) {
    if (borrow.status === 'Returned') {
        return { key: 'returned', label: 'Returned', title: `Returned ${fmtDate(borrow.returnedAt)}` };
    }
    const due = new Date(borrow.dueDate).getTime();
    const days = Math.ceil((due - Date.now()) / DAY);
    if (days < 0) return { key: 'overdue', label: `Overdue ${Math.abs(days)}d`, days, title: `Was due ${fmtDate(borrow.dueDate)}` };
    if (days <= 3) return { key: 'soon', label: days === 0 ? 'Due today' : `Due in ${days}d`, days, title: `Due ${fmtDate(borrow.dueDate)}` };
    return { key: 'active', label: `${days}d left`, days, title: `Due ${fmtDate(borrow.dueDate)}` };
}

export function initials(name = '') {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function hashStr(str = '') {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return Math.abs(h);
}

// ------------------------------ CSV exporter ------------------------------
export function exportCsv(filename, rows, columns) {
    const esc = (v) => {
        const s = v === null || v === undefined ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [columns.map(c => esc(c.header)).join(',')];
    for (const row of rows) lines.push(columns.map(c => esc(c.value(row))).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
