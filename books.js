// Fields per book:
//   t, a           — title, author (required)
//   c, f           — fallback spine background / text colour before cover loads
//   th, h          — thickness and height in metres
//   isbn           — ISBN-13 preferred; Open Library cover + title link in the detail panel
//   cover          — (optional) local/remote jacket image; used instead of Open Library
//   fin / reading  — finished date string ('Oct 2025', or a decade like '2000s')
//                    OR reading progress 0–100 (one of). Blank fin still counts as finished.
//   note           — (optional) short detail-panel line; omit or '' to hide
//   review         — (optional) longer personal review; panel section only if set
//   row            — finished books: 'fiction' | 'people' | 'other' (one shelf each)
//   y              — (optional) sort year when fin has no four-digit year; not shown
//   spineC, spineF — (optional) cover-matched spine colours from the console
//                    `[spine]` log after load; skips image-sampling when present
//
// Templates (reading books lie cover-up on the table, anywhere in the array):
//   { t: 'Title', a: 'Author', c: '#1A1A1A', f: '#F0F0F0', th: .022, h: .216,
//     note: '', isbn: '978XXXXXXXXXX', fin: 'Mon YYYY', row: 'other' },
//   { t: 'Title', a: 'Author', c: '#1A1A1A', f: '#F0F0F0', th: .022, h: .216,
//     isbn: '978XXXXXXXXXX', reading: 40, review: 'Optional longer review…' },
//
// See AGENTS.md § Adding a book for verification. Shelf rows are by `row`,
// left to right in time — see placeBooks() in reading-room.html.

export default [
  { t: "Can't Hurt Me", a: 'David Goggins', c: '#1A2744', f: '#f0f0f0', th: .030, h: .229,
    note: '', isbn: '9781544507859', fin: 'Jul 2022', row: 'people' },
  { t: 'A Feast of Vultures', a: 'Josy Joseph', c: '#7A1A1A', f: '#F5E4DA', th: .024, h: .216,
    note: '', isbn: '9789350297513', fin: 'Sep 2023', row: 'other' },
  { t: 'Steal Like an Artist', a: 'Austin Kleon', c: '#F0EBE1', f: '#1A1A1A', th: .014, h: .178,
    note: '', isbn: '9780761169253', fin: 'Oct 2025', row: 'other' },
  { t: 'Show Your Work!', a: 'Austin Kleon', c: '#1A1A1A', f: '#F0EEE8', th: .018, h: .178,
    note: '', isbn: '9780761178972', fin: 'Oct 2025', row: 'other' },
  { t: 'Never Finished', a: 'David Goggins', c: '#111111', f: '#F0F0F0', th: .025, h: .216,
    note: '', isbn: '9781544534060', reading: 20 },
  { t: 'The Singapore Story: Memoirs of Lee Kuan Yew', a: 'Lee Kuan Yew', c: '#1B2A4A', f: '#E8D9B0', th: .030, h: .229,
    note: '', isbn: '9780130208033', reading: 45 },
  { t: 'Zero To Scale: A Playbook To Build Consumer Brands In India', a: 'Arindam Paul', c: '#F4F0E6', f: '#111111', th: .020, h: .210,
    note: '', isbn: '9788198484604', cover: './covers/zero-to-scale.jpg', fin: 'Dec 2025', row: 'other' },
  { t: 'President Ho Chi Minh Biography and Career', a: 'Bùi Kim Hong', c: '#A8C8E0', f: '#1A1A1A', th: .022, h: .216,
    note: '', isbn: '9786048032630', cover: './covers/ho-chi-minh.jpg', fin: 'Feb 2026', row: 'people' },

  { t: 'The Firm', a: 'John Grisham', c: '#E8772E', f: '#1A1A1A', th: .014, h: .178,
    note: '', isbn: '9780582418271', fin: '', y: 2000, row: 'fiction' },
  { t: 'The Da Vinci Code', a: 'Dan Brown', c: '#7A1515', f: '#F0D78C', th: .026, h: .216,
    note: '', isbn: '9780385504201', fin: '', y: 2003, row: 'fiction' },
  { t: 'Inferno', a: 'Dan Brown', c: '#6B1C1C', f: '#E8D5A3', th: .030, h: .229,
    note: '', isbn: '9780385537858', fin: '', y: 2013, row: 'fiction' },
  { t: 'Steve Jobs', a: 'Walter Isaacson', c: '#E4E4E4', f: '#111111', th: .030, h: .229,
    note: '', isbn: '9781451648539', fin: '', y: 2011, row: 'people' },
  { t: 'Elon Musk', a: 'Ashlee Vance', c: '#141414', f: '#F2F2F2', th: .026, h: .229,
    note: '', isbn: '9780753555637', fin: '', y: 2015, row: 'people' },
  { t: "Harry Potter and the Philosopher's Stone", a: 'J.K. Rowling', c: '#8C2F2F', f: '#F6E7C1', th: .018, h: .198,
    note: '', isbn: '9781408855652', fin: '2000s', row: 'fiction' },
  { t: 'Harry Potter and the Chamber of Secrets', a: 'J.K. Rowling', c: '#1E5C45', f: '#F3E6C4', th: .018, h: .198,
    note: '', isbn: '9781408855669', fin: '2000s', row: 'fiction' },
  { t: 'Harry Potter and the Prisoner of Azkaban', a: 'J.K. Rowling', c: '#2A2358', f: '#F0E6C8', th: .020, h: .198,
    note: '', isbn: '9781408855676', fin: '2000s', row: 'fiction' },
  { t: 'Harry Potter and the Goblet of Fire', a: 'J.K. Rowling', c: '#7A2430', f: '#F6E4C8', th: .026, h: .198,
    note: '', isbn: '9781408855683', fin: '2000s', row: 'fiction' },
  { t: 'Harry Potter and the Order of the Phoenix', a: 'J.K. Rowling', c: '#1A3D6E', f: '#F0E6C8', th: .030, h: .198,
    note: '', isbn: '9781408855690', fin: '2000s', row: 'fiction' },
  { t: 'Harry Potter and the Half-Blood Prince', a: 'J.K. Rowling', c: '#1A4A38', f: '#E8D7A8', th: .028, h: .198,
    note: '', isbn: '9781408855706', fin: '2000s', row: 'fiction' },
  { t: 'Harry Potter and the Deathly Hallows', a: 'J.K. Rowling', c: '#3A2218', f: '#F3D7B0', th: .028, h: .198,
    note: '', isbn: '9781408855713', fin: '2000s', row: 'fiction' },
  { t: 'Atomic Habits', a: 'James Clear', c: '#F7F4EF', f: '#1A1A1A', th: .024, h: .229,
    note: '', isbn: '9780735211292', fin: '', y: 2018, row: 'other' },
  { t: 'The Power of Habit', a: 'Charles Duhigg', c: '#F4F0E8', f: '#1A1A1A', th: .024, h: .216,
    note: '', isbn: '9780812981605', fin: '', y: 2012, row: 'other' },
  { t: 'Deep Work', a: 'Cal Newport', c: '#1B2838', f: '#F4F4F4', th: .022, h: .216,
    note: '', isbn: '9781455586691', fin: '', y: 2016, row: 'other' },
  { t: 'Ikigai', a: 'Héctor García & Francesc Miralles', c: '#F7F1E6', f: '#C23B22', th: .016, h: .198,
    note: '', isbn: '9781786330895', fin: '', y: 2016, row: 'other' },
];
