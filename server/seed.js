// Seeds the database with realistic demo data.
// Run explicitly with `npm run seed` (add -- --reset to wipe first),
// or it auto-runs on server boot when the database is empty.
const mongoose = require('mongoose');
const { Librarian, Book, Student, Borrow, Visit } = require('./models');
const { hashPassword, startOfDay, daysFromNow } = require('./util');

// Deterministic PRNG so every fresh install gets the same demo data.
function mulberry32(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

const LIBRARIANS = [
    { fullname: 'Raghunath', email: 'ragunath@nmamit.in', password: 'abc@123', title: 'Head Librarian' },
    { fullname: 'Puneeth', email: 'puneeth@nmamit.in', password: 'abc@456', title: 'Circulation Desk' },
    { fullname: 'Darshan', email: 'darshan@nmamit.in', password: 'abc@789', title: 'Archive & Reference' }
];

const BOOKS = [
    ['Atomic Habits', 'James Clear', 'Self-Help', 2018, 'A-1', 6],
    ['The Silent Patient', 'Alex Michaelides', 'Fiction', 2019, 'F-2', 4],
    ['Sapiens: A Brief History of Humankind', 'Yuval Noah Harari', 'History', 2011, 'H-1', 5],
    ['Clean Code', 'Robert C. Martin', 'Programming', 2008, 'P-1', 3],
    ['The Alchemist', 'Paulo Coelho', 'Fiction', 1988, 'F-1', 5],
    ['Ikigai: The Japanese Secret to a Long Life', 'Héctor García', 'Wellness', 2016, 'W-1', 4],
    ['Designing Data-Intensive Applications', 'Martin Kleppmann', 'Programming', 2017, 'P-2', 2],
    ['Wings of Fire', 'A. P. J. Abdul Kalam', 'Biography', 1999, 'B-1', 5],
    ['Don Quixote', 'Miguel de Cervantes', 'Fiction', 1605, 'F-3', 2],
    ['Data Structures and Algorithms Made Easy', 'Narasimha Karumanchi', 'Computer Science', 2011, 'P-3', 4],
    ['The Psychology of Money', 'Morgan Housel', 'Finance', 2020, 'M-1', 4],
    ['A Brief History of Time', 'Stephen Hawking', 'Science', 1988, 'S-1', 3],
    ['The Lord of the Rings', 'J. R. R. Tolkien', 'Fantasy', 1954, 'F-4', 3],
    ['Think and Grow Rich', 'Napoleon Hill', 'Self-Help', 1937, 'A-2', 3],
    ['The Girl on the Train', 'Paula Hawkins', 'Fiction', 2015, 'F-5', 2],
    ['Operating System Concepts', 'Abraham Silberschatz', 'Computer Science', 2012, 'P-4', 3],
    ['Deep Work', 'Cal Newport', 'Self-Help', 2016, 'A-3', 4],
    ['Steve Jobs', 'Walter Isaacson', 'Biography', 2011, 'B-2', 2],
    ['The Great Gatsby', 'F. Scott Fitzgerald', 'Fiction', 1925, 'F-6', 4],
    ['Nutrition and Food Science for Nurses', 'Angela M. adigo', 'Health', 2019, 'H-2', 2],
    ['Digital Design and Computer Architecture', 'David Harris', 'Computer Science', 2021, 'P-5', 3],
    ['The Power of Your Subconscious Mind', 'Joseph Murphy', 'Wellness', 1963, 'W-2', 3]
];

const BRANCHES = ['CSE', 'ISE', 'ECE', 'MECH', 'CIVIL'];

function pad(n, width) { return String(n).padStart(width, '0'); }

function studentList(rand) {
    const students = [];
    let i = 1;
    for (const branch of ['CSE', 'CSE', 'ISE', 'ECE', 'MECH', 'CIVIL']) {
        const perBranch = 3 + Math.floor(rand() * 2);
        for (let k = 0; k < perBranch && i <= 22; k++, i++) {
            students.push({
                usn: `1NM22${branch.slice(0, 2).toUpperCase() === 'CI' ? 'CV' : branch.slice(0, 2)}${pad(i, 3)}`,
                fullname: null,
                branch,
                semester: 5
            });
        }
    }
    return students;
}

const FIRST = ['Aarav', 'Ishita', 'Kiran', 'Sneha', 'Rohan', 'Meera', 'Aditya', 'Priya', 'Vikram', 'Nisha',
    'Manoj', 'Ananya', 'Sanjay', 'Divya', 'Arjun', 'Kavya', 'Nikhil', 'Pooja', 'Sagar', 'Tanvi', 'Yash', 'Riya'];
const LAST = ['Shetty', 'Naik', 'Reddy', 'Iyer', 'Hegde', 'Kulkarni', 'Menon', 'Rao', 'Patil', 'Sharma'];

async function reset() {
    await Promise.all([
        Librarian.deleteMany({}), Book.deleteMany({}), Student.deleteMany({}),
        Borrow.deleteMany({}), Visit.deleteMany({})
    ]);
}

async function seed() {
    const rand = mulberry32(20260614);

    await Librarian.insertMany(LIBRARIANS.map(l => ({
        ...l, email: l.email.toLowerCase(), password: hashPassword(l.password)
    })));

    const books = await Book.insertMany(BOOKS.map(([title, author, genre, year, shelf, quantity]) => ({
        title, author, genre, year, shelf, quantity,
        isbn: `978${String(100000000 + Math.floor(rand() * 899999999))}`
    })));

    const students = await Student.insertMany(studentList(rand).map((s, idx) => ({
        ...s,
        fullname: `${FIRST[idx % FIRST.length]} ${LAST[Math.floor(rand() * LAST.length)]}`
    })));

    // ---- Loans over the last 30 days: returned / active / due soon / overdue ----
    const borrows = [];
    const DAY = 864e5;
    const now = Date.now();
    for (let i = 0; i < 40; i++) {
        const roll = rand();
        let daysAgo;
        if (roll < 0.45) daysAgo = 1 + Math.floor(rand() * 28);        // returned
        else if (roll < 0.74) daysAgo = Math.floor(rand() * 11);       // active, 4-14d left
        else if (roll < 0.87) daysAgo = 11 + Math.floor(rand() * 3);   // due within 3 days
        else daysAgo = 16 + Math.floor(rand() * 10);                   // overdue

        const borrowDate = new Date(now - daysAgo * DAY - Math.floor(rand() * 12) * 36e5);
        const dueDate = new Date(borrowDate.getTime() + 14 * DAY);
        const book = books[Math.floor(rand() * books.length)];
        const student = students[Math.floor(rand() * students.length)];

        if (roll < 0.45) {
            const span = Math.max(2, Math.min(daysAgo - 1, 12));
            const returnedAt = new Date(Math.min(
                borrowDate.getTime() + (2 + rand() * span) * DAY, now - 3600e3));
            borrows.push({ student: student._id, book: book._id, borrowDate, dueDate, status: 'Returned', returnedAt });
            book.quantity = Math.max(0, book.quantity - 1);
        } else {
            borrows.push({ student: student._id, book: book._id, borrowDate, dueDate, status: 'Active' });
            book.quantity = Math.max(0, book.quantity - 1);
        }
    }
    await Borrow.insertMany(borrows);
    await Promise.all(books.map(b => b.save()));

    // ---- Visits over the last 8 weeks, weighted toward busy afternoon hours ----
    const visits = [];
    for (let d = 55; d >= 0; d--) {
        const day = startOfDay(new Date(now - d * DAY));
        const weekday = day.getDay();
        if (weekday === 0) continue; // closed Sundays
        const busy = weekday === 1 || weekday === 6 ? 3 : 5 + Math.floor(rand() * 4);
        for (let v = 0; v < busy; v++) {
            const hourPool = [9, 10, 10, 11, 11, 12, 13, 14, 14, 15, 15, 16, 17, 18];
            const hour = hourPool[Math.floor(rand() * hourPool.length)];
            const entryAt = new Date(day);
            entryAt.setHours(hour, Math.floor(rand() * 59), 0, 0);
            if (entryAt.getTime() > now) continue;
            const stayMinutes = 25 + Math.floor(rand() * 95);
            const exitAt = new Date(entryAt.getTime() + stayMinutes * 60000);
            const student = students[Math.floor(rand() * students.length)];
            if (exitAt.getTime() > now) continue; // handled by the live check-ins below
            visits.push({ student: student._id, entryAt, exitAt });
        }
    }

    // Guarantee a lively "inside right now" card for fresh installs.
    [26, 51, 88].forEach((minsAgo, idx) => {
        const student = students[(idx * 7 + 3) % students.length];
        visits.push({ student: student._id, entryAt: new Date(now - minsAgo * 60000), exitAt: null });
    });
    await Visit.insertMany(visits.slice(-260));

    console.log(`Seeded: ${LIBRARIANS.length} librarians, ${books.length} titles, ` +
        `${students.length} students, ${borrows.length} loans, ${visits.length} visits`);
}

// Called on server boot: only seeds when the database has no librarians yet.
async function autoSeed() {
    const count = await Librarian.countDocuments();
    if (count === 0) {
        console.log('Empty database detected — loading demo data...');
        await seed();
    }
}

async function main() {
    const uri = process.env.MONGODB_URI;
    let memory = null;
    if (uri) {
        await mongoose.connect(uri);
    } else {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        memory = await MongoMemoryServer.create();
        await mongoose.connect(memory.getUri('library'));
        console.log('No MONGODB_URI set — seeding a fresh in-memory database.');
        console.log('(For persistent data, set MONGODB_URI to a MongoDB Atlas/local URL)');
    }

    if (process.argv.includes('--reset')) {
        await reset();
        console.log('Wiped existing collections.');
    }
    await seed();

    await mongoose.disconnect();
    if (memory) await memory.stop();
}

if (require.main === module) {
    main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { seed, autoSeed, reset };
