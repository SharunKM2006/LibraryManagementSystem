import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Plus, Search, LayoutGrid, Rows3, Download, Pencil, Trash2, BookOpen, ChevronDown, X
} from 'lucide-react';
import { api, exportCsv, hashStr } from '../api';
import { useToast } from '../store.jsx';
import Modal from '../components/Modal.jsx';
import Confirm from '../components/Confirm.jsx';
import BookCover, { coverGradient } from '../components/BookCover.jsx';

const EMPTY = { title: '', author: '', genre: 'General', year: '', isbn: '', shelf: '', quantity: 1 };

function stockBadge(q) {
    if (q <= 0) return <span className="badge badge--out">Out of stock</span>;
    if (q <= 2) return <span className="badge badge--soon">Low · {q}</span>;
    return <span className="badge badge--active">In stock · {q}</span>;
}

export default function Books() {
    const toast = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [genre, setGenre] = useState('All');
    const [sort, setSort] = useState('title');
    const [view, setView] = useState('grid');
    const [form, setForm] = useState(null); // null | {…book}
    const [confirmId, setConfirmId] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = () => {
        setLoading(true);
        api('/books')
            .then(setBooks)
            .catch(err => toast.error(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Deep links from the command palette: /books?q=… and /books?new=1
    useEffect(() => {
        if (searchParams.get('new') === '1') {
            setForm({ ...EMPTY });
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const genres = useMemo(
        () => ['All', ...Array.from(new Set(books.map(b => b.genre).filter(Boolean))).sort()],
        [books]
    );

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        let list = books.filter(b => {
            const matchesQ = !q || [b.title, b.author, b.genre, b.isbn, b.shelf]
                .some(v => String(v || '').toLowerCase().includes(q));
            const matchesG = genre === 'All' || b.genre === genre;
            return matchesQ && matchesG;
        });
        list = [...list].sort((a, b) => {
            if (sort === 'title') return a.title.localeCompare(b.title);
            if (sort === 'author') return a.author.localeCompare(b.author);
            if (sort === 'stock') return a.quantity - b.quantity;
            if (sort === 'recent') return new Date(b.createdAt) - new Date(a.createdAt);
            return 0;
        });
        return list;
    }, [books, query, genre, sort]);

    const save = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            if (form._id) {
                const updated = await api(`/books/${form._id}`, { method: 'PUT', body: form });
                setBooks(list => list.map(b => (b._id === updated._id ? updated : b)));
                toast.success(`“${updated.title}” updated`);
            } else {
                const created = await api('/books', { method: 'POST', body: form });
                setBooks(list => [created, ...list]);
                toast.success(`“${created.title}” added to the catalogue`);
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
            await api(`/books/${confirmId}`, { method: 'DELETE' });
            setBooks(list => list.filter(b => b._id !== confirmId));
            toast.success('Title removed from the catalogue');
            setConfirmId(null);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusy(false);
        }
    };

    const download = () => exportCsv('catalogue.csv', visible, [
        { header: 'Title', value: b => b.title },
        { header: 'Author', value: b => b.author },
        { header: 'Genre', value: b => b.genre },
        { header: 'Year', value: b => b.year || '' },
        { header: 'ISBN', value: b => b.isbn || '' },
        { header: 'Shelf', value: b => b.shelf || '' },
        { header: 'Copies', value: b => b.quantity }
    ]);

    const confirmBook = books.find(b => b._id === confirmId);

    return (
        <div className="stack-lg">
            <div className="toolbar">
                <div className="toolbar__left">
                    <div className="searchbox">
                        <Search size={15} />
                        <input
                            className="searchbox__input"
                            placeholder="Search title, author, genre, ISBN…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            aria-label="Search catalogue"
                        />
                        {query && (
                            <button className="searchbox__clear" onClick={() => setQuery('')} aria-label="Clear search">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                    <div className="chips">
                        {genres.map(g => (
                            <button
                                key={g}
                                className={`chip ${genre === g ? 'chip--on' : ''}`}
                                onClick={() => setGenre(g)}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="toolbar__right">
                    <label className="select-wrap">
                        <span className="sr-only">Sort by</span>
                        <select value={sort} onChange={(e) => setSort(e.target.value)} className="select">
                            <option value="title">Sort: Title</option>
                            <option value="author">Sort: Author</option>
                            <option value="stock">Sort: Stock (low first)</option>
                            <option value="recent">Sort: Recently added</option>
                        </select>
                        <ChevronDown size={14} />
                    </label>
                    <div className="seg">
                        <button className={`seg__btn ${view === 'grid' ? 'is-on' : ''}`} onClick={() => setView('grid')} aria-label="Cover view">
                            <LayoutGrid size={15} />
                        </button>
                        <button className={`seg__btn ${view === 'table' ? 'is-on' : ''}`} onClick={() => setView('table')} aria-label="Table view">
                            <Rows3 size={15} />
                        </button>
                    </div>
                    <button className="btn btn--ghost" onClick={download}><Download size={15} /> CSV</button>
                    <button className="btn btn--primary" onClick={() => setForm({ ...EMPTY })}>
                        <Plus size={16} /> Add book
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="books-grid">
                    {Array.from({ length: 8 }).map((_, i) => <div className="book-card skeleton" key={i} />)}
                </div>
            ) : visible.length === 0 ? (
                <div className="empty">
                    <BookOpen size={26} />
                    <p>No titles match “{query || genre}”.</p>
                    <button className="btn btn--soft" onClick={() => { setQuery(''); setGenre('All'); }}>
                        Reset filters
                    </button>
                </div>
            ) : view === 'grid' ? (
                <div className="books-grid">
                    {visible.map(book => (
                        <article className="book-card" key={book._id}>
                            <BookCover book={book} />
                            <div className="book-card__body">
                                <span className="book-card__genre">{book.genre}</span>
                                <h3 className="book-card__title" title={book.title}>{book.title}</h3>
                                <p className="book-card__author">{book.author}</p>
                                <div className="book-card__meta">
                                    {stockBadge(book.quantity)}
                                    {book.shelf && <span className="badge badge--neutral">Shelf {book.shelf}</span>}
                                </div>
                            </div>
                            <div className="book-card__actions">
                                <button className="icon-btn icon-btn--sm" onClick={() => setForm({ ...EMPTY, ...book, year: book.year || '' })} aria-label="Edit">
                                    <Pencil size={14} />
                                </button>
                                <button className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => setConfirmId(book._id)} aria-label="Delete">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="card">
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th><th>Title</th><th>Author</th><th>Genre</th><th>Shelf</th><th>Stock</th><th className="col-actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((book, i) => (
                                    <tr key={book._id}>
                                        <td className="mono">{String(i + 1).padStart(2, '0')}</td>
                                        <td>
                                            <span className="cell-title">
                                                <span className="cover cover--xs" style={{ backgroundImage: coverGradient(`${book.title}-${book.author}`) }} />
                                                {book.title}
                                            </span>
                                        </td>
                                        <td>{book.author}</td>
                                        <td><span className="badge badge--neutral">{book.genre}</span></td>
                                        <td className="mono">{book.shelf || '—'}</td>
                                        <td>{stockBadge(book.quantity)}</td>
                                        <td className="col-actions">
                                            <button className="icon-btn icon-btn--sm" onClick={() => setForm({ ...EMPTY, ...book, year: book.year || '' })} aria-label="Edit">
                                                <Pencil size={14} />
                                            </button>
                                            <button className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => setConfirmId(book._id)} aria-label="Delete">
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <p className="result-count">
                {visible.length} of {books.length} titles · {visible.reduce((s, b) => s + b.quantity, 0)} copies in view
            </p>

            <Modal
                open={!!form}
                title={form?._id ? 'Edit title' : 'Add a title'}
                subtitle={form?._id ? `Catalogue #${hashStr(String(form.title)) % 997}` : 'It appears on the shelf the moment you save'}
                onClose={() => setForm(null)}
                footer={
                    <>
                        <button className="btn btn--ghost" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
                        <button className="btn btn--primary" form="book-form" disabled={busy}>
                            {busy ? 'Saving…' : form?._id ? 'Save changes' : 'Add to catalogue'}
                        </button>
                    </>
                }
            >
                {form && (
                    <form id="book-form" className="form-grid" onSubmit={save}>
                        <div className="field field--2">
                            <label>Title</label>
                            <input className="input" required value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Atomic Habits" />
                        </div>
                        <div className="field field--2">
                            <label>Author</label>
                            <input className="input" required value={form.author}
                                onChange={e => setForm({ ...form, author: e.target.value })} placeholder="James Clear" />
                        </div>
                        <div className="field">
                            <label>Genre</label>
                            <input className="input" list="genre-options" value={form.genre}
                                onChange={e => setForm({ ...form, genre: e.target.value })} placeholder="General" />
                            <datalist id="genre-options">
                                {genres.filter(g => g !== 'All').map(g => <option key={g} value={g} />)}
                            </datalist>
                        </div>
                        <div className="field">
                            <label>Shelf</label>
                            <input className="input" value={form.shelf}
                                onChange={e => setForm({ ...form, shelf: e.target.value })} placeholder="A-1" />
                        </div>
                        <div className="field">
                            <label>Year</label>
                            <input className="input" type="number" min="0" max="2100" value={form.year}
                                onChange={e => setForm({ ...form, year: e.target.value })} placeholder="2018" />
                        </div>
                        <div className="field">
                            <label>Copies</label>
                            <input className="input" type="number" min="0" required value={form.quantity}
                                onChange={e => setForm({ ...form, quantity: e.target.value })} />
                        </div>
                        <div className="field field--2">
                            <label>ISBN <span className="optional">optional</span></label>
                            <input className="input" value={form.isbn || ''}
                                onChange={e => setForm({ ...form, isbn: e.target.value })} placeholder="978…" />
                        </div>
                    </form>
                )}
            </Modal>

            <Confirm
                open={!!confirmId}
                title="Remove this title?"
                message={confirmBook ? `“${confirmBook.title}” will be removed from the catalogue. Active loans block deletion.` : ''}
                confirmLabel="Remove title"
                busy={busy}
                onConfirm={remove}
                onClose={() => setConfirmId(null)}
            />
        </div>
    );
}
