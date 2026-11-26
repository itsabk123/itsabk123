/* Shelter and Sense embed loader.
   <div data-ss-widget="rental-yield-calculator" data-theme="auto" data-ref="YOURCODE"></div>
   <script async src="https://YOUR-HOST/realestate/assets/embed.js"></script> */
(function () {
  'use strict';
  var me = document.currentScript || document.querySelector('script[src*="embed.js"]');
  var base = me ? me.src.replace(/assets\/embed\.js.*$/, '') : '';
  document.querySelectorAll('[data-ss-widget]').forEach(function (el) {
    if (el.getAttribute('data-ss-loaded')) return;
    el.setAttribute('data-ss-loaded', '1');
    var q = 't=' + encodeURIComponent(el.getAttribute('data-ss-widget'));
    if (el.getAttribute('data-ref')) q += '&ref=' + encodeURIComponent(el.getAttribute('data-ref'));
    if (el.getAttribute('data-theme')) q += '&theme=' + encodeURIComponent(el.getAttribute('data-theme'));
    var f = document.createElement('iframe');
    f.src = base + 'embed.php?' + q;
    f.title = 'Shelter and Sense calculator';
    f.loading = 'lazy';
    f.style.cssText = 'width:100%;border:0;min-height:420px;display:block';
    el.appendChild(f);
    window.addEventListener('message', function (ev) {
      if (ev.source === f.contentWindow && ev.data && ev.data.ssEmbedHeight) f.style.height = ev.data.ssEmbedHeight + 'px';
    });
  });
})();
