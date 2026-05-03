// BookingTours Partner Widget Loader
//
// Usage:
//   <div id="bookingtours-widget" data-tenant="aonyx"></div>
//   <script src="https://booking.bookingtours.co.za/widget.js" async></script>
//
// Options:
//   data-tenant       required — operator subdomain slug
//   data-tour         optional — preselect a tour by ID
//   data-bg           optional — background colour (CSS value, default transparent)
//   data-min-height   optional — initial iframe height in px (default 600)
//   data-host         optional — override iframe origin

(function () {
  function init() {
    var nodes = document.querySelectorAll('[id="bookingtours-widget"], .bookingtours-widget');
    if (!nodes.length) {
      console.warn("[bookingtours] widget container not found");
      return;
    }

    nodes.forEach(function (node) {
      if (node.querySelector("iframe")) return;

      var tenant = node.getAttribute("data-tenant");
      if (!tenant) {
        console.warn("[bookingtours] missing data-tenant on widget container");
        return;
      }

      var tour = node.getAttribute("data-tour") || "";
      var bg = node.getAttribute("data-bg") || "transparent";
      var minHeight = parseInt(node.getAttribute("data-min-height") || "600", 10);
      var hostOverride = node.getAttribute("data-host") || "";

      var scriptEl = document.currentScript || document.querySelector('script[src*="widget.js"]');
      var scriptOrigin = scriptEl && scriptEl.src ? new URL(scriptEl.src).origin : "https://booking.bookingtours.co.za";

      var iframeOrigin;
      if (hostOverride) {
        iframeOrigin = hostOverride;
      } else {
        var u = new URL(scriptOrigin);
        if (!u.hostname.startsWith(tenant + ".")) {
          u.hostname = tenant + "." + u.hostname;
        }
        iframeOrigin = u.origin;
      }

      var qs = "source=widget";
      if (tour) qs += "&tour=" + encodeURIComponent(tour);
      if (bg !== "transparent") qs += "&bg=" + encodeURIComponent(bg);

      var iframe = document.createElement("iframe");
      iframe.src = iframeOrigin + "/embed?" + qs;
      iframe.style.width = "100%";
      iframe.style.border = "0";
      iframe.style.minHeight = minHeight + "px";
      iframe.style.display = "block";
      iframe.style.background = bg;
      iframe.style.colorScheme = "normal";
      iframe.title = "Book your tour";
      iframe.allow = "payment *";

      node.innerHTML = "";
      node.appendChild(iframe);

      window.addEventListener("message", function (ev) {
        if (!ev.data || typeof ev.data !== "object") return;
        if (ev.data.type === "bt:resize" && typeof ev.data.height === "number") {
          if (ev.source === iframe.contentWindow) {
            iframe.style.height = ev.data.height + "px";
          }
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
