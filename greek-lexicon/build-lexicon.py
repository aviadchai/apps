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
EN_JSONL_URL    = "https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl"

GREEK_RE = re.compile(r"[Ͱ-Ͽἀ-῿]")
NIQQUD_RE = re.compile(r"[֑-ׇ]")
# glosses that mean "this is not a real lemma, see the other spelling"
REDIRECT_RE = re.compile(
    r"^(misspelling|alternative (spelling|form)|obsolete (spelling|form)|"
    r"dated (spelling|form)|rare (spelling|form)|superseded (spelling|form)|"
    r"informal (spelling|form)|abbreviation|initialism|contraction) of ", re.I)

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
            real_glosses = []
            for s in (e.get("senses") or []):
                gl = s.get("glosses") or []
                # inflected form OR alternative/misspelling entry -> map to its lemma, don't treat as lemma
                redirect = bool(s.get("form_of") or s.get("alt_of")
                                or REDIRECT_RE.match(" ".join(gl))
                                or ({"form-of", "alt-of", "misspelling"} & set(s.get("tags") or [])))
                for fo in (s.get("form_of") or []) + (s.get("alt_of") or []):
                    tgt = fo.get("word")
                    if tgt:
                        form2lemma.setdefault(w.lower(), tgt)
                if not redirect:
                    real_glosses.extend(gl)
            if not real_glosses:
                continue  # purely a form / alternative / misspelling — not a lemma
            rec = lemmas.setdefault(w, {"pos": pos, "glosses": [], "forms": []})
            for g in real_glosses:
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
                form2lemma.setdefault(fv.lower(), w)   # accented key (accent-aware resolution)
    print(f"  parsed {n} Greek entries -> {len(lemmas)} lemmas, {len(form2lemma)} form mappings")
    return lemmas, form2lemma

# ------------------------------------------------ step B: frequency ranking ---
def load_freq():
    freq = {}   # accented wordform -> count (keep accents: πότε ≠ ποτέ)
    with open(FREQ_TXT, encoding="utf-8") as fh:
        for line in fh:
            parts = line.split()
            if len(parts) == 2 and parts[1].isdigit():
                freq[parts[0].lower()] = int(parts[1])
    return freq

def pick_top_lemmas(lemmas, form2lemma, freq, top_n):
    """Aggregate wordform frequency onto lemmas, return top_n (lemma, total_count).
    Resolution priority: a form that IS a lemma headword counts to itself (accent-exact
    first, so νερό→νερό and πότε≠ποτέ), then the inflection map, then accent-stripped."""
    self_exact = {}
    self_norm = {}
    for w in lemmas:
        self_exact.setdefault(w.lower(), w)
        self_norm.setdefault(strip_accents_gr(w), w)
    f2l_norm = {}
    for k, v in form2lemma.items():
        f2l_norm.setdefault(strip_accents_gr(k), v)

    def resolve(form):
        fl = form.lower()
        return (self_exact.get(fl) or form2lemma.get(fl)
                or self_norm.get(strip_accents_gr(fl)) or f2l_norm.get(strip_accents_gr(fl)))

    agg = {}
    for form, count in freq.items():
        lemma = resolve(form)
        if lemma and lemma in lemmas:
            agg[lemma] = agg.get(lemma, 0) + count
    ranked = sorted(agg.items(), key=lambda kv: kv[1], reverse=True)
    return ranked[:top_n]

# ------------------------------------- step C: Hebrew via English pivot -------
# One streaming pass over the English extraction (per-word fetching does not scale:
# ~1.6 s/word × thousands of lemmas). For each English entry we look at its
# translation table; when a sense lists BOTH one of our target Greek lemmas and a
# Hebrew word, that Hebrew is a verified translation of the Greek (co-occurrence).
def english_stream():
    if USE_CURL:
        p = subprocess.Popen(["curl", "-sSL", EN_JSONL_URL], stdout=subprocess.PIPE)
        for raw in p.stdout:
            yield raw.decode("utf-8", "replace")
        p.wait()
    else:
        with urllib.request.urlopen(EN_JSONL_URL, timeout=900) as r:
            for raw in r:
                yield raw.decode("utf-8", "replace")

def build_greek2heb(target_norm):
    g2h = {}
    n = 0
    for line in english_stream():
        line = line.strip()
        if not line:
            continue
        n += 1
        if n % 200000 == 0:
            print(f"   …scanned {n} English entries; {len(g2h)}/{len(target_norm)} target lemmas have Hebrew")
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        trans = e.get("translations")
        if not trans:
            continue
        by_el, by_he = {}, {}
        for t in trans:
            code = t.get("code"); lang = (t.get("lang") or "").lower()
            if code == "el" or lang in ("greek", "modern greek"):
                gn = strip_accents_gr(t.get("word") or "")
                if gn in target_norm:
                    by_el.setdefault(t.get("sense"), set()).add(gn)
            elif code == "he" or lang == "hebrew":
                w = t.get("word") or ""
                if w:
                    by_he.setdefault(t.get("sense"), []).append(
                        {"word": strip_niqqud(w), "niqqud": w, "roman": t.get("roman")})
        if not by_el:
            continue
        all_he = [h for hl in by_he.values() for h in hl]
        for sense, gns in by_el.items():
            # sense-matched Hebrew, plus Hebrew tagged with no sense (applies broadly);
            # if the Greek itself had no sense tag, consider all Hebrew in the entry.
            if sense is None:
                hebs = all_he
            else:
                hebs = list(by_he.get(sense) or []) + list(by_he.get(None) or [])
            if not hebs:
                continue
            for gn in gns:
                lst = g2h.setdefault(gn, [])
                have = {x["word"] for x in lst}
                for h in hebs:
                    if h["word"] and h["word"] not in have:
                        lst.append(h); have.add(h["word"])
    print(f"   scanned {n} English entries; {len(g2h)} target lemmas got Hebrew")
    return g2h

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

    print("C. Hebrew via English pivot — single streaming pass over English extraction …")
    target_norm = {strip_accents_gr(lemma) for lemma, _ in top}
    g2h = build_greek2heb(target_norm)

    out, with_he = [], 0
    for i, (lemma, count) in enumerate(top, 1):
        info = lemmas[lemma]
        hebs = g2h.get(strip_accents_gr(lemma), [])
        if hebs: with_he += 1
        out.append({
            "lemma": lemma,
            "pos": info["pos"],
            "gloss_en": info["glosses"][0] if info["glosses"] else None,
            "gloss_en_all": info["glosses"][:4],
            "hebrew": hebs,                         # [] -> app shows English gloss (fallback)
            "hebrew_source": "wiktionary-en-pivot" if hebs else "none",
            "inflections": info["forms"][:20],
            "freq_count": count,
            "freq_rank": i,
            "freq_band": band(i, len(top)),
        })

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
