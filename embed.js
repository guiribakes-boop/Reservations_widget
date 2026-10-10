// Osadzenie widgetu na stronie restauracji:
// <div id="reservas"></div>
// <script src="https://ADRES-WIDGETU/embed.js" data-restaurant="el-atun-demo" data-lang="es"></script>
(function () {
  var s = document.currentScript;
  var base = new URL(s.src).origin;
  var params = new URLSearchParams({ r: s.dataset.restaurant || "el-atun-demo", embed: "1" });
  if (s.dataset.lang) params.set("lang", s.dataset.lang);
  if (s.dataset.source) params.set("source", s.dataset.source);

  var f = document.createElement("iframe");
  f.src = base + "/?" + params;
  f.title = "Reservas";
  f.loading = "lazy";
  f.allow = "payment";
  f.style.cssText = "width:100%;max-width:560px;border:0;display:block;margin:0 auto;height:640px;transition:height .15s";
  var target = document.getElementById(s.dataset.target || "reservas");
  (target || s.parentNode).insertBefore(f, target ? null : s);

  window.addEventListener("message", function (e) {
    if (e.origin !== base || !e.data || e.source !== f.contentWindow) return;
    if (e.data.type === "reservas:height") f.style.height = Math.max(400, e.data.height) + "px";
  });
})();
