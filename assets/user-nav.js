// QUBIE News — populate the right-side nav slot based on auth state.
// Each page includes a <div class="nav-admin" id="user-nav-slot">…</div>
// holding a fallback "Log in" link; this script swaps it in based on /api/me.
(function () {
    function escapeHtml(s) {
        return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function render(me) {
        // Top-right user slot
        const slot = document.getElementById("user-nav-slot");
        if (slot) {
            if (me && me.logged_in && !me.legacy_admin) {
                slot.innerHTML =
                    `<a href="/u/${encodeURIComponent(me.username)}" title="My profile">@${escapeHtml(me.username)}</a>` +
                    `<span class="sep">·</span><a href="/logout">Log out</a>`;
            } else if (me && me.logged_in && me.legacy_admin) {
                slot.innerHTML = `<a href="/logout">Log out</a>`;
            } else {
                slot.innerHTML = `<a href="/login">Log in</a>`;
            }
        }

        // Footer admin link — only visible to admins (real or legacy).
        // Olli moved Admin out of the top nav to keep things clean.
        const footerAdmin = document.getElementById("footer-admin-link");
        if (footerAdmin) {
            if (me && (me.is_admin || me.legacy_admin)) {
                footerAdmin.innerHTML = `<a href="/admin" style="color:inherit;border-bottom:1px solid currentColor;text-decoration:none;">Admin</a>`;
            } else {
                footerAdmin.innerHTML = "";
            }
        }
    }

    fetch("/api/me", { cache: "no-store" })
        .then(r => r.ok ? r.json() : { logged_in: false })
        .then(render)
        .catch(() => render({ logged_in: false }));

    // Expose for pages that want to refresh after login state changes
    window.refreshUserNav = function () {
        fetch("/api/me", { cache: "no-store" })
            .then(r => r.ok ? r.json() : { logged_in: false })
            .then(render)
            .catch(() => render({ logged_in: false }));
    };
})();
