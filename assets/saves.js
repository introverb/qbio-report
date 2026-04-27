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
    let SAVED_LINKS = new Set();
    let LOGGED_IN   = false;
    const ARTICLES  = new Map(); // link -> full article object

    // Bookmark SVG (24x24 viewBox, classic bookmark shape with rounded corners).
    // Pink stroke by default; .filled adds a pink fill via CSS.
    window.QBIO_SAVES_BOOKMARK_SVG =
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M6 3.5 a1 1 0 0 1 1 -1 h10 a1 1 0 0 1 1 1 v17.5 l-6 -3.6 l-6 3.6 z"/>' +
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
