const mongoose = require('mongoose');

const { Schema, model } = mongoose;

const LibrarianSchema = new Schema({
    fullname: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // scrypt hash
    title: { type: String, default: 'Head Librarian' }
}, { timestamps: true });

const BookSchema = new Schema({
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    genre: { type: String, default: 'General', trim: true },
    year: { type: Number, min: 0 },
    isbn: { type: String, trim: true },
    shelf: { type: String, trim: true }, // e.g. "A-3"
    quantity: { type: Number, required: true, default: 1, min: 0 }
}, { timestamps: true });

const StudentSchema = new Schema({
    usn: { type: String, required: true, unique: true, uppercase: true, trim: true },
    fullname: { type: String, required: true, trim: true },
    branch: { type: String, required: true, trim: true },
    semester: { type: Number, min: 1, max: 8 }
}, { timestamps: true });

const BorrowSchema = new Schema({
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    borrowDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ['Active', 'Returned'], default: 'Active' },
    returnedAt: { type: Date }
}, { timestamps: true });

const VisitSchema = new Schema({
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    entryAt: { type: Date, required: true, default: Date.now },
    exitAt: { type: Date }, // missing = still inside the library
    note: { type: String, trim: true }
}, { timestamps: true });

module.exports = {
    Librarian: model('Librarian', LibrarianSchema),
    Book: model('Book', BookSchema),
    Student: model('Student', StudentSchema),
    Borrow: model('Borrow', BorrowSchema),
    Visit: model('Visit', VisitSchema)
};
