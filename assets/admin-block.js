// QUBIE Report — admin-only "Block" button injected next to every save icon.
//
// On feed pages (/, /chatter, /video) this script:
//   1. Calls /api/me to check is_admin.
//   2. If admin: injects a small × button next to every .save-btn already
//      on the page, and watches for new ones via MutationObserver.
//   3. Clicking the button POSTs to /api/blocklist, then fades and removes
//      the card so the change is visible immediately.
//
// Non-admins see nothing — the script silently no-ops.

(function () {
    let IS_ADMIN = false;

    function injectStyles() {
        if (document.getElementById("qbio-block-btn-styles")) return;
        const s = document.createElement("style");
        s.id = "qbio-block-btn-styles";
        s.textContent = `
            /* Sized + positioned to mirror the .save-btn bookmark exactly. */
            button.block-btn {
                display: inline-flex; align-items: center; justify-content: center;
                width: 26px; height: 26px; cursor: pointer; padding: 0;
                position: absolute;
                top: 4px;
                right: 34px;   /* save-btn occupies right:4px to right:30px; 4px gap → 34px */
                border: none !important;
                background: transparent !important;
                color: #d65c5c;
                box-shadow: none; outline: none;
                -webkit-appearance: none; appearance: none;
                transition: color 0.12s, transform 0.1s;
                z-index: 2;
            }
            button.block-btn svg {
                width: 14px; height: 14px;   /* × is square; smaller than bookmark icon so weights match visually */
                display: block; overflow: visible;
            }
            button.block-btn:hover {
                color: #ff6568;
                transform: scale(1.12);
            }
            button.block-btn.busy { opacity: 0.5; pointer-events: none; }
            button.block-btn:focus { outline: none; }
            button.block-btn:focus-visible { outline: 2px solid #d65c5c; outline-offset: 2px; border-radius: 3px; }
            /* Featured cards: bookmark sits at top:8px right:8px → match + gap */
            .featured-card .block-btn { top: 8px; right: 38px; }
            .qbio-blocking { transition: opacity 0.3s, transform 0.3s; opacity: 0; transform: scale(0.97); }
        `;
        document.head.appendChild(s);
    }

    function injectButton(saveBtn) {
        if (!saveBtn || saveBtn.dataset.blockInjected === "1") return;
        if (!saveBtn.dataset.link) return;
        saveBtn.dataset.blockInjected = "1";
        const link = saveBtn.dataset.link;
        const btn = document.createElement("button");
        btn.className = "block-btn";
        btn.type = "button";
        btn.title = "Admin: permanently block this article";
        btn.setAttribute("aria-label", "Block article");
        btn.dataset.blockLink = link;
        // Thin stroked × — matches the bookmark icon's hairline weight
        btn.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true" style="display:block;overflow:visible;">' +
            '<path d="M5 5 L19 19 M19 5 L5 19" ' +
            'stroke="currentColor" stroke-width="1.8" ' +
            'stroke-linecap="round" fill="none" />' +
            '</svg>';
        // Sit to the LEFT of the bookmark
        saveBtn.insertAdjacentElement("beforebegin", btn);
    }

    function injectAll() {
        document.querySelectorAll(".save-btn[data-link]").forEach(injectButton);
    }

    async function tryEnable() {
        try {
            const r = await fetch("/api/me", { cache: "no-store" });
            if (!r.ok) return;
            const d = await r.json();
            IS_ADMIN = !!(d.logged_in && d.is_admin);
        } catch (_) { return; }
        if (!IS_ADMIN) return;

        injectStyles();
        injectAll();

        // Cards are rendered async — watch for new save-btns and adopt them.
        const obs = new MutationObserver((muts) => {
            for (const m of muts) {
                for (const node of m.addedNodes) {
                    if (!(node instanceof Element)) continue;
                    if (node.matches && node.matches(".save-btn[data-link]")) {
                        injectButton(node);
                    } else if (node.querySelectorAll) {
                        node.querySelectorAll(".save-btn[data-link]").forEach(injectButton);
                    }
                }
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    document.addEventListener("click", async (e) => {
        const btn = e.target.closest(".block-btn");
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        if (btn.classList.contains("busy")) return;

        const link = btn.dataset.blockLink;
        if (!link) return;

        // Find the nearest containing card for a clean fade-out.
        const card = btn.closest(
            ".story-recent, .article, .search-item, .chatter-card, " +
            ".video-card, .post, article, li"
        ) || btn.parentElement;
        const titleEl = card ? card.querySelector("h2, h3, h4, .title, a[href]") : null;
        const titleText = titleEl ? (titleEl.textContent || "").trim().slice(0, 90) : "";

        const msg = titleText
            ? `Block this article permanently?\n\n"${titleText}"\n\nIt'll be removed from the feed and skipped on future scrapes. You can undo it from /admin → Blocked Articles.`
            : "Block this article permanently? It'll be removed from the feed and skipped on future scrapes.";
        if (!confirm(msg)) return;

        btn.classList.add("busy");
        try {
            // Pull the article payload from the save-btn (now the next sibling)
            const saveBtn = btn.nextElementSibling;
            const payload = { link };
            if (saveBtn && saveBtn.dataset) {
                if (saveBtn.dataset.title)    payload.title          = saveBtn.dataset.title;
                if (saveBtn.dataset.source)   payload.source         = saveBtn.dataset.source;
                if (saveBtn.dataset.category) payload.source_category = saveBtn.dataset.category;
            }

            const r = await fetch("/api/blocklist", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify(payload),
            });
            if (!r.ok) {
                const d = await r.json().catch(() => ({}));
                alert(d.error || "Block failed.");
                btn.classList.remove("busy");
                return;
            }
            // Fade and remove the card
            if (card) {
                card.classList.add("qbio-blocking");
                setTimeout(() => card.remove(), 320);
            } else {
                btn.classList.remove("busy");
            }
        } catch (err) {
            alert("Block failed: " + err.message);
            btn.classList.remove("busy");
        }
    });

    tryEnable();
})();
