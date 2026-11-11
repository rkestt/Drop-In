/* proto.js — cambio di stato nei prototipi statici.
 *
 * Uso:
 *   <button class="proto-switch" data-show="checkin-success">Successo</button>
 *   <section data-state="checkin-success" hidden>…</section>
 *
 * Un solo stato visibile per gruppo: gli elementi con [data-state] dentro
 * lo stesso [data-state-group] vengono mostrati uno alla volta.
 * Nessuna chiamata di rete, nessun dato finto in produzione: è un file
 * dentro docs/ e non entra nel bundle dell'app.
 */
(function () {
  "use strict";

  function initGroup(group) {
    var states = Array.prototype.slice.call(
      group.querySelectorAll("[data-state]"),
    );
    if (states.length === 0) return;

    var buttons = Array.prototype.slice.call(
      group.querySelectorAll("[data-show]"),
    );

    function show(id) {
      var found = false;
      states.forEach(function (state) {
        var match = state.getAttribute("data-state") === id;
        state.hidden = !match;
        if (match) found = true;
      });
      if (!found) return;

      buttons.forEach(function (button) {
        button.setAttribute(
          "aria-pressed",
          String(button.getAttribute("data-show") === id),
        );
      });

      // Il focus non deve finire su un controllo nascosto.
      var active = document.activeElement;
      if (active && active.closest("[data-state][hidden]")) {
        var first = group.querySelector(
          "[data-state]:not([hidden]) button, [data-state]:not([hidden]) a, [data-state]:not([hidden]) input",
        );
        if (first) first.focus({ preventScroll: true });
      }
    }

    buttons.forEach(function (button) {
      button.setAttribute("type", "button");
      button.addEventListener("click", function () {
        show(button.getAttribute("data-show"));
      });
    });

    var initial =
      group.getAttribute("data-initial") ||
      (states[0] && states[0].getAttribute("data-state"));
    if (initial) show(initial);
  }

  document.querySelectorAll("[data-state-group]").forEach(function (group) {
    initGroup(group);
  });
})();
