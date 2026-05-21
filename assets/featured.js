// QUBIE News — "Featured" strip rendered at the top of every feed page.
//
// Self-curating: pulls the top FEATURED_LIMIT articles from /feed.json
// whose score >= FEATURED_THRESHOLD, filtered to the page's categories.
// The high threshold means only items matching the DAO-priority authors
// or the "quantum biology" phrase qualify (those keywords carry weight 10).
//
// Each card has a 3:1 banner at the top — uses article.thumbnail if
// present (currently only YouTube articles), otherwise falls back to a
// palette gradient picked deterministically from the article link.
//
// Usage on a feed page (add near top of body, after the nav):
//
//   <div id="featured-container"></div>
//   <script>
//     window.FEATURED_CATEGORIES = ["paper","preprint","news"];
//   </script>
//   <script src="/assets/featured.js?v=3"></script>
//
// If no items meet the bar, the container stays hidden (no empty section).

(function () {
    const THRESHOLD = 10;   // min score to qualify; matches author + phrase weighting
    const LIMIT     = 10;   // max cards shown — newest qualifying items

    // Palette gradients used when no image is available. Sourced from the
    // site's color tokens: --cream #EEE8DF, --dark-purple #2D1B30,
    // --light-purple #7D4A6E, --pink #D57DB2. Each gradient is picked
    // deterministically per-article so the strip isn't all one color.
    const GRADIENTS = [
        "linear-gradient(135deg, #2D1B30 0%, #7D4A6E 60%, #D57DB2 100%)",
        "linear-gradient(135deg, #7D4A6E 0%, #D57DB2 100%)",
        "linear-gradient(135deg, #D57DB2 0%, #EEE8DF 100%)",
        "linear-gradient(135deg, #2D1B30 0%, #D57DB2 100%)",
        "linear-gradient(135deg, #7D4A6E 0%, #2D1B30 100%)",
        "linear-gradient(135deg, #EEE8DF 0%, #D57DB2 60%, #7D4A6E 100%)",
        "linear-gradient(120deg, #2D1B30 0%, #7D4A6E 50%, #EEE8DF 100%)",
        "linear-gradient(150deg, #D57DB2 0%, #7D4A6E 70%, #2D1B30 100%)",
    ];

    function gradientFor(link) {
        // Cheap deterministic hash → gradient index
        let h = 0;
        const s = link || "";
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        return GRADIENTS[Math.abs(h) % GRADIENTS.length];
    }

    // Inject styles once (each feed page has its own inline <style>; not all
    // pull shared.css, so be self-contained like saves.js).
    if (!document.getElementById("qbio-featured-styles")) {
        const s = document.createElement("style");
        s.id = "qbio-featured-styles";
        s.textContent = `
            .featured-strip {
                margin: 24px auto 32px;
                max-width: 1180px;
                padding: 0 24px;
            }
            .featured-label {
                font-family: "Chap", "Apercu Pro", sans-serif;
                font-size: 13px;
                letter-spacing: 0.2em;
                text-transform: uppercase;
                color: #2D1B30;
                border-bottom: 1px solid #2D1B30;
                padding-bottom: 6px;
                margin-bottom: 4px;
                display: flex;
                align-items: baseline;
                justify-content: space-between;
                gap: 12px;
            }
            .featured-sublabel {
                font-style: italic;
                font-size: 11px;
                font-family: "Apercu Pro", -apple-system, BlinkMacSystemFont, sans-serif;
                color: #7D4A6E;
                text-transform: none;
                letter-spacing: 0.04em;
                font-weight: 400;
            }
            .featured-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 14px;
                margin-top: 14px;
            }
            .featured-card {
                position: relative;
                background: #EEE8DF;
                border: 1px solid #2D1B30;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .featured-banner {
                width: 100%;
                aspect-ratio: 3 / 1;
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                background-color: #7D4A6E;
                border-bottom: 1px solid #2D1B30;
                flex-shrink: 0;
            }
            .featured-card-body {
                padding: 12px 14px 12px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                flex: 1;
                border-left: 3px solid #D57DB2;
                margin-left: -1px; /* tuck the accent under the card border */
            }
            .featured-card .save-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                background: rgba(238, 232, 223, 0.85) !important;
                border-radius: 50%;
                width: 28px;
                height: 28px;
                z-index: 2;
            }
            .featured-card h3 {
                font-family: "Apercu Pro", sans-serif;
                font-size: 14px;
                line-height: 1.3;
                font-weight: 700;
                margin: 0;
                color: #1A1416;
            }
            .featured-card h3 a {
                color: inherit;
                text-decoration: none;
                border-bottom: 1px solid transparent;
            }
            .featured-card h3 a:hover {
                color: #7D4A6E;
                border-bottom-color: #D57DB2;
            }
            .featured-card .featured-meta {
                font-size: 10px;
                letter-spacing: 0.06em;
                color: #3A3036;
                text-transform: uppercase;
                margin-top: auto;
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
                align-items: center;
            }
            .featured-card .featured-meta .dot { color: #7D4A6E; }
            .featured-card .featured-score {
                font-size: 10px;
                font-weight: 700;
                color: #D57DB2;
                letter-spacing: 0.1em;
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

    function bannerHtml(a) {
        const thumb = (a.thumbnail || "").trim();
        if (thumb) {
            return `<div class="featured-banner" style="background-image:url('${esc(thumb)}');"></div>`;
        }
        return `<div class="featured-banner" style="background-image:${gradientFor(a.link)};"></div>`;
    }

    function renderCard(a) {
        const date = formatDate(a.date_iso);
        const src  = esc(a.source || "");
        return `
            <div class="featured-card">
                ${bookmarkButtonHtml(a)}
                ${bannerHtml(a)}
                <div class="featured-card-body">
                    <h3><a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.title)}</a></h3>
                    <div class="featured-meta">
                        <span>${src}</span>
                        ${date ? `<span class="dot">·</span><span>${date}</span>` : ""}
                        <span class="dot">·</span>
                        <span class="featured-score">SCORE ${a.score}</span>
                    </div>
                </div>
            </div>`;
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

        if (!featured.length) return; // stay hidden — nothing earns the spot

        // Register articles with saves.js so the bookmark click has full payload
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
