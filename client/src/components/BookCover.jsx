import { hashStr } from '../api';

// Deterministic duotone gradients — every title gets its own "jacket"
// without needing external cover images.
const PALETTES = [
    ['#1F3A5F', '#3E7CB1'],
    ['#4A2E3B', '#A05A6E'],
    ['#274E13', '#6AA84F'],
    ['#4E342E', '#A1887F'],
    ['#311B52', '#7E57C2'],
    ['#006064', '#4DD0E1'],
    ['#5D4037', '#D7A86E'],
    ['#37474F', '#90A4AE'],
    ['#6A1B1B', '#C75B5B'],
    ['#1A3C2E', '#5FAE8B']
];

export function coverGradient(seed) {
    const h = hashStr(seed);
    const [a, b] = PALETTES[h % PALETTES.length];
    const angle = 115 + (h % 5) * 15;
    return `linear-gradient(${angle}deg, ${a} 0%, ${b} 100%)`;
}

function coverInitials(title = '') {
    const words = title.split(/\s+/).filter(w => w.length > 2 && !['the', 'and', 'of', 'a'].includes(w.toLowerCase()));
    if (!words.length) return title.slice(0, 2).toUpperCase();
    return words.slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

export default function BookCover({ book, size = 'md' }) {
    const seed = `${book.title}-${book.author}`;
    return (
        <div
            className={`cover cover--${size}`}
            style={{ backgroundImage: coverGradient(seed) }}
            aria-hidden="true"
        >
            <span className="cover__spine" />
            <span className="cover__initials">{coverInitials(book.title)}</span>
            {book.shelf && <span className="cover__shelf">{book.shelf}</span>}
        </div>
    );
}
