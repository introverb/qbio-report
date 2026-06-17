// QUBIE Report — "Featured" strip rendered at the top of every feed page.
//
// Self-curating: pulls the top FEATURED_LIMIT articles from /feed.json
// whose score >= FEATURED_THRESHOLD, filtered to the page's categories.
// The high threshold means only items matching the DAO-priority authors
// or the "quantum biology" phrase qualify (those keywords carry weight 10).
//
// Card design mirrors the .qubie-card pattern on quantumbiologydao.xyz:
// no banner — instead an editorial-data layout with a mono eyebrow,
// sans-bold title, mono source/date row, thin score bar with cyan fill,
// keyword chips, and a blurb. Distinctive and consistent with the DAO.
//
// Usage on a feed page (add near top of body, after the nav):
//
//   <div id="featured-container"></div>
//   <script>
//     window.FEATURED_CATEGORIES = ["paper","preprint","news"];
//   </script>
//   <script src="/assets/featured.js?v=5"></script>
//
// If no items meet the bar, the container stays hidden.

(function () {
    const THRESHOLD = 10;   // min score to qualify
    const LIMIT     = 12;   // max cards shown
    const SCORE_MAX = 20;   // for the score-bar visualization (score >= 20 = full bar)

    // Per-category accent color for the eyebrow + score bar
    const CAT_ACCENT = {
        paper:    "#D57DB2",   // gold
        preprint: "#854B6E",   // cyan
        news:     "#D57DB2",   // coral
        forums:   "#FFCEEC",   // pale pink
        social:   "#D57DB2",   // pink
        video:    "#FFFCF6",   // cream
    };
    const CAT_LABEL = {
        paper: "PAPER", preprint: "PREPRINT", news: "NEWS",
        forums: "FORUMS", social: "SOCIAL", video: "VIDEO",
    };

    if (!document.getElementById("qbio-featured-styles")) {
        const s = document.createElement("style");
        s.id = "qbio-featured-styles";
        s.textContent = `
            .featured-strip {
                margin: 24px auto 40px;
                max-width: 1180px;
                padding: 0 24px;
            }
            .featured-label {
                display: flex;
                align-items: baseline;
                justify-content: space-between;
                gap: 12px;
                font-family: "Apercu Pro", monospace;
                font-size: 10px;
                letter-spacing: 0.3em;
                text-transform: uppercase;
                color: rgba(238, 232, 223, 0.65);
                border-bottom: 1px solid rgba(238, 232, 223, 0.15);
                padding-bottom: 10px;
                margin-bottom: 18px;
            }
            .featured-sublabel {
                font-family: "Chap", "Apercu Pro", sans-serif;
                font-size: 11px;
                font-weight: 400;
                font-style: italic;
                text-transform: none;
                letter-spacing: 0.04em;
                color: rgba(238, 232, 223, 0.50);
            }
            .featured-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 14px;
            }
            .featured-card {
                position: relative;
                background: rgba(18, 8, 16, 0.55);
                border: 1px solid rgba(238, 232, 223, 0.10);
                border-radius: 4px;
                padding: 18px 18px 16px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                overflow: visible;
                transition: border-color 0.18s, background 0.18s;
            }
            .featured-card:hover {
                border-color: rgba(238, 232, 223, 0.25);
                background: rgba(18, 8, 16, 0.75);
            }
            .featured-card .save-btn {
                position: absolute;
                top: 8px; right: 8px;
                z-index: 2;
            }
            /* Thumbnail (videos only — other categories don't carry one) */
            .featured-thumb {
                position: relative;
                aspect-ratio: 16 / 9;
                margin: -18px -18px 4px;     /* bleed to card edges, sit above the eyebrow */
                background: var(--near-black);
                overflow: hidden;
                border-bottom: 1px solid rgba(238, 232, 223, 0.10);
                display: block;
            }
            .featured-thumb img {
                width: 100%; height: 100%;
                object-fit: cover;
                transition: transform 0.25s;
            }
            .featured-card:hover .featured-thumb img { transform: scale(1.03); }
            .featured-thumb .play-badge {
                position: absolute;
                inset: auto 0 0 0;
                padding: 4px 8px;
                background: linear-gradient(to top, rgba(0,0,0,0.6), transparent);
                color: var(--cream);
                font-size: 9px;
                letter-spacing: 0.15em;
                text-transform: uppercase;
                font-weight: 700;
                text-align: right;
            }
            .featured-card.has-thumb .featured-eyebrow { padding-right: 0; }
            .featured-card.has-thumb .save-btn {
                background: rgba(18, 8, 16, 0.75);
                backdrop-filter: blur(2px);
                border-radius: 50%;
            }
            .featured-eyebrow {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                font-family: "Apercu Pro", monospace;
                font-size: 9px;
                font-weight: 700;
                letter-spacing: 0.28em;
                text-transform: uppercase;
                padding-right: 60px;  /* room for save + × buttons */
            }
            .featured-cat { color: var(--featured-accent, #D57DB2); }
            .featured-date { color: rgba(238, 232, 223, 0.42); font-weight: 400; }
            .featured-card h3 {
                font-family: "Apercu Pro", sans-serif;
                font-size: 15px;
                line-height: 1.3;
                font-weight: 700;
                margin: 2px 0 0;
                color: #FFFCF6;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                line-clamp: 3;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            .featured-card h3 a {
                color: inherit;
                text-decoration: none;
                border-bottom: 1px solid transparent;
            }
            .featured-card h3 a:hover {
                color: var(--featured-accent, #D57DB2);
            }
            .featured-source {
                font-family: "Apercu Pro", monospace;
                font-size: 10px;
                letter-spacing: 0.05em;
                color: rgba(238, 232, 223, 0.50);
                margin-top: -2px;
                line-height: 1.35;
            }
            .featured-source-sep { color: rgba(238, 232, 223, 0.25); margin: 0 6px; }
            .featured-score-row {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-top: 2px;
            }
            .featured-score-bar {
                flex: 1;
                height: 1px;
                background: rgba(238, 232, 223, 0.10);
                position: relative;
            }
            .featured-score-fill {
                position: absolute;
                top: -1px; bottom: -1px;
                left: 0;
                background: var(--featured-accent, #854B6E);
            }
            .featured-score-num {
                font-family: "Apercu Pro", monospace;
                font-size: 9px;
                font-weight: 700;
                letter-spacing: 0.2em;
                color: var(--featured-accent, #854B6E);
                white-space: nowrap;
            }
            .featured-keywords {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
            }
            .featured-kw {
                display: inline-block;
                padding: 1px 6px 2px;
                border: 1px solid rgba(238, 232, 223, 0.15);
                border-radius: 2px;
                font-family: "Apercu Pro", monospace;
                font-size: 9px;
                font-weight: 400;
                letter-spacing: 0.04em;
                text-transform: uppercase;
                color: rgba(238, 232, 223, 0.55);
                white-space: nowrap;
            }
            .featured-kw-more {
                font-family: "Apercu Pro", monospace;
                font-size: 9px;
                color: rgba(238, 232, 223, 0.35);
                padding: 1px 2px;
                letter-spacing: 0.04em;
            }
            .featured-blurb {
                font-family: "Apercu Pro", sans-serif;
                font-size: 12px;
                font-style: italic;
                line-height: 1.5;
                color: rgba(238, 232, 223, 0.62);
                margin: 0;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                line-clamp: 3;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
        `;
        document.head.appendChild(s);
    }

    const esc = (s) => (s || "")
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    function formatDate(iso) {
        if (!iso) return "";
        const d = new Date(iso);
        if (isNaN(d)) return "";
        return d.toLocaleDateString("en-US", {
            timeZone: "America/Los_Angeles",
            month: "short", day: "numeric"
        }).toUpperCase();
    }

    function bookmarkButtonHtml(a) {
        const svg = window.QBIO_SAVES_BOOKMARK_SVG ||
            '<svg viewBox="0 0 24 24" width="16" height="20" aria-hidden="true">' +
            '<path d="M6 3 H18 V21 L12 17 L6 21 Z" stroke="#D57DB2" stroke-width="1.8" fill="none"/></svg>';
        return `<button class="save-btn" data-link="${esc(a.link)}" data-title="${esc(a.title)}" data-source="${esc(a.source)}" data-category="${esc(a.source_category)}" aria-label="Save">${svg}</button>`;
    }

    function sourceHtml(a) {
        // "ArXiv (search)" or "PubMed · Journal Name" — already pre-formatted in
        // article.source. Don't double-decorate.
        return esc(a.source || "");
    }

    function keywordsHtml(a) {
        const kws = Array.isArray(a.matched_keywords) ? a.matched_keywords : [];
        if (!kws.length) return "";
        const show = kws.slice(0, 3);
        const extra = kws.length - show.length;
        const pills = show.map(k =>
            `<span class="featured-kw">${esc(k)}</span>`).join("");
        const more  = extra > 0 ? `<span class="featured-kw-more">+${extra}</span>` : "";
        return `<div class="featured-keywords">${pills}${more}</div>`;
    }

    function renderCard(a) {
        const cat   = (a.source_category || "").toLowerCase();
        const accent = CAT_ACCENT[cat] || "#D57DB2";
        const catLabel = CAT_LABEL[cat] || (a.source_category || "").toUpperCase();
        const date  = formatDate(a.date_iso);
        const score = a.score || 0;
        const fillPct = Math.min(100, Math.round((score / SCORE_MAX) * 100));
        const blurb = a.blurb ? `<p class="featured-blurb">${esc(a.blurb)}</p>` : "";
        // Videos carry a thumbnail field — show a 16:9 preview at the top of
        // the card. Other categories render text-only.
        const thumb = (a.thumbnail || "").trim();
        const hasThumb = !!thumb;
        const thumbHtml = hasThumb
            ? `<a class="featured-thumb" href="${esc(a.link)}" target="_blank" rel="noopener" title="Watch">
                   <img src="${esc(thumb)}" alt="" loading="lazy">
                   <div class="play-badge">Watch &rarr;</div>
               </a>`
            : "";
        return `
            <article class="featured-card${hasThumb ? " has-thumb" : ""}" style="--featured-accent: ${accent};">
                ${bookmarkButtonHtml(a)}
                ${thumbHtml}
                <div class="featured-eyebrow">
                    <span class="featured-cat">${esc(catLabel)}</span>
                    <span class="featured-date">${date}</span>
                </div>
                <h3><a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.title)}</a></h3>
                <div class="featured-source">${sourceHtml(a)}</div>
                <div class="featured-score-row">
                    <div class="featured-score-bar">
                        <div class="featured-score-fill" style="width: ${fillPct}%;"></div>
                    </div>
                    <span class="featured-score-num">SCORE ${score}</span>
                </div>
                ${keywordsHtml(a)}
                ${blurb}
            </article>`;
    }

    async function render() {
        const container = document.getElementById("featured-container");
        if (!container) return;
        const cats = new Set(window.FEATURED_CATEGORIES || []);

        let feed;
        try {
            const r = await fetch("/feed.json", { cache: "no-store" });
            if (!r.ok) return;
            feed = await r.json();
        } catch (_) { return; }

        const articles = (feed && feed.articles) || [];
        const featured = articles
            .filter(a => (a.score || 0) >= THRESHOLD)
            .filter(a => !cats.size || cats.has(a.source_category))
            .sort((a, b) => (b.date_iso || "").localeCompare(a.date_iso || ""))
            .slice(0, LIMIT);

        if (!featured.length) return;

        if (typeof window.qbioRegisterArticle === "function") {
            featured.forEach(window.qbioRegisterArticle);
        }

        container.innerHTML = `
            <section class="featured-strip">
                <div class="featured-label">
                    <span>Featured</span>
                    <span class="featured-sublabel">most recent hits from boosted authors &amp; core quantum-biology terms</span>
                </div>
                <div class="featured-grid">${featured.map(renderCard).join("")}</div>
            </section>`;

        if (typeof window.qbioRefreshSaveIcons === "function") {
            window.qbioRefreshSaveIcons();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", render);
    } else {
        render();
    }
})();
