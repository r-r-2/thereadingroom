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
  { t: "The Left Hand of Darkness", a: "Ursula K. Le Guin", c: "#20455F", f: "#E4F1F9", th: 0.03, h: 0.205, note: "Ambassadorial sci-fi that spends its real energy on how a culture without fixed gender would actually think.", isbn: "9780441478125", fin: "Jan 2025", spineC: "rgb(194,197,214)", spineF: "#111" },
  { t: "Seeing Like a State", a: "James C. Scott", c: "#7B2E2E", f: "#F5E4DA", th: 0.042, h: 0.232, note: "Why grand top-down schemes fail. The chapter on scientific forestry rearranged how I look at metrics.", isbn: "9780300078152", fin: "Mar 2025", spineC: "rgb(82,81,62)", spineF: "#f0f0f0" },
  { t: "Piranesi", a: "Susanna Clarke", c: "#CDC2AE", f: "#33291D", th: 0.024, h: 0.192, note: "A house of infinite halls and tides. Short, strange, and completely sure of itself.", isbn: "9781635575644", fin: "Apr 2025", spineC: "rgb(69,70,98)", spineF: "#f0f0f0" },
  { t: "Exhalation", a: "Ted Chiang", c: "#3C3057", f: "#E9E0F7", th: 0.028, h: 0.203, note: "Nine stories, no filler. The one about the gate is the one I retell at dinner.", isbn: "9781101947883", fin: "May 2025", spineC: "rgb(8,17,23)", spineF: "#f0f0f0" },
  { t: "A Pattern Language", a: "Christopher Alexander", c: "#B67A22", f: "#2A1C04", th: 0.055, h: 0.222, note: "253 patterns for building places people want to be in. Half of it applies to software.", isbn: "9780195019193", fin: "Jul 2025", spineC: "rgb(222,192,140)", spineF: "#111" },
  { t: "Invisible Cities", a: "Italo Calvino", c: "#8B3055", f: "#FBE2EC", th: 0.018, h: 0.178, note: "Fifty-five cities that don’t exist, described to a bored emperor.", isbn: "9780156439503", fin: "Jul 2025" },
  { t: "Thinking in Systems", a: "Donella Meadows", c: "#22705E", f: "#DCF3EB", th: 0.03, h: 0.198, note: "Stocks, flows, and leverage points. The list of where to intervene is worth the book.", isbn: "9781603580557", fin: "Aug 2025", spineC: "rgb(224,217,199)", spineF: "#111" },
  { t: "Ways of Seeing", a: "John Berger", c: "#C74328", f: "#FFE8DF", th: 0.016, h: 0.172, note: "Written for television in 1972 and still the sharpest thing on how images work on us.", isbn: "9780140135152", fin: "Sep 2025", spineC: "rgb(245,245,241)", spineF: "#111" },
  { t: "Klara and the Sun", a: "Kazuo Ishiguro", c: "#DFB444", f: "#33260A", th: 0.028, h: 0.2, note: "An artificial friend watching a family from the window.", isbn: "9780593318171", fin: "Oct 2025", spineC: "rgb(243,91,79)", spineF: "#f0f0f0" },
  { t: "Deep Work", a: "Cal Newport", c: "#243039", f: "#DAE3EC", th: 0.032, h: 0.194, note: "The diagnosis is better than the prescription, but the diagnosis is the part I needed.", isbn: "9781455586691", fin: "Oct 2025", spineC: "rgb(147,116,46)", spineF: "#f0f0f0" },
  { t: "The Dispossessed", a: "Ursula K. Le Guin", c: "#2C5978", f: "#DEEFF9", th: 0.026, h: 0.188, note: "Two worlds, one wall, and an ambiguous utopia that refuses to let either side win.", isbn: "9780061054884", fin: "Nov 2025", spineC: "rgb(186,88,56)", spineF: "#f0f0f0" },
  { t: "Range", a: "David Epstein", c: "#AF4A1E", f: "#FFE6D9", th: 0.034, h: 0.204, note: "The case for generalists. Overstated in places, but the opening earns its keep.", isbn: "9780735214484", fin: "Feb 2026", spineC: "rgb(136,213,188)", spineF: "#111" },
  { t: "The Beginning of Infinity", a: "David Deutsch", c: "#123A5C", f: "#DCEDF9", th: 0.038, h: 0.228, note: "Ambitious to the point of arrogance, and mostly earns it.", isbn: "9780143121350", fin: "Apr 2026", spineC: "rgb(42,42,45)", spineF: "#f0f0f0" },
  { t: "A Field Guide to Getting Lost", a: "Rebecca Solnit", c: "#5D7A8C", f: "#EAF3F8", th: 0.022, h: 0.182, note: "Essays about not knowing where you are, in the good sense.", isbn: "9780143037248", fin: "May 2026", spineC: "rgb(104,105,105)", spineF: "#f0f0f0" },
  { t: "The Order of Time", a: "Carlo Rovelli", c: "#1F3A34", f: "#D9EFE4", th: 0.024, h: 0.186, note: "Physics written like poetry. I keep re-reading the middle section.", isbn: "9780735216112", reading: 62, spineC: "rgb(26,23,18)", spineF: "#f0f0f0" },
  { t: "Braiding Sweetgrass", a: "Robin Wall Kimmerer", c: "#4A6B2A", f: "#EDF6E1", th: 0.034, h: 0.212, note: "Botany and Potawatomi teaching in the same breath. Slow on purpose.", isbn: "9781571313560", reading: 28, spineC: "rgb(227,224,203)", spineF: "#111" },
  { t: "The Dawn of Everything", a: "Graeber & Wengrow", c: "#5C2450", f: "#F3E0EE", th: 0.05, h: 0.238, note: "Takes a hammer to the tidy story of how humans went from bands to states.", isbn: "9780374157357", reading: 44, spineC: "rgb(241,143,6)", spineF: "#111" },
];
