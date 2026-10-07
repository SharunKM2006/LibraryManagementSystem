import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Download, Undo2, Trash2, ArrowLeftRight, X, BookOpen } from 'lucide-react';
import { api, exportCsv, fmtDate, loanState } from '../api';
import { useToast } from '../store.jsx';
import Modal from '../components/Modal.jsx';
import Confirm from '../components/Confirm.jsx';

const TABS = [
    { key: 'all', label: 'All loans' },
    { key: 'active', label: 'Active' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'returned', label: 'Returned' }
];

const LOAN_OPTIONS = [7, 14, 21, 30];

export default function Loans() {
    const toast = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const [borrows, setBorrows] = useState([]);
    const [books, setBooks] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [tab, setTab] = useState('all');
    const [form, setForm] = useState(null); // issue-loan form state
    const [confirmId, setConfirmId] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = () => {
        setLoading(true);
        Promise.all([api('/borrows'), api('/books'), api('/students')])
            .then(([b, bk, st]) => { setBorrows(b); setBooks(bk); setStudents(st); })
            .catch(err => toast.error(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (searchParams.get('new') === '1') {
            setForm(newIssueForm());
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    function newIssueForm() {
        return { studentId: '', bookId: '', loanDays: 14, borrowDate: new Date().toISOString().slice(0, 10) };
    }

    const counts = useMemo(() => {
        const c = { all: borrows.length, active: 0, overdue: 0, returned: 0 };
        for (const b of borrows) {
            if (b.status === 'Returned') c.returned++;
            else {
                c.active++;
                if (new Date(b.dueDate).getTime() < Date.now()) c.overdue++;
            }
        }
        return c;
    }, [borrows]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return borrows.filter(b => {
            const state = loanState(b);
            const matchesTab =
                tab === 'all' ||
                (tab === 'returned' && state.key === 'returned') ||
                (tab === 'active' && state.key !== 'returned') ||
                (tab === 'overdue' && state.key === 'overdue');
            const matchesQ = !q || [
                b.student?.fullname, b.student?.usn, b.book?.title, b.book?.author
            ].some(v => String(v || '').toLowerCase().includes(q));
            return matchesTab && matchesQ;
        });
    }, [borrows, query, tab]);

    const issue = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const created = await api('/borrows', {
                method: 'POST',
                body: {
                    studentId: form.studentId,
                    bookId: form.bookId,
                    borrowDate: form.borrowDate,
                    loanDays: form.loanDays
                }
            });
            setBorrows(list => [created, ...list]);
            setBooks(list => list.map(b => (b._id === created.book._id ? created.book : b)));
            toast.success(`Issued “${created.book.title}” to ${created.student.fullname}`);
            setForm(null);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    const receive = async (borrow) => {
        try {
            const updated = await api(`/borrows/${borrow._id}/return`, { method: 'POST' });
            setBorrows(list => list.map(b => (b._id === updated._id ? updated : b)));
            setBooks(list => list.map(b => (b._id === updated.book._id ? updated.book : b)));
            toast.success(`“${updated.book.title}” back on the shelf`);
        } catch (err) {
            toast.error(err.message);
        }
    };

    const remove = async () => {
        setBusy(true);
        try {
            const target = borrows.find(b => b._id === confirmId);
            await api(`/borrows/${confirmId}`, { method: 'DELETE' });
            setBorrows(list => list.filter(b => b._id !== confirmId));
            // Deleting an active loan returns the copy to stock server-side;
            // keep the local book list in sync so the Issue-loan dropdown
            // shows the correct availability straight away.
            if (target?.status === 'Active' && target.book?._id) {
                setBooks(list => list.map(b => (
                    b._id === target.book._id ? { ...b, quantity: b.quantity + 1 } : b
                )));
            }
            toast.success('Loan record removed');
            setConfirmId(null);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    const download = () => exportCsv('loans.csv', visible, [
        { header: 'Member', value: b => b.student?.fullname || '' },
        { header: 'USN', value: b => b.student?.usn || '' },
        { header: 'Title', value: b => b.book?.title || '' },
        { header: 'Issued', value: b => fmtDate(b.borrowDate) },
        { header: 'Due', value: b => fmtDate(b.dueDate) },
        { header: 'Status', value: b => loanState(b).label }
    ]);

    const availableBooks = books.filter(b => b.quantity > 0);
    const confirmBorrow = borrows.find(b => b._id === confirmId);

    return (
        <div className="stack-lg">
            <div className="toolbar">
                <div className="toolbar__left">
                    <div className="tabs">
                        {TABS.map(t => (
                            <button
                                key={t.key}
                                className={`tab ${tab === t.key ? 'tab--on' : ''}`}
                                onClick={() => setTab(t.key)}
                            >
                                {t.label}
                                <span className="tab__count">{counts[t.key]}</span>
                            </button>
                        ))}
                    </div>
                    <div className="searchbox">
                        <Search size={15} />
                        <input
                            className="searchbox__input"
                            placeholder="Search member, USN or title…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            aria-label="Search loans"
                        />
                        {query && (
                            <button className="searchbox__clear" onClick={() => setQuery('')} aria-label="Clear search">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="toolbar__right">
                    <button className="btn btn--ghost" onClick={download}><Download size={15} /> CSV</button>
                    <button className="btn btn--primary" onClick={() => setForm(newIssueForm())}>
                        <Plus size={16} /> Issue loan
                    </button>
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <div className="table-wrap">
                        <table>
                            <tbody>
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i}><td colSpan="6"><span className="skeleton skeleton--line" /></td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : visible.length === 0 ? (
                    <div className="empty">
                        <ArrowLeftRight size={26} />
                        <p>{tab === 'overdue' ? 'No overdue loans — the desk is clear.' : 'No loans match this view.'}</p>
                        <button className="btn btn--soft" onClick={() => setForm(newIssueForm())}>Issue a loan</button>
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Member</th>
                                    <th>Title</th>
                                    <th>Issued</th>
                                    <th>Due</th>
                                    <th>Status</th>
                                    <th className="col-actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map(b => {
                                    const state = loanState(b);
                                    return (
                                        <tr key={b._id} className={state.key === 'overdue' ? 'row--danger' : ''}>
                                            <td>
                                                <span className="cell-member">
                                                    <span className="cell-member__meta">
                                                        <strong>{b.student?.fullname || 'Unknown'}</strong>
                                                        <small className="mono">{b.student?.usn}</small>
                                                    </span>
                                                </span>
                                            </td>
                                            <td>
                                                <span className="cell-title">
                                                    <BookOpen size={14} className="cell-title__icon" />
                                                    <span>
                                                        <strong>{b.book?.title || 'Removed title'}</strong>
                                                        <small className="muted"> {b.book?.author}</small>
                                                    </span>
                                                </span>
                                            </td>
                                            <td>{fmtDate(b.borrowDate)}</td>
                                            <td>{fmtDate(b.dueDate)}</td>
                                            <td>
                                                <span className={`badge badge--${state.key}`} title={state.title}>
                                                    {state.key === 'overdue' && <span className="badge__dot" />}
                                                    {state.label}
                                                </span>
                                            </td>
                                            <td className="col-actions">
                                                {b.status === 'Active' && (
                                                    <button className="icon-btn icon-btn--sm icon-btn--success" onClick={() => receive(b)} title="Mark as returned">
                                                        <Undo2 size={14} />
                                                    </button>
                                                )}
                                                <button className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => setConfirmId(b._id)} title="Delete record">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <p className="result-count">{visible.length} of {borrows.length} loans</p>

            <Modal
                open={!!form}
                title="Issue a loan"
                subtitle="Copies come off the shelf automatically"
                onClose={() => setForm(null)}
                footer={
                    <>
                        <button className="btn btn--ghost" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
                        <button className="btn btn--primary" form="loan-form" disabled={busy || !form?.studentId || !form?.bookId}>
                            {busy ? 'Issuing…' : 'Issue loan'}
                        </button>
                    </>
                }
            >
                {form && (
                    <form id="loan-form" className="form-grid" onSubmit={issue}>
                        <div className="field field--2">
                            <label>Member</label>
                            <select className="select select--input" required value={form.studentId}
                                onChange={e => setForm({ ...form, studentId: e.target.value })}>
                                <option value="">Choose a member…</option>
                                {students.map(s => (
                                    <option key={s._id} value={s._id}>{s.fullname} · {s.usn}</option>
                                ))}
                            </select>
                        </div>
                        <div className="field field--2">
                            <label>Title <span className="optional">{availableBooks.length} available</span></label>
                            <select className="select select--input" required value={form.bookId}
                                onChange={e => setForm({ ...form, bookId: e.target.value })}>
                                <option value="">Choose a book…</option>
                                {availableBooks.map(b => (
                                    <option key={b._id} value={b._id}>{b.title} — {b.author} ({b.quantity} left)</option>
                                ))}
                            </select>
                        </div>
                        <div className="field">
                            <label>Issued on</label>
                            <input className="input" type="date" required value={form.borrowDate}
                                onChange={e => setForm({ ...form, borrowDate: e.target.value })} />
                        </div>
                        <div className="field">
                            <label>Loan period</label>
                            <select className="select select--input" value={form.loanDays}
                                onChange={e => setForm({ ...form, loanDays: Number(e.target.value) })}>
                                {LOAN_OPTIONS.map(d => <option key={d} value={d}>{d} days</option>)}
                            </select>
                        </div>
                        <div className="field field--2 hint-row">
                            <span className="hint">
                                Due back {fmtDate(new Date(Date.now() + form.loanDays * 864e5))}
                                — the member shows up in the overdue queue if it slips past.
                            </span>
                        </div>
                    </form>
                )}
            </Modal>

            <Confirm
                open={!!confirmId}
                title="Delete this loan record?"
                message={confirmBorrow
                    ? `The record for “${confirmBorrow.book?.title}” will be removed${confirmBorrow.status === 'Active' ? ' and the copy returned to stock' : ''}.`
                    : ''}
                confirmLabel="Delete record"
                busy={busy}
                onConfirm={remove}
                onClose={() => setConfirmId(null)}
            />
        </div>
    );
}
