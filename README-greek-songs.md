# Μελωδία — Learn Modern Greek through songs

A pure-static, zero-dependency single-page app (`greek-songs.html` + `greek-songs.json`) that teaches Modern Greek to Hebrew speakers through song lyrics. Hebrew RTL UI, Greek rendered LTR, pronunciation via the browser's Web Speech API (`el-GR`). Features: song list, read-along (tap a line to hear it, tap any Greek word for lemma/part-of-speech/Hebrew meaning/note, toggle transliteration), a Pimsleur-style key-phrases drill with simple spaced repetition, and fill-in-the-blank. Progress is saved per song in `localStorage`. Deploy by pushing to GitHub Pages and opening `greek-songs.html`.

## How to add a new song

**By hand:** edit `greek-songs.json` (an array of song objects) and add an object matching this schema — then reload the app:

```json
{
  "id": "unique-id", "title": "Greek title", "titleHe": "כותרת בעברית", "artist": "אמן",
  "youtubeUrl": "https://…  (optional)",
  "lines": [
    { "gr": "Greek line", "translit": "Latin translit", "translitHe": "תעתיק עברי (optional)",
      "he": "תרגום השורה לעברית",
      "words": [ { "gr": "word", "lemma": "dictionary form", "pos": "שם עצם/פועל/…", "he": "משמעות", "note": "הערה קצרה (optional)" } ] }
  ],
  "keyPhrases": [ { "gr": "phrase", "he": "משמעות", "note": "הערה (optional)" } ]
}
```

Don't commit full copyrighted lyrics — keep your own additions private (the app also stores AI-generated songs only in your browser's `localStorage`).

**With AI (optional):** on the "הוספת שיר" screen, paste raw Greek lyrics and your Anthropic API key (stored only in your browser's `localStorage`), and the app calls the Claude API directly from the browser to generate the full song object and add it to your library.
