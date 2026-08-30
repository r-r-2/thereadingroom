// Fields per book:
//   t, a          — title, author
//   c, f          — fallback spine background / text colour (used before cover loads)
//   th, h         — thickness and height in metres
//   note          — the blurb shown in the detail panel
//   isbn          — ISBN-13 (or ISBN-10), used to fetch the cover from Open Library
//   fin / reading — finished date string OR reading progress 0-100
//   spineC, spineF — (optional) cover-matched spine colours, computed once by
//                    running the page and copying from the browser console.
//                    When present, the image-sampling step is skipped entirely.

export default [
  { t: "Can't Hurt Me", a: 'David Goggins', c: '#1A2744', f: '#f0f0f0', th: .030, h: .229,
    note: '', isbn: '9781544507859', fin: 'Jul 2025' },
  { t: 'A Feast of Vultures', a: 'Josy Joseph', c: '#7A1A1A', f: '#F5E4DA', th: .024, h: .216,
    note: '', isbn: '9789350297513', fin: 'Sep 2025' },
  { t: 'Show Your Work!', a: 'Austin Kleon', c: '#1A1A1A', f: '#F0EEE8', th: .018, h: .178,
    note: '', isbn: '9780761178972', fin: 'Oct 2025' },
  { t: 'Steal Like an Artist', a: 'Austin Kleon', c: '#F0EBE1', f: '#1A1A1A', th: .014, h: .178,
    note: '', isbn: '9780761169253', fin: 'Oct 2025' },
  { t: 'Never Finished', a: 'David Goggins', c: '#111111', f: '#F0F0F0', th: .025, h: .216,
    note: '', isbn: '9781544534060', fin: 'Oct 2025' },
];
