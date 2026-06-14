const sqlite3 = require('sqlite3');

const db = new sqlite3.Database("library.db", (err) => {
    if (err) {
        console.log(err);
    } else {
        console.log("connected to database successfully");
    }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS LIBRARIANS (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        FULLNAME TEXT,
        EMAIL TEXT,
        PASSWORD TEXT
    )`, (err) => { if (err) console.log(err); });

    db.run(`CREATE TABLE IF NOT EXISTS STUDENTS (
        USN VARCHAR(10) PRIMARY KEY,
        FULLNAME TEXT,
        BRANCH TEXT
    )`, (err) => { if (err) console.log(err); });

    db.run(`CREATE TABLE IF NOT EXISTS BOOKS (
        BOOKID INTEGER PRIMARY KEY AUTOINCREMENT,
        TITLE TEXT,
        AUTHOR TEXT,
        QUANTITY INTEGER
    )`, (err) => { if (err) console.log(err); });

    db.run(`CREATE TABLE IF NOT EXISTS BORROWBOOKS (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        USN VARCHAR(10),
        BOOKID INTEGER,
        BORROW_DATE TEXT,
        RETURN_DATE TEXT,
        STATUS TEXT
    )`, (err) => { if (err) console.log(err); });

    db.run(`CREATE TABLE IF NOT EXISTS VISITS (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        USN VARCHAR(10),
        ENTRY_TIME TEXT,
        EXIT_TIME TEXT,
        DURATION TEXT
    )`, (err) => { if (err) console.log(err); });

    db.run(`
        INSERT INTO LIBRARIANS(ID, FULLNAME, EMAIL, PASSWORD)
        VALUES
        (1, 'Raghunath', 'ragunath@nmamit.in', 'abc@123'),
        (2, 'Puneeth', 'puneeth@nmamit.in', 'abc@456'),
        (3, 'Darshan', 'darshan@nmamit.in', 'abc@789')
        ON CONFLICT(ID) DO NOTHING;
    `, (err) => {
        if (err) console.log(err);
    });

    db.all("SELECT * FROM LIBRARIANS", [], (err, rows) => {
        if (!err) {
            console.log("\n All librarians");
            console.table(rows);
        }
    });
});

module.exports = db;



