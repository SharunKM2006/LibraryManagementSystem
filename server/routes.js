// REST API consumed by the React client. Mounted under /api in app.js.
const express = require('express');
const { Librarian, Book, Student, Borrow, Visit } = require('./models');
const { verifyPassword, startOfDay, daysFromNow } = require('./util');

const router = express.Router();

// Dates are stored as UTC; group them by the server's local wall-clock time so
// heatmaps and daily trends line up with what the library actually sees.
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

// Escape user input before embedding it in a $regex. Without this, searches
// containing regex metacharacters such as "(" make MongoDB reject the whole
// query (HTTP 500) — e.g. looking up "C++" or "(" in the catalogue.
function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------- auth ----------------------------------
function requireAuth(req, res, next) {
    if (req.session && req.session.librarian) return next();
    res.status(401).json({ error: 'Not signed in' });
}

router.post('/auth/login', async (req, res) => {
    const { email = '', password = '' } = req.body || {};
    const librarian = await Librarian.findOne({ email: String(email).toLowerCase().trim() });
    if (!librarian || !verifyPassword(password, librarian.password)) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }
    req.session.librarian = {
        id: librarian._id,
        fullname: librarian.fullname,
        email: librarian.email,
        title: librarian.title
    };
    res.json({ librarian: req.session.librarian });
});

router.post('/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

router.get('/auth/me', (req, res) => {
    if (!req.session.librarian) return res.status(401).json({ error: 'Not signed in' });
    res.json({ librarian: req.session.librarian });
});

// Everything below requires a session.
router.use(requireAuth);

// --------------------------------- books ----------------------------------
router.get('/books', async (req, res) => {
    const q = escapeRegex((req.query.q || '').trim());
    const filter = q
        ? { $or: [
            { title: { $regex: q, $options: 'i' } },
            { author: { $regex: q, $options: 'i' } },
            { genre: { $regex: q, $options: 'i' } },
            { isbn: { $regex: q, $options: 'i' } }
        ] }
        : {};
    const books = await Book.find(filter).sort({ createdAt: -1 });
    res.json(books);
});

router.post('/books', async (req, res) => {
    const { title, author, quantity, genre, year, isbn, shelf } = req.body || {};
    if (!title || !author) return res.status(400).json({ error: 'Title and author are required' });
    try {
        const book = await Book.create({
            title, author,
            quantity: Math.max(0, Number(quantity) || 0),
            genre: genre || 'General',
            year: year ? Number(year) : undefined,
            isbn, shelf
        });
        res.status(201).json(book);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.put('/books/:id', async (req, res) => {
    const { title, author, quantity, genre, year, isbn, shelf } = req.body || {};
    try {
        const book = await Book.findByIdAndUpdate(req.params.id, {
            title, author,
            quantity: Math.max(0, Number(quantity) || 0),
            genre: genre || 'General',
            year: year ? Number(year) : undefined,
            isbn, shelf
        }, { returnDocument: 'after', runValidators: true });
        if (!book) return res.status(404).json({ error: 'Book not found' });
        res.json(book);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/books/:id', async (req, res) => {
    const active = await Borrow.countDocuments({ book: req.params.id, status: 'Active' });
    if (active > 0) {
        return res.status(409).json({ error: `Cannot delete: ${active} active loan(s) reference this book` });
    }
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return res.status(404).json({ error: 'Book not found' });
    await Borrow.deleteMany({ book: req.params.id });
    res.json({ ok: true });
});

// -------------------------------- students --------------------------------
router.get('/students', async (req, res) => {
    const q = escapeRegex((req.query.q || '').trim());
    const filter = q
        ? { $or: [
            { usn: { $regex: q, $options: 'i' } },
            { fullname: { $regex: q, $options: 'i' } },
            { branch: { $regex: q, $options: 'i' } }
        ] }
        : {};
    const students = await Student.find(filter).sort({ usn: 1 });
    res.json(students);
});

router.post('/students', async (req, res) => {
    const { usn, fullname, branch, semester } = req.body || {};
    if (!usn || !fullname || !branch) {
        return res.status(400).json({ error: 'USN, name and branch are required' });
    }
    try {
        const student = await Student.create({ usn, fullname, branch, semester });
        res.status(201).json(student);
    } catch (err) {
        res.status(400).json({
            error: err.code === 11000 ? 'A student with that USN already exists' : err.message
        });
    }
});

router.put('/students/:id', async (req, res) => {
    const { fullname, branch, semester } = req.body || {};
    try {
        const student = await Student.findByIdAndUpdate(req.params.id,
            { fullname, branch, semester }, { returnDocument: 'after', runValidators: true });
        if (!student) return res.status(404).json({ error: 'Student not found' });
        res.json(student);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.delete('/students/:id', async (req, res) => {
    const active = await Borrow.countDocuments({ student: req.params.id, status: 'Active' });
    if (active > 0) {
        return res.status(409).json({ error: `Cannot delete: ${active} active loan(s) for this student` });
    }
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    await Borrow.deleteMany({ student: req.params.id });
    await Visit.deleteMany({ student: req.params.id });
    res.json({ ok: true });
});

// -------------------------------- borrows ---------------------------------
router.get('/borrows', async (req, res) => {
    const q = escapeRegex((req.query.q || '').trim());
    let filter = {};
    if (q) {
        const students = await Student.find({
            $or: [{ usn: { $regex: q, $options: 'i' } }, { fullname: { $regex: q, $options: 'i' } }]
        }).select('_id');
        const books = await Book.find({
            $or: [{ title: { $regex: q, $options: 'i' } }, { author: { $regex: q, $options: 'i' } }]
        }).select('_id');
        filter = {
            $or: [
                { student: { $in: students.map(s => s._id) } },
                { book: { $in: books.map(b => b._id) } }
            ]
        };
    }
    const borrows = await Borrow.find(filter)
        .populate('student', 'usn fullname branch')
        .populate('book', 'title author genre quantity shelf')
        .sort({ createdAt: -1 })
        .limit(500);
    res.json(borrows);
});

router.post('/borrows', async (req, res) => {
    const { studentId, bookId, borrowDate, dueDate, loanDays } = req.body || {};
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });
    if (book.quantity <= 0) return res.status(409).json({ error: 'No copies available' });

    const start = borrowDate ? new Date(borrowDate) : new Date();
    const due = dueDate
        ? new Date(dueDate)
        : daysFromNow(Math.max(1, Number(loanDays) || 14));
    if (isNaN(due)) return res.status(400).json({ error: 'Invalid due date' });

    try {
        const borrow = await Borrow.create({
            student: studentId, book: bookId,
            borrowDate: start, dueDate: due, status: 'Active'
        });
        book.quantity -= 1;
        await book.save();
        const populated = await borrow.populate([
            { path: 'student', select: 'usn fullname branch' },
            { path: 'book', select: 'title author genre quantity shelf' }
        ]);
        res.status(201).json(populated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/borrows/:id/return', async (req, res) => {
    const borrow = await Borrow.findById(req.params.id);
    if (!borrow) return res.status(404).json({ error: 'Loan not found' });
    if (borrow.status === 'Returned') return res.status(409).json({ error: 'Already returned' });

    borrow.status = 'Returned';
    borrow.returnedAt = new Date();
    await borrow.save();
    await Book.updateOne({ _id: borrow.book }, { $inc: { quantity: 1 } });
    const populated = await borrow.populate([
        { path: 'student', select: 'usn fullname branch' },
        { path: 'book', select: 'title author genre quantity shelf' }
    ]);
    res.json(populated);
});

router.delete('/borrows/:id', async (req, res) => {
    const borrow = await Borrow.findById(req.params.id);
    if (!borrow) return res.status(404).json({ error: 'Loan not found' });
    if (borrow.status === 'Active') {
        await Book.updateOne({ _id: borrow.book }, { $inc: { quantity: 1 } });
    }
    await borrow.deleteOne();
    res.json({ ok: true });
});

// --------------------------------- visits ---------------------------------
router.get('/visits', async (req, res) => {
    const q = escapeRegex((req.query.q || '').trim());
    let filter = {};
    if (q) {
        const students = await Student.find({
            $or: [{ usn: { $regex: q, $options: 'i' } }, { fullname: { $regex: q, $options: 'i' } }]
        }).select('_id');
        filter = { student: { $in: students.map(s => s._id) } };
    }
    const visits = await Visit.find(filter)
        .populate('student', 'usn fullname branch')
        .sort({ entryAt: -1 })
        .limit(500);
    res.json(visits);
});

router.post('/visits/checkin', async (req, res) => {
    const { studentId, note } = req.body || {};
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const alreadyInside = await Visit.findOne({ student: studentId, exitAt: null });
    if (alreadyInside) return res.status(409).json({ error: `${student.fullname} is already inside the library` });

    const visit = await Visit.create({ student: studentId, entryAt: new Date(), note });
    const populated = await visit.populate('student', 'usn fullname branch');
    res.status(201).json(populated);
});

router.post('/visits/:id/checkout', async (req, res) => {
    const visit = await Visit.findById(req.params.id);
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    if (visit.exitAt) return res.status(409).json({ error: 'Already checked out' });
    visit.exitAt = new Date();
    await visit.save();
    const populated = await visit.populate('student', 'usn fullname branch');
    res.json(populated);
});

router.delete('/visits/:id', async (req, res) => {
    const visit = await Visit.findByIdAndDelete(req.params.id);
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    res.json({ ok: true });
});

// --------------------------------- stats ----------------------------------
router.get('/stats', async (req, res) => {
    const today = startOfDay();
    const in3Days = daysFromNow(3);

    const [titles, copiesAgg, activeLoans, overdue, dueSoon, inside, visitsToday, students, returned30] =
        await Promise.all([
            Book.countDocuments(),
            Book.aggregate([{ $group: { _id: null, total: { $sum: '$quantity' } } }]),
            Borrow.countDocuments({ status: 'Active' }),
            Borrow.countDocuments({ status: 'Active', dueDate: { $lt: new Date() } }),
            Borrow.countDocuments({ status: 'Active', dueDate: { $gte: new Date(), $lte: in3Days } }),
            Visit.countDocuments({ exitAt: null }),
            Visit.countDocuments({ entryAt: { $gte: today } }),
            Student.countDocuments(),
            Borrow.countDocuments({ status: 'Returned', returnedAt: { $gte: new Date(Date.now() - 30 * 864e5) } })
        ]);

    const overdueRows = await Borrow.find({ status: 'Active', dueDate: { $lt: new Date() } })
        .populate('student', 'usn fullname branch')
        .populate('book', 'title author')
        .sort({ dueDate: 1 })
        .limit(5);

    res.json({
        titles,
        copies: copiesAgg[0] ? copiesAgg[0].total : 0,
        activeLoans, overdue, dueSoon,
        occupancy: inside, visitsToday, students,
        returnedLast30: returned30,
        overdueRows
    });
});

// ------------------------------- analytics --------------------------------
router.get('/analytics', async (req, res) => {
    const now = new Date();

    // 14-day circulation trend (loans started vs copies returned per day)
    const trendStart = startOfDay(new Date(now.getTime() - 13 * 864e5));
    const [borrowTrend, returnTrend, topBooks, branches, genres, heatmapRows, recentVisits] = await Promise.all([
        Borrow.aggregate([
            { $match: { borrowDate: { $gte: trendStart } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$borrowDate', timezone: TZ } }, count: { $sum: 1 } } }
        ]),
        Borrow.aggregate([
            { $match: { returnedAt: { $gte: trendStart } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$returnedAt', timezone: TZ } }, count: { $sum: 1 } } }
        ]),
        Borrow.aggregate([
            { $group: { _id: '$book', loans: { $sum: 1 } } },
            { $sort: { loans: -1 } },
            { $limit: 6 },
            { $lookup: { from: 'books', localField: '_id', foreignField: '_id', as: 'book' } },
            { $unwind: '$book' },
            { $project: { loans: 1, title: '$book.title', author: '$book.author' } }
        ]),
        Student.aggregate([
            { $group: { _id: '$branch', students: { $sum: 1 } } },
            { $sort: { students: -1 } }
        ]),
        Book.aggregate([
            { $group: { _id: '$genre', titles: { $sum: 1 }, copies: { $sum: '$quantity' } } },
            { $sort: { copies: -1 } },
            { $limit: 8 }
        ]),
        // Footfall by weekday (0=Sun) x hour, last 8 weeks
        Visit.aggregate([
            { $match: { entryAt: { $gte: new Date(now.getTime() - 56 * 864e5) } } },
            { $group: {
                _id: {
                    weekday: { $dayOfWeek: { date: '$entryAt', timezone: TZ } },
                    hour: { $hour: { date: '$entryAt', timezone: TZ } }
                },
                count: { $sum: 1 }
            } }
        ]),
        Visit.find({ exitAt: null }).populate('student', 'usn fullname branch').sort({ entryAt: -1 })
    ]);

    const trend = [];
    for (let i = 13; i >= 0; i--) {
        const d = startOfDay(new Date(now.getTime() - i * 864e5));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const borrowed = borrowTrend.find(r => r._id === key)?.count || 0;
        const returned = returnTrend.find(r => r._id === key)?.count || 0;
        trend.push({ date: key, borrowed, returned });
    }

    let peak = null;
    for (const row of heatmapRows) {
        if (!peak || row.count > peak.count) {
            peak = { weekday: row._id.weekday, hour: row._id.hour, count: row.count };
        }
    }

    res.json({
        trend,
        topBooks,
        branches,
        genres,
        heatmap: heatmapRows,
        peak,
        live: recentVisits
    });
});

module.exports = router;
