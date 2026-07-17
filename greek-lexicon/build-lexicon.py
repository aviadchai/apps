#!/usr/bin/env python3
"""
Build a static Greek↔Hebrew lexicon for the vocab app — no runtime translation API.

Sources (all open, attribution-friendly; NO proprietary content):
  1. Kaikki.org wiktextract of English Wiktionary, Greek subset  (CC BY-SA)
     -> lemma, part of speech, English gloss, inflected forms
  2. English Wiktionary translation tables via Kaikki, per English headword (CC BY-SA)
     -> Hebrew translation, obtained by PIVOT through English:
        Greek lemma --(its English gloss)--> English entry whose translation table
        lists BOTH that Greek lemma and a Hebrew word under the same sense.
        (The Greek Wiktionary extraction does NOT carry usable Hebrew — verified —
         so the English pivot is the reliable open path.)
  3. hermitdave/FrequencyWords, Greek 2018 list  (MIT)
     -> frequency ranking, used to pick the most useful lemmas

Outputs:
  greek-lexicon.json   one record per unique LEMMA (this is what the app ships)
  forms-index.json     inflected-form -> lemma  (client-side lemmatization, no ML)

The script only aggregates what these sources return. It never invents Greek/Hebrew
content of its own.
"""

import json, os, re, sys, time, unicodedata, urllib.parse, urllib.request, subprocess

# ------------------------------------------------------------------- config --
HERE = os.path.dirname(os.path.abspath(__file__))
TOP_N = int(os.environ.get("TOP_N", "800"))          # how many lemmas to keep
DATA_DIR = os.environ.get("DATA_DIR", HERE)           # where big source files live
GREEK_JSONL = os.path.join(DATA_DIR, "kaikki-greek.jsonl")
FREQ_TXT    = os.path.join(DATA_DIR, "el_50k.txt")
OUT_DIR     = os.environ.get("OUT_DIR", HERE)
USE_CURL    = os.environ.get("USE_CURL") == "1"       # shell out to curl (proxy envs)

GREEK_JSONL_URL = "https://kaikki.org/dictionary/Greek/kaikki.org-dictionary-Greek.jsonl"
FREQ_URL        = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/el/el_50k.txt"
EN_WORD_URL     = "https://kaikki.org/dictionary/English/meaning/{a}/{ab}/{w}.jsonl"

GREEK_RE = re.compile(r"[Ͱ-Ͽἀ-῿]")
NIQQUD_RE = re.compile(r"[֑-ׇ]")

# ------------------------------------------------------------- normalization --
def strip_accents_gr(s: str) -> str:
    d = unicodedata.normalize("NFD", s or "")
    d = "".join(c for c in d if not unicodedata.combining(c))
    return d.lower().replace("ς", "σ").strip()   # final sigma -> sigma

def strip_niqqud(s: str) -> str:
    return NIQQUD_RE.sub("", unicodedata.normalize("NFC", s or "")).strip()

def is_greek_word(s: str) -> bool:
    return bool(s) and bool(GREEK_RE.search(s)) and not re.search(r"[0-9]", s)

# --------------------------------------------------------------- http helper --
def http_get(url: str) -> bytes:
    if USE_CURL:
        return subprocess.run(["curl", "-sSL", "--max-time", "60", url],
                              capture_output=True).stdout
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()

def download_if_missing(path: str, url: str):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return
    print(f"  downloading {url} -> {path}")
    data = http_get(url)
    with open(path, "wb") as f:
        f.write(data)

# ------------------------------------------------ step A: read Kaikki Greek ---
def load_greek():
    """Return (lemmas, form2lemma).
    lemmas[word] = {pos, glosses:[...], forms:[greek forms]}
    form2lemma[normalized_form] = lemma_word
    """
    lemmas, form2lemma = {}, {}
    n = 0
    with open(GREEK_JSONL, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                continue
            w = e.get("word")
            if not w or not is_greek_word(w):
                continue
            n += 1
            pos = e.get("pos")
            glosses = []
            is_form = False
            for s in (e.get("senses") or []):
                for g in (s.get("glosses") or []):
                    glosses.append(g)
                if s.get("form_of") or ("form-of" in (s.get("tags") or [])):
                    is_form = True
                    for fo in (s.get("form_of") or []):
                        tgt = fo.get("word")
                        if tgt:
                            form2lemma.setdefault(strip_accents_gr(w), tgt)
            if is_form:
                continue  # this entry is an inflected form, not a lemma
            rec = lemmas.setdefault(w, {"pos": pos, "glosses": [], "forms": []})
            for g in glosses:
                if g not in rec["glosses"]:
                    rec["glosses"].append(g)
            for f in (e.get("forms") or []):
                fv = f.get("form")
                tags = f.get("tags") or []
                if not is_greek_word(fv):
                    continue
                if {"romanization", "table-tags", "inflection-template", "class"} & set(tags):
                    continue
                if fv not in rec["forms"]:
                    rec["forms"].append(fv)
                form2lemma.setdefault(strip_accents_gr(fv), w)
    print(f"  parsed {n} Greek entries -> {len(lemmas)} lemmas, {len(form2lemma)} form mappings")
    return lemmas, form2lemma

# ------------------------------------------------ step B: frequency ranking ---
def load_freq():
    freq = {}
    with open(FREQ_TXT, encoding="utf-8") as fh:
        for line in fh:
            parts = line.split()
            if len(parts) == 2 and parts[1].isdigit():
                freq[strip_accents_gr(parts[0])] = int(parts[1])
    return freq

def pick_top_lemmas(lemmas, form2lemma, freq, top_n):
    """Aggregate wordform frequency onto lemmas, return top_n (lemma, total_count)."""
    agg = {}
    for form_norm, count in freq.items():
        lemma = form2lemma.get(form_norm)
        if not lemma and form_norm in {strip_accents_gr(k): k for k in lemmas}:
            lemma = form_norm
        if lemma and lemma in lemmas:
            agg[lemma] = agg.get(lemma, 0) + count
    # lemmas that never matched a frequency form still count with 0 (kept only if room)
    ranked = sorted(agg.items(), key=lambda kv: kv[1], reverse=True)
    return ranked[:top_n]

# ------------------------------------- step C: Hebrew via English pivot -------
_en_cache = {}
def fetch_english(word):
    key = word.lower()
    if key in _en_cache:
        return _en_cache[key]
    w = key
    a = urllib.parse.quote(w[0]); ab = urllib.parse.quote(w[:2]); wq = urllib.parse.quote(w)
    url = EN_WORD_URL.format(a=a, ab=ab, w=wq)
    rows = []
    try:
        raw = http_get(url)
        for line in raw.splitlines():
            line = line.strip()
            if line:
                try: rows.append(json.loads(line))
                except json.JSONDecodeError: pass
    except Exception:
        rows = []
    _en_cache[key] = rows
    return rows

def english_headwords(glosses):
    """Turn Greek->English glosses into candidate English headwords to look up."""
    cands = []
    for g in glosses[:4]:
        g = re.sub(r"\(.*?\)", "", g).strip()          # drop parentheticals
        g = re.sub(r"^(to|a|an|the)\s+", "", g, flags=re.I).strip()
        if not g:
            continue
        if g.lower() not in [c.lower() for c in cands]:
            cands.append(g)                             # full phrase, e.g. "good morning"
        first = g.split(",")[0].split(";")[0].split()  # and its first content word
        if first and first[0].lower() not in [c.lower() for c in cands]:
            cands.append(first[0])
    return cands[:4]

def hebrew_for(lemma, glosses):
    """PIVOT: find an English entry whose translation table lists our Greek lemma,
    and take the Hebrew translation(s) from the same sense (co-occurrence = verified)."""
    lemma_norm = strip_accents_gr(lemma)
    for hw in english_headwords(glosses):
        for e in fetch_english(hw):
            trans = e.get("translations") or []
            # senses that contain our Greek lemma
            greek_senses = {t.get("sense") for t in trans
                            if (t.get("code") == "el" or (t.get("lang") or "").lower() in ("greek", "modern greek"))
                            and strip_accents_gr(t.get("word") or "") == lemma_norm}
            if not greek_senses:
                continue
            hebs = []
            for t in trans:
                if (t.get("code") == "he" or (t.get("lang") or "").lower() == "hebrew") and t.get("sense") in greek_senses:
                    word = t.get("word") or ""
                    hebs.append({"word": strip_niqqud(word), "niqqud": word, "roman": t.get("roman")})
            if hebs:
                # dedupe by stripped word, keep order
                seen, out = set(), []
                for h in hebs:
                    if h["word"] and h["word"] not in seen:
                        seen.add(h["word"]); out.append(h)
                return out, hw
    return [], None

# ------------------------------------------------------------------- bands ----
def band(rank_pos, total):
    if rank_pos <= total * 0.15: return "very-high"
    if rank_pos <= total * 0.40: return "high"
    if rank_pos <= total * 0.75: return "medium"
    return "low"

# -------------------------------------------------------------------- main ----
def main():
    print("Step 1 — build the Greek↔Hebrew lexicon")
    download_if_missing(FREQ_TXT, FREQ_URL)
    download_if_missing(GREEK_JSONL, GREEK_JSONL_URL)

    print("A. reading Kaikki Greek extraction …")
    lemmas, form2lemma = load_greek()
    print("B. ranking by frequency …")
    freq = load_freq()
    top = pick_top_lemmas(lemmas, form2lemma, freq, TOP_N)
    print(f"   selected {len(top)} lemmas")

    print("C. Hebrew via English pivot (per headword, cached) …")
    out, with_he = [], 0
    for i, (lemma, count) in enumerate(top, 1):
        info = lemmas[lemma]
        hebs, via = hebrew_for(lemma, info["glosses"])
        if hebs: with_he += 1
        out.append({
            "lemma": lemma,
            "pos": info["pos"],
            "gloss_en": info["glosses"][0] if info["glosses"] else None,
            "gloss_en_all": info["glosses"][:4],
            "hebrew": hebs,                         # [] -> app shows English gloss (fallback)
            "hebrew_source": "wiktionary-en-pivot" if hebs else "none",
            "hebrew_via_en": via,
            "inflections": info["forms"][:20],
            "freq_count": count,
            "freq_rank": i,
            "freq_band": band(i, len(top)),
        })
        if i % 25 == 0:
            print(f"   {i}/{len(top)}  (hebrew so far: {with_he})")

    # forms index: every inflected form -> lemma, for the selected lemmas
    lemma_set = {r["lemma"] for r in out}
    forms_index = {}
    for norm_form, lemma in form2lemma.items():
        if lemma in lemma_set:
            forms_index.setdefault(norm_form, lemma)
    for r in out:  # ensure the lemma maps to itself
        forms_index.setdefault(strip_accents_gr(r["lemma"]), r["lemma"])

    with open(os.path.join(OUT_DIR, "greek-lexicon.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    with open(os.path.join(OUT_DIR, "forms-index.json"), "w", encoding="utf-8") as f:
        json.dump(forms_index, f, ensure_ascii=False, indent=2)

    print(f"\n✓ greek-lexicon.json : {len(out)} lemmas ({with_he} with verified Hebrew, "
          f"{len(out)-with_he} English-fallback)")
    print(f"✓ forms-index.json   : {len(forms_index)} form→lemma mappings")

if __name__ == "__main__":
    main()
