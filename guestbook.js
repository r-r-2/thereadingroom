// Guest recommendations — books visitors have left on the guest table.
//
// This file is the source of truth. Entries are appended automatically by
// .github/workflows/shelve-recommendation.yml when a `recommendation`
// issue is given the `approved` label. You can also add or edit by hand.
//
// Fields per entry:
//   id             — GitHub issue number the entry came from (used to clear the
//                    guest's "waiting for approval" tag on their next visit)
//   t, a           — title, author (required)
//   by             — guest name / handle
//   why            — short "why you should read it" (optional)
//   isbn           — ISBN-13 preferred; Open Library cover + title link (optional)
//   cover          — cover image URL when known (optional)
//   date           — month shelved, e.g. 'Sep 2026'
//   c, f, th, h    — optional spine colours / size; sensible defaults are
//                    derived from the title when omitted
//
// Template:
//   { id: 42, t: 'Title', a: 'Author', by: 'Guest', why: 'One line on why.',
//     isbn: '978XXXXXXXXXX', cover: '', date: 'Sept 2026' },

export default [
  { id: 19, t: 'The Secret', a: 'Rhonda Byrne', by: 'Swaa',
    why: 'It changed my perspective and I think it is helpful for everyone in one way or other.',
    isbn: '9783442337903', cover: 'https://covers.openlibrary.org/b/id/845815-M.jpg', date: 'Sept 2026' },
];
