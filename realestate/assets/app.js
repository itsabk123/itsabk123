/* Shelter and Sense — progressive enhancement only. Every page works without JS. */
(function () {
  'use strict';
  var nav = document.getElementById('mainnav');
  var tog = document.querySelector('.navtoggle');
  if (nav && tog) {
    tog.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      tog.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Copy buttons: <button data-copy="#id">
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var el = document.querySelector(b.getAttribute('data-copy'));
      if (!el) return;
      el.select && el.select();
      var text = el.value || el.textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () {
        b.textContent = 'Copied';
      }, function () { document.execCommand && document.execCommand('copy'); b.textContent = 'Copied'; });
    });
  });

  // Print buttons
  document.querySelectorAll('[data-print]').forEach(function (b) {
    b.addEventListener('click', function () { window.print(); });
  });

  // Confirm dangerous actions: <form data-confirm="...">
  document.querySelectorAll('form[data-confirm]').forEach(function (f) {
    f.addEventListener('submit', function (ev) {
      if (!window.confirm(f.getAttribute('data-confirm'))) ev.preventDefault();
    });
  });

  // Evaluation form: autosave draft to this browser (never sent anywhere until submitted).
  var form = document.getElementById('evalform');
  if (form) {
    var KEY = 'ss_eval_draft_v3';
    var state = document.getElementById('savestate');
    var fresh = form.getAttribute('data-fresh') === '1';
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved && fresh) {
        Object.keys(saved).forEach(function (name) {
          var el = form.elements.namedItem(name);
          if (el && el.type !== 'hidden' && !el.value) el.value = saved[name];
          else if (el && el.tagName === 'SELECT') el.value = saved[name];
        });
        if (state) state.textContent = 'Restored your unsaved draft from this browser.';
      }
    } catch (e) { /* storage unavailable */ }
    var timer;
    form.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var data = {};
        Array.prototype.forEach.call(form.elements, function (el) {
          if (!el.name || el.type === 'hidden' || el.type === 'submit' || el.name === 'csrf') return;
          if (el.value !== '') data[el.name] = el.value;
        });
        try { localStorage.setItem(KEY, JSON.stringify(data)); if (state) state.textContent = 'Draft saved in this browser.'; } catch (e) {}
      }, 500);
    });
    form.addEventListener('submit', function () { try { localStorage.removeItem(KEY); } catch (e) {} });

    // Conditional sections
    var fin = form.elements.namedItem('financing');
    var mode = form.elements.namedItem('rental_mode');
    var cur = form.elements.namedItem('investor_currency');
    function toggle() {
      var mortgage = fin && fin.value === 'mortgage';
      ['down_payment_pct', 'interest_rate_pct', 'rate_type', 'loan_term_years', 'io_years', 'loan_fees'].forEach(function (k) { show(k, mortgage); });
      var str = mode && mode.value === 'short_term';
      var occ = mode && mode.value === 'owner_occupied';
      ['nightly_rate', 'str_occupancy_pct', 'str_fees_pct'].forEach(function (k) { show(k, str); });
      ['monthly_rent', 'rent_basis', 'vacancy_pct', 'lease_months'].forEach(function (k) { show(k, !occ); });
      var fx = cur && cur.value !== '';
      ['fx_rate', 'fx_source', 'fx_date', 'fx_vol_pct'].forEach(function (k) { show(k, fx); });
    }
    function show(k, on) {
      var el = form.querySelector('.field[data-key="' + k + '"]');
      if (el) el.hidden = !on;
    }
    [fin, mode, cur].forEach(function (el) { el && el.addEventListener('change', toggle); });
    toggle();

    // Country → default currency and area unit
    var country = form.elements.namedItem('country');
    var map = JSON.parse(form.getAttribute('data-countries') || '{}');
    if (country) country.addEventListener('change', function () {
      var c = map[country.value];
      if (!c) return;
      var ccy = form.elements.namedItem('currency');
      var unit = form.elements.namedItem('area_unit');
      if (ccy && !ccy.dataset.touched) ccy.value = c[0];
      if (unit && !unit.dataset.touched) unit.value = c[1];
    });
    ['currency', 'area_unit'].forEach(function (n) {
      var el = form.elements.namedItem(n);
      el && el.addEventListener('change', function () { el.dataset.touched = '1'; });
    });

    // Add comparable rows
    var add = document.getElementById('addcomp');
    if (add) add.addEventListener('click', function () {
      var body = document.querySelector('#comps tbody');
      var rows = body.querySelectorAll('tr');
      if (rows.length >= 25) return;
      var clone = rows[rows.length - 1].cloneNode(true);
      var i = rows.length;
      clone.querySelectorAll('input,select').forEach(function (el) {
        el.name = el.name.replace(/comps\[\d+\]/, 'comps[' + i + ']');
        if (el.tagName === 'INPUT') el.value = '';
      });
      body.appendChild(clone);
    });
  }

  // Embedded widget: report height to the parent page for auto-resize.
  if (document.body.classList.contains('embed') && window.parent !== window) {
    var post = function () { window.parent.postMessage({ ssEmbedHeight: document.documentElement.scrollHeight }, '*'); };
    window.addEventListener('load', post);
    window.addEventListener('resize', post);
    document.addEventListener('input', function () { setTimeout(post, 50); });
  }
})();
