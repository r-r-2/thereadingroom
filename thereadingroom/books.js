// Fields per book:
//   t, a          — title, author
//   c, f          — fallback spine background / text colour (used before cover loads)
//   th, h         — thickness and height in metres
//   note          — the blurb shown in the detail panel
//   isbn          — ISBN-13, used to fetch the cover from Open Library
//   fin / reading — finished date string OR reading progress 0-100
//   spineC, spineF — (optional) cover-matched spine colours, computed once by
//                    running the page and copying from the browser console.
//                    When present, the image-sampling step is skipped entirely.

export default [
  { t: 'The Left Hand of Darkness', a: 'Ursula K. Le Guin', c: '#20455F', f: '#E4F1F9', th: .030, h: .205,
    note: 'Ambassadorial sci-fi that spends its real energy on how a culture without fixed gender would actually think.',
    fin: 'Jan 2025', isbn: '9780441478125' },
  { t: 'Seeing Like a State', a: 'James C. Scott', c: '#7B2E2E', f: '#F5E4DA', th: .042, h: .232,
    note: 'Why grand top-down schemes fail. The chapter on scientific forestry rearranged how I look at metrics.',
    fin: 'Mar 2025', isbn: '9780300078152' },
  { t: 'Piranesi', a: 'Susanna Clarke', c: '#CDC2AE', f: '#33291D', th: .024, h: .192,
    note: 'A house of infinite halls and tides. Short, strange, and completely sure of itself.',
    fin: 'Apr 2025', isbn: '9781635575644' },
  { t: 'Exhalation', a: 'Ted Chiang', c: '#3C3057', f: '#E9E0F7', th: .028, h: .203,
    note: 'Nine stories, no filler. The one about the gate is the one I retell at dinner.',
    fin: 'May 2025', isbn: '9781101947883' },
  { t: 'A Pattern Language', a: 'Christopher Alexander', c: '#B67A22', f: '#2A1C04', th: .055, h: .222,
    note: '253 patterns for building places people want to be in. Half of it applies to software.',
    fin: 'Jul 2025', isbn: '9780195019193' },
  { t: 'Invisible Cities', a: 'Italo Calvino', c: '#8B3055', f: '#FBE2EC', th: .018, h: .178,
    note: 'Fifty-five cities that don’t exist, described to a bored emperor.',
    fin: 'Jul 2025', isbn: '9780156439503' },
  { t: 'Thinking in Systems', a: 'Donella Meadows', c: '#22705E', f: '#DCF3EB', th: .030, h: .198,
    note: 'Stocks, flows, and leverage points. The list of where to intervene is worth the book.',
    fin: 'Aug 2025', isbn: '9781603580557' },
  { t: 'Ways of Seeing', a: 'John Berger', c: '#C74328', f: '#FFE8DF', th: .016, h: .172,
    note: 'Written for television in 1972 and still the sharpest thing on how images work on us.',
    fin: 'Sep 2025', isbn: '9780140135152' },
  { t: 'Klara and the Sun', a: 'Kazuo Ishiguro', c: '#DFB444', f: '#33260A', th: .028, h: .200,
    note: 'An artificial friend watching a family from the window.',
    fin: 'Oct 2025', isbn: '9780593318171' },
  { t: 'Deep Work', a: 'Cal Newport', c: '#243039', f: '#DAE3EC', th: .032, h: .194,
    note: 'The diagnosis is better than the prescription, but the diagnosis is the part I needed.',
    fin: 'Oct 2025', isbn: '9781455586691' },
  { t: 'The Dispossessed', a: 'Ursula K. Le Guin', c: '#2C5978', f: '#DEEFF9', th: .026, h: .188,
    note: 'Two worlds, one wall, and an ambiguous utopia that refuses to let either side win.',
    fin: 'Nov 2025', isbn: '9780061054884' },
  { t: 'Range', a: 'David Epstein', c: '#AF4A1E', f: '#FFE6D9', th: .034, h: .204,
    note: 'The case for generalists. Overstated in places, but the opening earns its keep.',
    fin: 'Feb 2026', isbn: '9780735214484' },
  { t: 'The Beginning of Infinity', a: 'David Deutsch', c: '#123A5C', f: '#DCEDF9', th: .038, h: .228,
    note: 'Ambitious to the point of arrogance, and mostly earns it.',
    fin: 'Apr 2026', isbn: '9780143121350' },
  { t: 'A Field Guide to Getting Lost', a: 'Rebecca Solnit', c: '#5D7A8C', f: '#EAF3F8', th: .022, h: .182,
    note: 'Essays about not knowing where you are, in the good sense.',
    fin: 'May 2026', isbn: '9780143037248' },
  { t: 'The Order of Time', a: 'Carlo Rovelli', c: '#1F3A34', f: '#D9EFE4', th: .024, h: .186,
    note: 'Physics written like poetry. I keep re-reading the middle section.',
    reading: 62, isbn: '9780735216112' },
  { t: 'Braiding Sweetgrass', a: 'Robin Wall Kimmerer', c: '#4A6B2A', f: '#EDF6E1', th: .034, h: .212,
    note: 'Botany and Potawatomi teaching in the same breath. Slow on purpose.',
    reading: 28, isbn: '9781571313560' },
  { t: 'The Dawn of Everything', a: 'Graeber & Wengrow', c: '#5C2450', f: '#F3E0EE', th: .050, h: .238,
    note: 'Takes a hammer to the tidy story of how humans went from bands to states.',
    reading: 44, isbn: '9780374157357' },
];
