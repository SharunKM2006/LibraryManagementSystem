import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Download, Pencil, Trash2, GraduationCap, X } from 'lucide-react';
import { api, exportCsv, initials } from '../api';
import { useToast } from '../store.jsx';
import Modal from '../components/Modal.jsx';
import Confirm from '../components/Confirm.jsx';

const BRANCHES = ['CSE', 'ISE', 'ECE', 'MECH', 'CIVIL'];
const EMPTY = { usn: '', fullname: '', branch: 'CSE', semester: 5 };

export default function Students() {
    const toast = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const [students, setStudents] = useState([]);
    const [loanCounts, setLoanCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [branch, setBranch] = useState('All');
    const [form, setForm] = useState(null);
    const [confirmId, setConfirmId] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = () => {
        setLoading(true);
        Promise.all([api('/students'), api('/borrows')])
            .then(([list, borrows]) => {
                setStudents(list);
                const counts = {};
                for (const b of borrows) {
                    if (b.status === 'Active' && b.student) counts[b.student._id] = (counts[b.student._id] || 0) + 1;
                }
                setLoanCounts(counts);
            })
            .catch(err => toast.error(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (searchParams.get('new') === '1') {
            setForm({ ...EMPTY });
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return students.filter(s => {
            const matchesQ = !q || [s.usn, s.fullname, s.branch].some(v => String(v || '').toLowerCase().includes(q));
            return matchesQ && (branch === 'All' || s.branch === branch);
        });
    }, [students, query, branch]);

    const save = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            if (form._id) {
                const updated = await api(`/students/${form._id}`, { method: 'PUT', body: form });
                setStudents(list => list.map(s => (s._id === updated._id ? updated : s)));
                toast.success(`${updated.fullname} updated`);
            } else {
                const created = await api('/students', { method: 'POST', body: form });
                setStudents(list => [...list, created].sort((a, b) => a.usn.localeCompare(b.usn)));
                toast.success(`${created.fullname} registered as a member`);
            }
            setForm(null);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        setBusy(true);
        try {
            await api(`/students/${confirmId}`, { method: 'DELETE' });
            setStudents(list => list.filter(s => s._id !== confirmId));
            toast.success('Member removed');
            setConfirmId(null);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    const download = () => exportCsv('members.csv', visible, [
        { header: 'USN', value: s => s.usn },
        { header: 'Name', value: s => s.fullname },
        { header: 'Branch', value: s => s.branch },
        { header: 'Semester', value: s => s.semester || '' },
        { header: 'Active loans', value: s => loanCounts[s._id] || 0 }
    ]);

    const confirmStudent = students.find(s => s._id === confirmId);

    return (
        <div className="stack-lg">
            <div className="toolbar">
                <div className="toolbar__left">
                    <div className="searchbox">
                        <Search size={15} />
                        <input
                            className="searchbox__input"
                            placeholder="Search USN, name or branch…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            aria-label="Search members"
                        />
                        {query && (
                            <button className="searchbox__clear" onClick={() => setQuery('')} aria-label="Clear search">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                    <div className="chips">
                        {['All', ...BRANCHES].map(b => (
                            <button key={b} className={`chip ${branch === b ? 'chip--on' : ''}`} onClick={() => setBranch(b)}>
                                {b}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="toolbar__right">
                    <button className="btn btn--ghost" onClick={download}><Download size={15} /> CSV</button>
                    <button className="btn btn--primary" onClick={() => setForm({ ...EMPTY })}>
                        <Plus size={16} /> Register member
                    </button>
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <div className="table-wrap">
                        <table>
                            <tbody>
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i}><td colSpan="5"><span className="skeleton skeleton--line" /></td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : visible.length === 0 ? (
                    <div className="empty">
                        <GraduationCap size={26} />
                        <p>No members match that search.</p>
                        <button className="btn btn--soft" onClick={() => { setQuery(''); setBranch('All'); }}>Reset filters</button>
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Member</th>
                                    <th>USN</th>
                                    <th>Branch</th>
                                    <th>Sem</th>
                                    <th>On loan</th>
                                    <th className="col-actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map(s => {
                                    const onLoan = loanCounts[s._id] || 0;
                                    return (
                                        <tr key={s._id}>
                                            <td>
                                                <span className="cell-member">
                                                    <span className="avatar avatar--xs">{initials(s.fullname)}</span>
                                                    <strong>{s.fullname}</strong>
                                                </span>
                                            </td>
                                            <td className="mono">{s.usn}</td>
                                            <td><span className="badge badge--neutral">{s.branch}</span></td>
                                            <td>{s.semester || '—'}</td>
                                            <td>
                                                {onLoan > 0
                                                    ? <span className="badge badge--active">{onLoan} active</span>
                                                    : <span className="muted">—</span>}
                                            </td>
                                            <td className="col-actions">
                                                <button className="icon-btn icon-btn--sm" onClick={() => setForm({ ...s, semester: s.semester || '' })} aria-label="Edit">
                                                    <Pencil size={14} />
                                                </button>
                                                <button className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => setConfirmId(s._id)} aria-label="Delete">
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

            <p className="result-count">{visible.length} of {students.length} members</p>

            <Modal
                open={!!form}
                title={form?._id ? 'Edit member' : 'Register a member'}
                subtitle={form?._id ? form.usn : 'New members can borrow the same day'}
                onClose={() => setForm(null)}
                footer={
                    <>
                        <button className="btn btn--ghost" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
                        <button className="btn btn--primary" form="student-form" disabled={busy}>
                            {busy ? 'Saving…' : form?._id ? 'Save changes' : 'Register member'}
                        </button>
                    </>
                }
            >
                {form && (
                    <form id="student-form" className="form-grid" onSubmit={save}>
                        <div className="field">
                            <label>USN</label>
                            <input className="input mono" required disabled={!!form._id} value={form.usn}
                                onChange={e => setForm({ ...form, usn: e.target.value })} placeholder="1NM22CS001" />
                        </div>
                        <div className="field">
                            <label>Semester</label>
                            <input className="input" type="number" min="1" max="8" value={form.semester}
                                onChange={e => setForm({ ...form, semester: e.target.value })} />
                        </div>
                        <div className="field field--2">
                            <label>Full name</label>
                            <input className="input" required value={form.fullname}
                                onChange={e => setForm({ ...form, fullname: e.target.value })} placeholder="Aarav Shetty" />
                        </div>
                        <div className="field field--2">
                            <label>Branch</label>
                            <select className="select select--input" value={form.branch}
                                onChange={e => setForm({ ...form, branch: e.target.value })}>
                                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                    </form>
                )}
            </Modal>

            <Confirm
                open={!!confirmId}
                title="Remove this member?"
                message={confirmStudent
                    ? `${confirmStudent.fullname} (${confirmStudent.usn}) and their visit history will be removed. Members with active loans cannot be deleted.`
                    : ''}
                confirmLabel="Remove member"
                busy={busy}
                onConfirm={remove}
                onClose={() => setConfirmId(null)}
            />
        </div>
    );
}
