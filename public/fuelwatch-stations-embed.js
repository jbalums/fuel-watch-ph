(function () {
  var script = document.currentScript;

  if (!script) {
    return;
  }

  var scriptUrl = new URL(script.src, window.location.href);
  var baseUrl = script.getAttribute("data-base-url") || scriptUrl.origin;
  var provinceCode = script.getAttribute("data-province-code") || "";
  var cityMunicipalityCode =
    script.getAttribute("data-city-municipality-code") || "";
  var page = script.getAttribute("data-page") || "";
  var height = script.getAttribute("data-height") || "720";
  var targetId = script.getAttribute("data-target-id");

  var iframeUrl = new URL("/embed/stations", baseUrl);
  if (provinceCode) {
    iframeUrl.searchParams.set("provinceCode", provinceCode);
  }
  if (cityMunicipalityCode) {
    iframeUrl.searchParams.set("cityMunicipalityCode", cityMunicipalityCode);
  }
  if (page && String(page) !== "1") {
    iframeUrl.searchParams.set("page", String(page));
  }

  var iframe = document.createElement("iframe");
  iframe.src = iframeUrl.toString();
  iframe.title = "FuelWatch PH stations";
  iframe.loading = "lazy";
  iframe.allow = "geolocation";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.style.width = "100%";
  iframe.style.maxWidth = "100%";
  iframe.style.height = /^\d+$/.test(height) ? height + "px" : height;
  iframe.style.border = "0";
  iframe.style.display = "block";
  iframe.style.background = "transparent";
  iframe.style.overflow = "hidden";

  var mountTarget =
    (targetId && document.getElementById(targetId)) || script.parentNode;

  if (targetId && mountTarget) {
    mountTarget.innerHTML = "";
    mountTarget.appendChild(iframe);
    return;
  }

  if (script.parentNode) {
    script.parentNode.insertBefore(iframe, script.nextSibling);
    return;
  }

  document.body.appendChild(iframe);
})();
