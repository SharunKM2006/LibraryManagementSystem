const express = require('express');
const path = require('path');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();

// ==========================================
// SQLITE DATABASE PRODUCTION SEED FOR RENDER
// ==========================================
// Automatically points to Render's persistent disk in production, or falls back locally
const dbPath = process.env.NODE_ENV === 'production'
    ? '/data/library.db'
    : path.join(__dirname, 'library.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database connection breakdown:', err.message);
    } else {
        console.log(`SQLite system running live at storage map: ${dbPath}`);
    }
});

const app = express();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(
    session({
        secret: "librarysecret",
        resave: false,
        saveUninitialized: false
    })
);

function isLoggedIn(request, response, next) {
    if (request.session.librarian) {
        next();
    } else {
        response.redirect('/');
    }
}

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================
app.get('/', (request, response) => {
    response.render("login", { error: null });
});

app.post('/login', (request, response) => {
    const email = request.body.email;
    const password = request.body.password;

    db.get(`select * from LIBRARIANS where email=? and password=?`, [email, password], (err, row) => {
        if (row) {
            request.session.librarian = row;
            response.redirect("/dashboard");
        } else {
            response.render("login", { error: "invalid credentials" });
        }
    });
});

app.get("/dashboard", isLoggedIn, (request, response) => {
    db.get(`select count(*) as totalBooks from BOOKS`, (err, books) => {
        db.get(`select count(*) as totalBorrowed from BORROWBOOKS`, (err, borrowed) => {
            db.get(`select count(*) as totalVisits from VISITS`, (err, visits) => {
                response.render("dashboard", {
                    librarian: request.session.librarian,
                    TOTAL_BOOKS: books ? books.totalBooks : 0,
                    TOTAL_BORROWED: borrowed ? borrowed.totalBorrowed : 0,
                    TOTAL_VISITS: visits ? visits.totalVisits : 0
                });
            });
        });
    });
});

// ==========================================
// BOOKS MANAGEMENT
// ==========================================
app.get('/books', isLoggedIn, (request, response) => {
    db.all(`SELECT * FROM BOOKS`, (err, rows) => {
        response.render("books", { books: rows });
    });
});

app.get('/books/add', isLoggedIn, (request, response) => {
    response.render("addBook");
});

app.post('/books/add', isLoggedIn, (request, response) => {
    const title = request.body.title;
    const author = request.body.author;
    const quantity = request.body.quantity;

    db.run(`INSERT INTO BOOKS(TITLE, AUTHOR, QUANTITY) VALUES(?,?,?)`, [title, author, quantity], (err) => {
        if (!err) {
            response.redirect('/books');
        } else {
            console.log(err.message);
            response.redirect('/books');
        }
    });
});

app.get('/books/delete/:id', (request, response) => {
    db.run(`DELETE FROM BOOKS WHERE BOOKID=?`, [request.params.id], (err) => {
        if (!err) {
            response.redirect('/books');
        } else {
            console.log("Delete error: ", err.message);
            response.redirect('/books');
        }
    });
});

app.get('/books/edit/:id', (request, response) => {
    db.get(`SELECT * FROM BOOKS WHERE BOOKID=?`, [request.params.id], (err, row) => {
        if (!err && row) {
            response.render("editBook", { book: row });
        } else {
            console.log(err);
            response.redirect('/books');
        }
    });
});

app.post('/books/edit/:id', (request, response) => {
    const title = request.body.title;
    const author = request.body.author;
    const quantity = request.body.quantity;

    db.run(`UPDATE BOOKS SET TITLE=?, AUTHOR=?, QUANTITY=? where BOOKID=?`,
        [title, author, quantity, request.params.id], (err) => {
            if (!err) {
                response.redirect('/books');
            } else {
                console.log("Update database error:", err.message);
                response.redirect('/books');
            }
        });
});

// ==========================================
// STUDENT REGISTRY & SEARCH FILTER
// ==========================================
app.get('/students', isLoggedIn, (request, response) => {
    const searchQuery = request.query.search || '';
    let sqlQuery = `SELECT * FROM STUDENTS`;
    let queryParams = [];

    if (searchQuery.trim() !== '') {
        sqlQuery += ` WHERE UPPER(USN) LIKE UPPER(?)`;
        queryParams.push(`%${searchQuery.trim()}%`);
    }

    db.all(sqlQuery, queryParams, (err, rows) => {
        if (err) console.log("Database search error:", err.message);
        response.render("students", { 
            students: rows || [], 
            search: searchQuery 
        });
    });
});

app.get('/students/add', isLoggedIn, (request, response) => {
    response.render("addStudent");
});

app.post('/students/add', isLoggedIn, (request, response) => {
    const { usn, fullname, branch } = request.body;
    db.run(`INSERT INTO STUDENTS(USN, FULLNAME, BRANCH) VALUES(?,?,?)`, [usn, fullname, branch], (err) => {
        if (err) console.log("Student add error: ", err.message);
        response.redirect('/students');
    });
});

app.get('/students/edit/:usn', isLoggedIn, (request, response) => {
    db.get(`SELECT * FROM STUDENTS WHERE USN=?`, [request.params.usn], (err, row) => {
        if (!err && row) {
            response.render("editStudent", { student: row });
        } else {
            response.redirect('/students');
        }
    });
});

app.post('/students/edit/:usn', isLoggedIn, (request, response) => {
    const { fullname, branch } = request.body;
    db.run(`UPDATE STUDENTS SET FULLNAME=?, BRANCH=? WHERE USN=?`, [fullname, branch, request.params.usn], (err) => {
        if (err) console.log("Student update error:", err.message);
        response.redirect('/students');
    });
});

app.get('/students/delete/:usn', isLoggedIn, (request, response) => {
    db.run(`DELETE FROM STUDENTS WHERE USN=?`, [request.params.usn], (err) => {
        if (err) console.log("Student delete error: ", err.message);
        response.redirect('/students');
    });
});

// ==========================================
// BORROW MANAGEMENT & SEARCH FILTER
// ==========================================
app.get('/borrow', isLoggedIn, (request, response) => {
    const searchQuery = request.query.search || '';
    let sqlQuery = `SELECT * FROM BORROWBOOKS`;
    let queryParams = [];

    if (searchQuery.trim() !== '') {
        sqlQuery += ` WHERE UPPER(USN) LIKE UPPER(?)`;
        queryParams.push(`%${searchQuery.trim()}%`);
    }

    db.all(sqlQuery, queryParams, (err, rows) => {
        if (err) console.log("Database search error:", err.message);
        response.render("borrowed", { 
            borrowRecords: rows || [], 
            search: searchQuery 
        });
    });
});

app.get('/borrow/add', isLoggedIn, (request, response) => {
    response.render("addBorrow");
});

app.post('/borrow/add', isLoggedIn, (request, response) => {
    const { usn, bookid, borrow_date, return_date } = request.body;
    const status = "Active";

    db.run(`INSERT INTO BORROWBOOKS(USN, BOOKID, BORROW_DATE, RETURN_DATE, STATUS) VALUES(?,?,?,?,?)`,
        [usn, bookid, borrow_date, return_date, status], (err) => {
            if (err) {
                console.log("Borrow system registration exception:", err.message);
                response.redirect('/borrow');
            } else {
                db.run(`UPDATE BOOKS SET QUANTITY = QUANTITY - 1 WHERE BOOKID = ? AND QUANTITY > 0`, [bookid], (updateErr) => {
                    if (updateErr) console.log("Inventory breakdown adjustment failed:", updateErr.message);
                    response.redirect('/borrow');
                });
            }
        });
});

app.post('/borrow/return/:id', isLoggedIn, (request, response) => {
    db.get(`SELECT BOOKID FROM BORROWBOOKS WHERE ID=?`, [request.params.id], (err, record) => {
        if (record) {
            db.run(`UPDATE BORROWBOOKS SET STATUS='Returned' WHERE ID=?`, [request.params.id], (statusErr) => {
                if (!statusErr) {
                    db.run(`UPDATE BOOKS SET QUANTITY = QUANTITY + 1 WHERE BOOKID = ?`, [record.BOOKID], (stockErr) => {
                        if (stockErr) console.log(stockErr.message);
                        response.redirect('/borrow');
                    });
                } else {
                    response.redirect('/borrow');
                }
            });
        } else {
            response.redirect('/borrow');
        }
    });
});

// ==========================================
// VISITS LOG & SEARCH FILTER
// ==========================================
app.get('/visits', isLoggedIn, (request, response) => {
    const searchQuery = request.query.search || '';
    let sqlQuery = `SELECT * FROM VISITS`;
    let queryParams = [];

    if (searchQuery.trim() !== '') {
        sqlQuery += ` WHERE UPPER(USN) LIKE UPPER(?)`;
        queryParams.push(`%${searchQuery.trim()}%`);
    }
    
    sqlQuery += ` ORDER BY ID DESC`;

    db.all(sqlQuery, queryParams, (err, rows) => {
        if (err) console.log("Database search error:", err.message);
        response.render("visits", { 
            visitLogs: rows || [], 
            search: searchQuery 
        });
    });
});

app.get('/visits/add', isLoggedIn, (request, response) => {
    response.render("addVisit");
});

app.post('/visits/add', isLoggedIn, (request, response) => {
    const { usn } = request.body;
    const now = new Date();
    const entryTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        ' (' + now.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';

    db.run(`INSERT INTO VISITS(USN, ENTRY_TIME, EXIT_TIME, DURATION) VALUES(?,?,?,?)`,
        [usn, entryTime, 'Active', 'In Progress'], (err) => {
            if (err) console.log("Check-in transaction error:", err.message);
            response.redirect('/visits');
        });
});

app.post('/visits/checkout/:id', isLoggedIn, (request, response) => {
    const recordId = request.params.id;
    const now = new Date();
    const exitTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    db.get(`SELECT ENTRY_TIME FROM VISITS WHERE ID = ?`, [recordId], (err, row) => {
        if (row) {
            let durationStr = "Logged Out";
            db.run(`UPDATE VISITS SET EXIT_TIME = ?, DURATION = ? WHERE ID = ?`,
                [exitTime, durationStr, recordId], (updateErr) => {
                    if (updateErr) console.log("Check-out execution error:", updateErr.message);
                    response.redirect('/visits');
                });
        } else {
            response.redirect('/visits');
        }
    });
});

app.get('/visits/delete/:id', isLoggedIn, (request, response) => {
    db.run(`DELETE FROM VISITS WHERE ID=?`, [request.params.id], (err) => {
        if (err) console.log("Log deletion error: ", err.message);
        response.redirect('/visits');
    });
});

app.get('/logout', (request, response) => {
    request.session.destroy(() => {
        response.redirect("/");
    });
});

// Dynamic Port Binding for Render Deployment Compatibility
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running smoothly on port ${PORT}`);
});