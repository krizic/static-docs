export const GALLERY_JS_FILENAME = "evidence-gallery.js";

/**
 * Client runtime for evidence gallery pages. Plain script (no modules) so it
 * works when opened from file:// as well. Contract: see render.ts for the
 * data-ev-* attributes this script drives.
 */
export const GALLERY_JS = `(function () {
  "use strict";

  function currentId() {
    return decodeURIComponent(location.hash.replace(/^#/, ""));
  }

  function modalFor(id) {
    if (!id) return null;
    return document.querySelector('.ev-modal[data-ev-id="' + CSS.escape(id) + '"]');
  }

  function syncFromHash() {
    var id = currentId();
    var anyOpen = false;
    document.querySelectorAll(".ev-modal").forEach(function (m) {
      var open = m.getAttribute("data-ev-id") === id;
      m.toggleAttribute("hidden", !open);
      if (open) anyOpen = true;
    });
    document.body.classList.toggle("ev-locked", anyOpen);
  }

  function closeModals() {
    document.querySelectorAll(".ev-modal").forEach(function (m) {
      m.setAttribute("hidden", "");
    });
    document.body.classList.remove("ev-locked");
    if (location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  function switchBrowser(tab) {
    var modal = tab.closest(".ev-modal");
    if (!modal) return;
    modal.querySelectorAll(".ev-tab").forEach(function (t) {
      t.classList.toggle("is-active", t === tab);
    });
    var shot = modal.querySelector(".ev-modal-shot");
    if (!shot) return;
    var img = shot.querySelector("img");
    var file = tab.getAttribute("data-ev-browser");
    var missing = tab.getAttribute("data-ev-missing") === "1";
    if (img) {
      if (missing) {
        shot.innerHTML = '<div class="ev-missing">Screenshot missing: ' + file + "</div>";
      } else {
        img.setAttribute("src", file);
      }
    } else if (!missing) {
      shot.innerHTML = "<img src=\\"" + file + "\\" alt=\\"\\">";
    }
  }

  function applyFilter(btn) {
    var value = btn.getAttribute("data-ev-filter");
    document.querySelectorAll(".ev-filter").forEach(function (b) {
      b.classList.toggle("is-active", b === btn);
    });
    document.querySelectorAll(".ev-card").forEach(function (card) {
      var status = card.getAttribute("data-status");
      card.toggleAttribute("hidden", value !== "all" && status !== value);
    });
  }

  function copyPermalink(btn) {
    var id = btn.getAttribute("data-ev-copy");
    var url = location.origin + location.pathname + "#" + encodeURIComponent(id);
    var done = function () {
      var prev = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(function () { btn.textContent = prev; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, done);
    } else {
      done();
    }
  }

  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!(t instanceof Element)) return;
    var opener = t.closest("[data-ev-open]");
    if (opener) {
      location.hash = encodeURIComponent(opener.getAttribute("data-ev-open"));
      return;
    }
    if (t.closest("[data-ev-close]")) { closeModals(); return; }
    var tab = t.closest(".ev-tab");
    if (tab) { switchBrowser(tab); return; }
    var filter = t.closest(".ev-filter");
    if (filter) { applyFilter(filter); return; }
    var copy = t.closest("[data-ev-copy]");
    if (copy) { copyPermalink(copy); }
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") closeModals();
  });

  window.addEventListener("hashchange", syncFromHash);
  syncFromHash();
})();
`;
