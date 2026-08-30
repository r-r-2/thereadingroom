// Fields per book:
//   t, a           — title, author (required)
//   c, f           — fallback spine background / text colour before cover loads
//   th, h          — thickness and height in metres
//   isbn           — ISBN-13 preferred; Open Library cover + title link in the detail panel
//   cover          — (optional) local/remote jacket image; used instead of Open Library
//   fin / reading  — finished date string ('Oct 2025') OR reading progress 0–100 (one of)
//   note           — (optional) short detail-panel line; omit or '' to hide
//   review         — (optional) longer personal review; panel section only if set
//   spineC, spineF — (optional) cover-matched spine colours from the console
//                    `[spine]` log after load; skips image-sampling when present
//
// Templates (append finished books at the end of the array;
//   reading books lie cover-up on the table, anywhere in the array):
//   { t: 'Title', a: 'Author', c: '#1A1A1A', f: '#F0F0F0', th: .022, h: .216,
//     note: '', isbn: '978XXXXXXXXXX', fin: 'Mon YYYY' },
//   { t: 'Title', a: 'Author', c: '#1A1A1A', f: '#F0F0F0', th: .022, h: .216,
//     isbn: '978XXXXXXXXXX', reading: 40, review: 'Optional longer review…' },
//
// See AGENTS.md § Adding a book for shelf order and verification.

export default [
  { t: "Can't Hurt Me", a: 'David Goggins', c: '#1A2744', f: '#f0f0f0', th: .030, h: .229,
    note: '', isbn: '9781544507859', fin: 'Jul 2022' },
  { t: 'A Feast of Vultures', a: 'Josy Joseph', c: '#7A1A1A', f: '#F5E4DA', th: .024, h: .216,
    note: '', isbn: '9789350297513', fin: 'Sep 2023' },
  { t: 'Show Your Work!', a: 'Austin Kleon', c: '#1A1A1A', f: '#F0EEE8', th: .018, h: .178,
    note: '', isbn: '9780761178972', fin: 'Oct 2025' },
  { t: 'Steal Like an Artist', a: 'Austin Kleon', c: '#F0EBE1', f: '#1A1A1A', th: .014, h: .178,
    note: '', isbn: '9780761169253', fin: 'Oct 2025' },
  { t: 'Never Finished', a: 'David Goggins', c: '#111111', f: '#F0F0F0', th: .025, h: .216,
    note: '', isbn: '9781544534060', reading: 20 },
  { t: 'The Singapore Story: Memoirs of Lee Kuan Yew', a: 'Lee Kuan Yew', c: '#1B2A4A', f: '#E8D9B0', th: .030, h: .229,
    note: '', isbn: '9780130208033', reading: 45 },
  { t: 'Zero To Scale: A Playbook To Build Consumer Brands In India', a: 'Arindam Paul', c: '#F4F0E6', f: '#111111', th: .020, h: .210,
    note: '', isbn: '9788198484604', cover: './covers/zero-to-scale.jpg', fin: 'Dec 2025' },
  { t: 'President Ho Chi Minh Biography and Career', a: 'Bùi Kim Hong', c: '#A8C8E0', f: '#1A1A1A', th: .022, h: .216,
    note: '', isbn: '9786048032630', cover: './covers/ho-chi-minh.jpg', fin: 'Feb 2026' },
];
