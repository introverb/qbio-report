// QUBIE Report — light / dark theme toggle.
//
// Reads the saved preference from localStorage and applies a
// data-theme="light|dark" attribute to <html>. The inline boot
// script (THEME_BOOT, included at the top of each page's <head>)
// applies the theme before any CSS paint to avoid a flash.
//
// This file then renders the toggle button into #theme-toggle-slot,
// wires click handling, and updates the icon to match the current
// theme.

(function () {
    const KEY = "qbio-theme";

    function getTheme() {
        return document.documentElement.getAttribute("data-theme") || "dark";
    }
    function setTheme(t) {
        document.documentElement.setAttribute("data-theme", t);
        try { localStorage.setItem(KEY, t); } catch (_) {}
        const btn = document.getElementById("theme-toggle-btn");
        if (btn) btn.innerHTML = iconFor(t);
        if (btn) btn.setAttribute("aria-label", t === "light" ? "Switch to dark mode" : "Switch to light mode");
        if (btn) btn.setAttribute("title", t === "light" ? "Switch to dark mode" : "Switch to light mode");
    }

    function iconFor(theme) {
        // sun icon shown when in dark mode (click → goes light)
        // moon icon shown when in light mode (click → goes dark)
        if (theme === "light") {
            return '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">'
                 + '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" '
                 + 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>';
        }
        return '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">'
             + '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/>'
             + '<g stroke="currentColor" stroke-width="1.8" stroke-linecap="round">'
             + '<line x1="12" y1="2" x2="12" y2="5"/>'
             + '<line x1="12" y1="19" x2="12" y2="22"/>'
             + '<line x1="2" y1="12" x2="5" y2="12"/>'
             + '<line x1="19" y1="12" x2="22" y2="12"/>'
             + '<line x1="4.93" y1="4.93" x2="6.99" y2="6.99"/>'
             + '<line x1="17.01" y1="17.01" x2="19.07" y2="19.07"/>'
             + '<line x1="4.93" y1="19.07" x2="6.99" y2="17.01"/>'
             + '<line x1="17.01" y1="6.99" x2="19.07" y2="4.93"/>'
             + '</g></svg>';
    }

    function inject() {
        if (document.getElementById("qbio-theme-styles")) return;
        const s = document.createElement("style");
        s.id = "qbio-theme-styles";
        s.textContent = `
            #theme-toggle-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 28px;
                height: 28px;
                margin: 0 8px 0 0;
                padding: 0;
                background: transparent;
                border: 1px solid var(--border, rgba(238,232,223,0.18));
                border-radius: 999px;
                color: var(--text-soft, rgba(238,232,223,0.55));
                cursor: pointer;
                transition: color 0.15s, border-color 0.15s, background 0.15s;
            }
            #theme-toggle-btn:hover {
                color: var(--text-strong, #FFFCF6);
                border-color: var(--text-soft, rgba(238,232,223,0.55));
            }
            #theme-toggle-btn svg { display: block; }
        `;
        document.head.appendChild(s);
    }

    function render() {
        inject();
        const slot = document.getElementById("theme-toggle-slot");
        if (!slot) return;
        const btn = document.createElement("button");
        btn.id = "theme-toggle-btn";
        btn.type = "button";
        slot.appendChild(btn);
        setTheme(getTheme());          // populates icon + a11y attrs
        btn.addEventListener("click", () => {
            setTheme(getTheme() === "light" ? "dark" : "light");
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", render);
    } else {
        render();
    }
})();
