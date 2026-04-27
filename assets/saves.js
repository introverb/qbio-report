// QUBIE News — bookmark/save icon behavior shared across feed pages.
//
// Usage on a feed page:
//   1. Include <script src="/assets/saves.js"></script> in the page.
//   2. When you render an article, call qbioRegisterArticle(article) to store
//      its full payload, then include a save button in the markup like:
//
//        <button class="save-btn" data-link="${link}" aria-label="Save">
//          <svg viewBox="0 0 16 18"><path d="M2 1 L2 17 L8 13 L14 17 L14 1 Z"/></svg>
//        </button>
//
//   3. Optionally call window.QBIO_SAVES_BOOKMARK_SVG to drop in the SVG.
//
// Logged-out users see a hollow icon; clicking redirects to /login.
// Logged-in users get filled-on-click toggle behavior, syncing with the API.

(function () {
    // Inject our own button styles at load time. Most feed pages have inline
    // <style> blocks instead of importing shared.css, so we can't rely on
    // shared.css being present. Self-contained = robust.
    if (!document.getElementById("qbio-save-btn-styles")) {
        const s = document.createElement("style");
        s.id = "qbio-save-btn-styles";
        s.textContent = `
            button.save-btn {
                display: inline-flex; align-items: center; justify-content: center;
                width: 26px; height: 26px; cursor: pointer; padding: 0; margin: 0;
                border: none !important; background: transparent !important;
                box-shadow: none; outline: none;
                -webkit-appearance: none; appearance: none;
                transition: transform 0.1s; flex-shrink: 0;
            }
            button.save-btn:hover { transform: scale(1.12); }
            button.save-btn.busy { opacity: 0.55; pointer-events: none; }
            button.save-btn.logged-out:hover { transform: scale(1.04); }
            button.save-btn:focus { outline: none; }
            button.save-btn:focus-visible { outline: 2px solid #D57DB2; outline-offset: 2px; border-radius: 3px; }
            button.save-btn svg { width: 16px; height: 20px; display: block; overflow: visible; }
            button.save-btn svg path { transition: fill 0.15s; }
        `;
        document.head.appendChild(s);
    }

    let SAVED_LINKS = new Set();
    let LOGGED_IN   = false;
    const ARTICLES  = new Map(); // link -> full article object

    // Bookmark SVG. Inline-styled for robustness so it renders even if
    // shared.css hasn't loaded yet or got cached. Stroke is pink; the .filled
    // class swaps fill via CSS — but we also set fill="none" inline so the
    // unfilled state never depends on CSS specificity.
    window.QBIO_SAVES_BOOKMARK_SVG =
        '<svg viewBox="0 0 24 24" width="16" height="20" aria-hidden="true" style="display:block;overflow:visible;">' +
        '<path d="M6 3 H18 V21 L12 17 L6 21 Z" ' +
        'stroke="#D57DB2" stroke-width="1.8" stroke-linejoin="round" ' +
        'stroke-linecap="round" fill="none" />' +
        '</svg>';

    function syncIconState(btn) {
        const link = btn.dataset.link;
        const filled = SAVED_LINKS.has(link);
        btn.classList.toggle("filled", filled);
        btn.classList.toggle("logged-out", !LOGGED_IN);
        btn.setAttribute("aria-pressed", filled ? "true" : "false");
        btn.setAttribute(
            "title",
            !LOGGED_IN ? "Log in to save"
                       : (filled ? "Saved · click to remove" : "Save to your library")
        );
        // Belt-and-suspenders: also set the SVG fill inline. The bookmark SVG
        // ships with fill="none" inlined for robustness, which would otherwise
        // outweigh any CSS .filled rule.
        const path = btn.querySelector("svg path");
        if (path) {
            path.setAttribute("fill", filled ? "#D57DB2" : "none");
            path.setAttribute("stroke", LOGGED_IN ? "#D57DB2" : "#7D4A6E");
        }
    }

    function syncAllIcons() {
        document.querySelectorAll(".save-btn[data-link]").forEach(syncIconState);
    }

    async function loadMySaves() {
        try {
            const r = await fetch("/api/saves/me", { cache: "no-store" });
            if (!r.ok) return;
            const data = await r.json();
            LOGGED_IN   = !!data.logged_in;
            SAVED_LINKS = new Set(data.links || []);
            syncAllIcons();
        } catch (_) { /* silent */ }
    }

    document.addEventListener("click", async (e) => {
        const btn = e.target.closest(".save-btn");
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();

        if (!LOGGED_IN) {
            const next = encodeURIComponent(location.pathname + location.search);
            location.href = `/login?next=${next}`;
            return;
        }
        if (btn.classList.contains("busy")) return;

        const link = btn.dataset.link;
        if (!link) return;

        const wasFilled = SAVED_LINKS.has(link);
        btn.classList.add("busy");

        try {
            if (wasFilled) {
                const r = await fetch("/api/saves", {
                    method:  "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({ link }),
                });
                if (r.ok) SAVED_LINKS.delete(link);
            } else {
                const article = ARTICLES.get(link) || {
                    link,
                    title:           btn.dataset.title || "",
                    source:          btn.dataset.source || "",
                    source_category: btn.dataset.category || "",
                };
                const r = await fetch("/api/saves", {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify(article),
                });
                if (r.ok) SAVED_LINKS.add(link);
            }
            // Update every icon for this link (the same article may appear in
            // multiple sections — Recent + Filed, Featured + Archive, etc.)
            document.querySelectorAll(`.save-btn[data-link="${CSS.escape(link)}"]`).forEach(syncIconState);
        } finally {
            btn.classList.remove("busy");
        }
    });

    // Public API for pages
    window.qbioRegisterArticle = function (article) {
        if (article && article.link) ARTICLES.set(article.link, article);
    };
    window.qbioRefreshSaveIcons = syncAllIcons;
    window.qbioReloadMySaves    = loadMySaves;

    loadMySaves();
})();
