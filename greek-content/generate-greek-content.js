#!/usr/bin/env node
/**
 * Build-time content pipeline for the Greek learning app.
 *
 * This script generates study content ONCE, by asking the content-engine worker
 * (Claude, behind the existing Anthropic proxy). The app itself never calls an
 * LLM at runtime — it ships the frozen, human-reviewed JSON this produces.
 *
 * Flow:  node generate-greek-content.js   →   greek-content.json + review-needed.json
 * then:  open review.html, approve        →   greek-content.approved.json  (what ships)
 *
 * The script ONLY aggregates what the worker returns. It never invents, edits,
 * or hardcodes any Greek content of its own.
 */

'use strict';
const fs = require('fs');
const path = require('path');

/* ------------------------------------------------------------------ config -- */

// Your existing content-engine worker (proxies to the Anthropic Messages API).
const WORKER_URL = process.env.WORKER_URL || 'https://carty-api.aviadchai.workers.dev';
// Build-time quality matters more than cost — use a strong model. Override with MODEL=...
const MODEL = process.env.MODEL || 'claude-sonnet-5';

const TARGET_LANGUAGE = 'Greek';
const NATIVE_LANGUAGE = 'Hebrew';

// A1/A2 starter curriculum. Add / reorder lessons freely.
const CONFIG = [
  { topic: 'Greetings and saying goodbye',                 level: 'A1', count: 7 },
  { topic: 'Everyday polite phrases (please, thank you, sorry, excuse me, yes/no)', level: 'A1', count: 7 },
  { topic: 'Numbers 1 to 20',                              level: 'A1', count: 7 },
  { topic: 'Food, drinks and ordering at a taverna',       level: 'A2', count: 7 },
  { topic: 'Directions and getting around town',           level: 'A2', count: 7 },
  { topic: 'Shopping, prices and paying',                  level: 'A2', count: 7 },
  { topic: 'Small talk (how are you, where are you from, nice to meet you)', level: 'A2', count: 7 },
];

const OUT_DIR = __dirname;

/* --------------------------------------------------------- content engine -- */

// The methodology-grounded system prompt. Produces natural, idiomatic, native
// phrasing — never literal machine translation.
const SYSTEM_PROMPT = `You are an expert language-learning content engine. You generate study material for a learner, grounded in the proven methodologies of Pimsleur, Memrise, and comprehensible-input research — NOT in literal machine translation.

=== ACCURACY (non-negotiable) ===
- Produce natural, idiomatic, native-speaker phrasing. NEVER translate word-for-word.
- A translation must be what a native actually says in that situation, not a literal calque. If Google Translate would produce it, distrust it.
- Always respect register (formal/informal), gender, number, and politeness level. State which register you chose.
- When a phrase has no direct equivalent, give the natural equivalent PLUS a short literal gloss so the learner sees the structure.
- If a word has multiple meanings, disambiguate by context; never dump all senses.

=== METHODOLOGY (Pimsleur + Memrise) ===
1. CORE VOCABULARY FIRST: prioritize the highest-frequency, highest-utility words and phrases. Frequency-rank everything.
2. GRADUATED INTERVAL RECALL (Pimsleur): assign each item a spaced-repetition bucket (1-6) so it resurfaces at expanding intervals.
3. ANTICIPATION / ACTIVE RECALL: design items so the learner must PRODUCE the answer from memory.
4. CONTEXT OVER ISOLATION: teach words inside short, practical, real-life sentences.
5. MNEMONICS (Memrise "mems"): one vivid, memorable association or sound-link per item.
6. AUDIO-FIRST MINDSET: phrasing optimized for listening and speaking; include a transliteration for every target-language item.
7. BITE-SIZED CHUNKS: 5-7 items per set.

=== OUTPUT FORMAT ===
Return valid JSON only, no prose and no markdown fences:
{
  "items": [
    {
      "target": "<phrase in target language>",
      "pronunciation": "<transliteration>",
      "translation": "<natural idiomatic meaning in the native language>",
      "literal_gloss": "<word-by-word structure, or null>",
      "register": "<formal | informal | neutral>",
      "frequency_rank": "<high | medium | low>",
      "srs_bucket": <1-6, 1 = review soonest>,
      "mnemonic": "<memory hook in the native language>",
      "example": "<short natural sentence in the target language>",
      "example_translation": "<idiomatic native-language translation of the example>"
    }
  ]
}`;

function buildUserPrompt(lesson) {
  return `Target language: ${TARGET_LANGUAGE}
Native language: ${NATIVE_LANGUAGE}
Learner level: ${lesson.level}
Topic / scenario: ${lesson.topic}
Number of items: ${lesson.count}

Field language rules (follow exactly):
- "register" must be one of exactly: formal, informal, neutral (English token).
- "frequency_rank" must be one of exactly: high, medium, low (English token).
- "srs_bucket" is a number 1-6.
- "target" and "example" are in ${TARGET_LANGUAGE}.
- "pronunciation" is a ${NATIVE_LANGUAGE}-letter transliteration (so a ${NATIVE_LANGUAGE} speaker can sound it out).
- "translation", "literal_gloss", "mnemonic" and "example_translation" are in ${NATIVE_LANGUAGE}.
Be consistent across all items. Return ONLY the JSON object.`;
}

function buildPayload(lesson) {
  return {
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(lesson) }],
  };
}

/* -------------------------------------------------------------- http layer -- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// POST to the worker with exponential backoff. Returns the model's text output.
async function callWorker(payload, { retries = 4, baseDelay = 1500 } = {}) {
  let delay = baseDelay;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`worker HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const text = data && data.content && data.content[0] && data.content[0].text;
      if (!text) throw new Error('empty worker response');
      return text;
    } catch (err) {
      if (attempt >= retries) throw err;
      console.warn(`    ! ${err.message} — retry ${attempt + 1}/${retries} in ${delay}ms`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

/* --------------------------------------------------------------- parsing --- */

function extractJSON(text) {
  let t = String(text).trim().replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  t = t.replace(/,(\s*[}\]])/g, '$1'); // tolerate trailing commas
  return JSON.parse(t);
}

// Generate one lesson, regenerating once if the model returns unparseable JSON
// (the output is stochastic, so a retry usually yields valid JSON).
async function generateLesson(lesson) {
  let lastText = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    lastText = await callWorker(buildPayload(lesson));
    try {
      return extractJSON(lastText);
    } catch (e) {
      if (attempt === 1) { const err = new Error('unparseable JSON: ' + e.message); err._raw = lastText; throw err; }
      console.warn('    ! JSON parse failed — regenerating lesson…');
    }
  }
}

/* ------------------------------------------------------------ validation --- */

// Fields that must be present and non-empty. literal_gloss is allowed to be null
// (single words often have no separate literal structure), so it's checked apart.
const REQUIRED = ['target', 'pronunciation', 'translation', 'register', 'frequency_rank', 'mnemonic', 'example', 'example_translation'];
const RANKS = ['high', 'medium', 'low'];

function normalize(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[\s.,;:!?"'()\[\]־–-]+/g, ' ').trim();
}

// crude similarity 0..1 via normalized Levenshtein — used only to sniff
// "translation == literal_gloss" (a literal-translation smell).
function similarity(a, b) {
  a = normalize(a); b = normalize(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - dp[m][n] / Math.max(m, n);
}

// Returns an array of problem strings (empty = clean).
function validateItem(it) {
  const problems = [];
  if (!it || typeof it !== 'object') return ['not-an-object'];
  for (const f of REQUIRED) {
    if (it[f] == null || String(it[f]).trim() === '') problems.push(`missing:${f}`);
  }
  if (!('literal_gloss' in it)) problems.push('missing:literal_gloss'); // key must exist (value may be null)
  if (it.frequency_rank && !RANKS.includes(String(it.frequency_rank).toLowerCase())) problems.push('bad:frequency_rank');
  // literal-translation smell: the "natural" translation is basically the word-by-word gloss
  if (it.literal_gloss != null && String(it.literal_gloss).trim() !== '') {
    if (similarity(it.translation, it.literal_gloss) >= 0.9) problems.push('literal-smell');
  }
  return problems;
}

function rankScore(rank) {
  const i = RANKS.indexOf(String(rank || '').toLowerCase());
  return i < 0 ? 0 : RANKS.length - i; // high=3, medium=2, low=1
}

/* ----------------------------------------------------------------- writes -- */

function writeJSON(name, obj) {
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(obj, null, 2) + '\n');
}

/* ------------------------------------------------------------------- main -- */

async function main() {
  console.log(`Content engine: ${MODEL} via ${WORKER_URL}`);
  const all = [];
  const flagged = [];

  for (const lesson of CONFIG) {
    console.log(`\n▶ ${lesson.topic}  [${lesson.level}] ×${lesson.count}`);
    let parsed;
    try {
      parsed = await generateLesson(lesson);
    } catch (err) {
      console.error(`  ✗ ${err.message}`);
      flagged.push({
        _lesson: lesson.topic,
        _error: err._raw ? 'json-parse' : 'worker-failed',
        detail: err.message,
        raw: err._raw ? String(err._raw).slice(0, 500) : undefined,
      });
      continue;
    }
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    console.log(`  ↳ ${items.length} items returned`);
    for (const raw of items) {
      const item = { ...raw, _lesson: lesson.topic, _level: lesson.level };
      const problems = validateItem(item);
      if (problems.length) {
        item._problems = problems;
        flagged.push(item);
        console.log(`    ⚑ ${item.target || '(no target)'} — ${problems.join(', ')}`);
      }
      all.push(item);
    }
  }

  // Deduplicate by target (first win), then order by frequency_rank (high first).
  const seen = new Set();
  const merged = [];
  for (const it of all) {
    const key = String(it.target || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(it);
  }
  merged.sort((a, b) => rankScore(b.frequency_rank) - rankScore(a.frequency_rank));

  writeJSON('greek-content.json', merged);
  writeJSON('review-needed.json', flagged);

  console.log(`\n✓ ${merged.length} unique items → greek-content.json`);
  console.log(`⚑ ${flagged.length} flagged → review-needed.json`);
  if (flagged.length) console.log('  Review the flagged items before shipping.');
}

// Run when executed directly; export the pure pieces for reuse/testing.
if (require.main === module) {
  main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
}

module.exports = {
  WORKER_URL, MODEL, CONFIG, SYSTEM_PROMPT,
  buildUserPrompt, buildPayload, extractJSON, validateItem, rankScore, similarity,
};
