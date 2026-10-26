/* ============================================================
   Invoice Generator
   Vanilla JS. No dependencies. Everything stays in the browser.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- currency ---------------- */

  var CURRENCIES = {
    INR: { symbol: '\u20B9', locale: 'en-IN', major: 'Rupees', minor: 'Paise', indian: true },
    USD: { symbol: '$', locale: 'en-US', major: 'Dollars', minor: 'Cents', indian: false },
    EUR: { symbol: '\u20AC', locale: 'en-US', major: 'Euros', minor: 'Cents', indian: false },
    GBP: { symbol: '\u00A3', locale: 'en-US', major: 'Pounds', minor: 'Pence', indian: false },
    AED: { symbol: 'AED ', locale: 'en-US', major: 'Dirhams', minor: 'Fils', indian: false },
    SGD: { symbol: 'S$', locale: 'en-US', major: 'Singapore Dollars', minor: 'Cents', indian: false },
    AUD: { symbol: 'A$', locale: 'en-US', major: 'Australian Dollars', minor: 'Cents', indian: false },
    CAD: { symbol: 'C$', locale: 'en-US', major: 'Canadian Dollars', minor: 'Cents', indian: false }
  };

  /* ---------------- helpers ---------------- */

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v == null) return 0;
    var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  function cur(code) { return CURRENCIES[code] || CURRENCIES.INR; }

  function money(amount, code) {
    var c = cur(code);
    var nf = new Intl.NumberFormat(c.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    var v = nf.format(Math.abs(round2(amount)));
    return (amount < 0 ? '-' : '') + c.symbol + v;
  }

  function isoToday() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function addDays(iso, days) {
    var d = iso ? new Date(iso + 'T00:00:00') : new Date();
    if (isNaN(d.getTime())) d = new Date();
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function prettyDate(iso) {
    if (!iso) return '\u2014';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return esc(iso);
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  /* ---------------- number to words ---------------- */

  var ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  var TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function two(n) {
    return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  }

  function three(n) {
    var h = Math.floor(n / 100), r = n % 100, out = '';
    if (h) out += ONES[h] + ' Hundred' + (r ? ' and ' : '');
    if (r) out += two(r);
    return out;
  }

  function wordsIndian(n) {
    if (n === 0) return 'Zero';
    var parts = [];
    var cr = Math.floor(n / 10000000); n %= 10000000;
    var lk = Math.floor(n / 100000); n %= 100000;
    var th = Math.floor(n / 1000); n %= 1000;
    var hd = Math.floor(n / 100); n %= 100;
    if (cr) parts.push(wordsIndian(cr) + ' Crore');
    if (lk) parts.push(two(lk) + ' Lakh');
    if (th) parts.push(two(th) + ' Thousand');
    if (hd) parts.push(ONES[hd] + ' Hundred');
    if (n) parts.push(two(n));
    return parts.join(' ');
  }

  function wordsIntl(n) {
    if (n === 0) return 'Zero';
    var units = [[1000000000, 'Billion'], [1000000, 'Million'], [1000, 'Thousand']];
    var parts = [];
    for (var i = 0; i < units.length; i++) {
      var v = units[i][0], name = units[i][1];
      if (n >= v) { parts.push(wordsIntl(Math.floor(n / v)) + ' ' + name); n %= v; }
    }
    if (n) parts.push(parts.length && n < 100 ? 'and ' + three(n) : three(n));
    return parts.join(' ');
  }

  function amountInWords(amount, code) {
    var c = cur(code);
    var total = round2(Math.abs(amount));
    var whole = Math.floor(total);
    var frac = Math.round((total - whole) * 100);
    if (frac === 100) { whole += 1; frac = 0; }
    var s = (c.indian ? wordsIndian(whole) : wordsIntl(whole)) + ' ' + c.major;
    if (frac) s += ' and ' + two(frac) + ' ' + c.minor;
    return s + ' only';
  }

  /* ---------------- state ---------------- */

  var STORAGE_KEY = 'invoice-generator-v1';
  var COUNTER_KEY = 'invoice-generator-counter';

  /* The invoice number is a required field on every invoice, so the app keeps a
     local counter to save you typing it. It is only bumped when you actually
     start a new invoice — never as a side effect of loading the page. */

  function formatInvoiceNumber(year, n) {
    return 'INV-' + year + '-' + String(n).padStart(3, '0');
  }

  function readCounter() {
    var year = new Date().getFullYear();
    var n = 0;
    try {
      var raw = localStorage.getItem(COUNTER_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.year === year) n = parsed.n || 0;
      }
    } catch (e) { /* private mode — start from zero */ }
    return { year: year, n: n };
  }

  function issueInvoiceNumber() {
    var c = readCounter();
    var n = c.n + 1;
    try { localStorage.setItem(COUNTER_KEY, JSON.stringify({ year: c.year, n: n })); } catch (e) { /* ignore */ }
    return formatInvoiceNumber(c.year, n);
  }

  function peekInvoiceNumber() {
    var c = readCounter();
    return formatInvoiceNumber(c.year, c.n + 1);
  }

  function blankState() {
    var today = isoToday();
    return {
      business: { name: '', address: '', email: '', phone: '', taxid: '', logo: '' },
      client: { name: '', address: '', email: '', phone: '', taxid: '' },
      meta: {
        number: '',
        currency: 'INR',
        date: today,
        due: addDays(today, 15),
        taxmode: 'cgst_sgst',
        paid: '',
        status: 'auto',
        bank: '',
        notes: 'Thank you for your business!',
        terms: 'Payment due within 15 days of the invoice date.'
      },
      discount: { type: 'percent', value: '' },
      items: [{ desc: '', qty: '1', rate: '', tax: '18' }]
    };
  }

  var state = blankState();
  var hadSavedState = false;

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore quota */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return;
      hadSavedState = true;
      state = {
        business: Object.assign(blankState().business, s.business || {}),
        client: Object.assign(blankState().client, s.client || {}),
        meta: Object.assign(blankState().meta, s.meta || {}),
        discount: Object.assign({ type: 'percent', value: '' }, s.discount || {}),
        items: Array.isArray(s.items) && s.items.length
          ? s.items.map(function (it) {
              return { desc: it.desc || '', qty: it.qty == null ? '1' : String(it.qty), rate: it.rate == null ? '' : String(it.rate), tax: it.tax == null ? '' : String(it.tax) };
            })
          : blankState().items
      };
    } catch (e) { /* corrupt storage — keep defaults */ }
  }

  /* ---------------- totals ---------------- */

  function computeTotals() {
    var rows = [];
    var subtotal = 0;

    state.items.forEach(function (it, i) {
      var qty = num(it.qty);
      var rate = num(it.rate);
      var taxRate = num(it.tax);
      var base = round2(qty * rate);
      subtotal += base;
      rows.push({ idx: i + 1, desc: it.desc, qty: qty, rate: rate, taxRate: taxRate, base: base, taxable: 0, taxAmt: 0 });
    });

    subtotal = round2(subtotal);

    var discRaw = num(state.discount.value);
    var discount = state.discount.type === 'percent'
      ? round2(subtotal * Math.min(discRaw, 100) / 100)
      : round2(discRaw);
    if (discount < 0) discount = 0;
    if (discount > subtotal) discount = subtotal;

    var factor = subtotal > 0 ? (subtotal - discount) / subtotal : 0;
    var taxTotal = 0;
    var taxableTotal = 0;

    rows.forEach(function (r) {
      r.taxable = round2(r.base * factor);
      r.taxAmt = round2(r.taxable * r.taxRate / 100);
      taxTotal += r.taxAmt;
      taxableTotal += r.taxable;
    });

    taxTotal = round2(taxTotal);
    taxableTotal = round2(taxableTotal);

    var total = round2(subtotal - discount + taxTotal);
    var paid = round2(num(state.meta.paid));
    if (paid > total) paid = total;
    var balance = round2(total - paid);

    return {
      rows: rows,
      subtotal: subtotal,
      discount: discount,
      taxableTotal: taxableTotal,
      taxTotal: taxTotal,
      total: total,
      paid: paid,
      balance: balance,
      hasTax: taxTotal > 0.004 || state.meta.taxmode !== 'none'
    };
  }

  function statusOf(t) {
    var mode = state.meta.status;
    if (mode === 'paid' || mode === 'partial' || mode === 'unpaid') {
      return { key: mode, label: mode === 'paid' ? 'Paid' : mode === 'partial' ? 'Partially paid' : 'Unpaid' };
    }
    if (t.total <= 0) return { key: 'unpaid', label: 'Draft' };
    if (t.balance <= 0.004) return { key: 'paid', label: 'Paid' };
    var overdue = state.meta.due && state.meta.due < isoToday();
    if (overdue) return { key: 'unpaid', label: 'Overdue' };
    if (t.paid > 0) return { key: 'partial', label: 'Partially paid' };
    return { key: 'unpaid', label: 'Unpaid' };
  }

  /* ---------------- sheet rendering ---------------- */

  function renderSheet() {
    var t = computeTotals();
    var code = state.meta.currency;
    var b = state.business, c = state.client, m = state.meta;
    var st = statusOf(t);

    var brandLines = [];
    if (b.address) brandLines.push(esc(b.address));
    var contact = [];
    if (b.email) contact.push(esc(b.email));
    if (b.phone) contact.push(esc(b.phone));
    if (contact.length) brandLines.push(contact.join(' <span class="sep">\u00B7</span> '));

    var logo = b.logo
      ? '<img class="inv-logo" src="' + esc(b.logo) + '" alt="">'
      : '';

    var html = '';

    /* ---- header ---- */
    html += '<div class="inv-top">';
    html += '<div class="inv-brand">' + logo + '<div>';
    html += '<div class="inv-brand-name">' + (esc(b.name) || 'Your business name') + '</div>';
    html += brandLines.length ? '<div class="inv-brand-lines">' + brandLines.join('<br>') + '</div>' : '';
    if (b.taxid) html += '<div class="inv-brand-lines">GSTIN: ' + esc(b.taxid) + '</div>';
    html += '</div></div>';

    html += '<div class="inv-title">';
    html += '<h1>INVOICE</h1>';
    html += '<div class="inv-meta"><table>';
    html += '<tr><td>Invoice no.</td><td><strong>' + (esc(m.number) || '\u2014') + '</strong></td></tr>';
    html += '<tr><td>Date</td><td>' + prettyDate(m.date) + '</td></tr>';
    html += '<tr><td>Due</td><td>' + prettyDate(m.due) + '</td></tr>';
    html += '</table></div>';
    html += '<span class="status-pill status-' + st.key + '">' + esc(st.label) + '</span>';
    html += '</div></div>';

    /* ---- parties ---- */
    html += '<div class="inv-parties">';
    html += '<div class="inv-party"><div class="party-label">Billed by</div>';
    html += '<div class="party-name">' + (esc(b.name) || '\u2014') + '</div>';
    if (b.address) html += '<div class="party-lines">' + esc(b.address) + '</div>';
    var bMeta = [];
    if (b.email) bMeta.push(esc(b.email));
    if (b.phone) bMeta.push(esc(b.phone));
    if (bMeta.length) html += '<div class="party-meta">' + bMeta.join(' \u00B7 ') + '</div>';
    html += '</div>';

    html += '<div class="inv-party"><div class="party-label">Billed to</div>';
    html += '<div class="party-name">' + (esc(c.name) || 'Client name') + '</div>';
    if (c.address) html += '<div class="party-lines">' + esc(c.address) + '</div>';
    var cMeta = [];
    if (c.email) cMeta.push(esc(c.email));
    if (c.phone) cMeta.push(esc(c.phone));
    if (cMeta.length) html += '<div class="party-meta">' + cMeta.join(' \u00B7 ') + '</div>';
    if (c.taxid) html += '<div class="party-meta"><span class="k">GSTIN:</span> ' + esc(c.taxid) + '</div>';
    html += '</div></div>';

    /* ---- items ---- */
    var showTaxCol = t.hasTax;
    html += '<table class="inv-table"><thead><tr>';
    html += '<th class="idx">#</th><th>Description</th><th class="r">Qty</th><th class="r">Rate</th>';
    if (showTaxCol) html += '<th class="r">Tax</th>';
    html += '<th class="r">Amount</th></tr></thead><tbody>';

    var filled = t.rows.filter(function (r) { return r.desc || r.base; });
    if (!filled.length) {
      html += '<tr><td class="idx">1</td><td class="desc" colspan="' + (showTaxCol ? 5 : 4) +
        '" style="color:#a4abbb">Add your first line item on the left \u2190</td></tr>';
    } else {
      filled.forEach(function (r, i) {
        html += '<tr>';
        html += '<td class="idx">' + (i + 1) + '</td>';
        html += '<td class="desc">' + (esc(r.desc) || '<span style="color:#a4abbb">Item</span>') + '</td>';
        html += '<td class="r">' + (r.qty % 1 === 0 ? r.qty : r.qty.toFixed(2)) + '</td>';
        html += '<td class="r">' + money(r.rate, code) + '</td>';
        if (showTaxCol) {
          html += '<td class="r">' + (r.taxRate ? r.taxRate + '%' : '\u2014') + '</td>';
        }
        html += '<td class="r">' + money(r.base, code) + '</td>';
        html += '</tr>';
      });
    }
    html += '</tbody></table>';

    /* ---- totals ---- */
    html += '<div class="inv-bottom">';

    html += '<div class="inv-words"><div class="party-label">Amount in words</div>';
    html += '<p>' + (t.total > 0 ? esc(amountInWords(t.total, code)) : '\u2014') + '</p>';
    html += '</div>';

    html += '<div class="inv-totals"><table>';
    html += '<tr><td>Subtotal</td><td>' + money(t.subtotal, code) + '</td></tr>';
    if (t.discount > 0) {
      var dlabel = state.discount.type === 'percent'
        ? 'Discount (' + num(state.discount.value) + '%)'
        : 'Discount';
      html += '<tr class="neg"><td>' + esc(dlabel) + '</td><td>\u2212' + money(t.discount, code) + '</td></tr>';
      html += '<tr><td>Taxable value</td><td>' + money(t.taxableTotal, code) + '</td></tr>';
    }
    if (m.taxmode === 'cgst_sgst' && t.taxTotal > 0) {
      html += '<tr><td>CGST</td><td>' + money(t.taxTotal / 2, code) + '</td></tr>';
      html += '<tr><td>SGST</td><td>' + money(t.taxTotal / 2, code) + '</td></tr>';
    } else if (m.taxmode === 'igst' && t.taxTotal > 0) {
      html += '<tr><td>IGST</td><td>' + money(t.taxTotal, code) + '</td></tr>';
    } else if (t.taxTotal > 0) {
      html += '<tr><td>Tax</td><td>' + money(t.taxTotal, code) + '</td></tr>';
    }
    html += '<tr class="grand"><td>Total</td><td>' + money(t.total, code) + '</td></tr>';
    if (t.paid > 0) {
      html += '<tr><td>Amount paid</td><td>\u2212' + money(t.paid, code) + '</td></tr>';
      html += '<tr class="bal' + (t.balance <= 0.004 ? ' is-clear' : '') + '"><td>Balance due</td><td>' + money(t.balance, code) + '</td></tr>';
    }
    html += '</table></div></div>';

    /* ---- footer ---- */
    var blocks = [];
    if (m.bank) blocks.push('<div class="block"><div class="party-label">Payment details</div><p>' + esc(m.bank) + '</p></div>');
    if (m.notes) blocks.push('<div class="block"><div class="party-label">Notes</div><p>' + esc(m.notes) + '</p></div>');
    if (m.terms) blocks.push('<div class="block"><div class="party-label">Terms</div><p>' + esc(m.terms) + '</p></div>');

    html += '<div class="inv-footer">' + blocks.join('') + '</div>';
    html += '<div class="inv-sign">For ' + (esc(b.name) || 'your business') + '</div>';
    html += '<div class="inv-credit">Made with the free Invoice Generator \u00B7 no sign-up, nothing uploaded</div>';

    $('#sheet').innerHTML = html;
    fitSheet();
  }

  /* ---------------- preview scaling ---------------- */

  function fitSheet() {
    var sheet = $('#sheet');
    var inner = $('#preview-inner');
    if (!sheet || !inner) return;

    sheet.style.transform = 'none';
    inner.style.height = 'auto';

    var avail = inner.clientWidth;
    var w = sheet.offsetWidth || 794;
    if (!avail) return;

    var scale = Math.min(1, avail / w);
    if (scale < 0.999) {
      sheet.style.transform = 'scale(' + scale + ')';
      inner.style.height = (sheet.offsetHeight * scale) + 'px';
    }
  }

  /* ---------------- editor rendering ---------------- */

  function renderItemsEditor() {
    var wrap = $('#items-editor');
    var html = '';
    state.items.forEach(function (it, i) {
      html += '<div class="item-row" data-i="' + i + '">';
      html += '<input class="desc-cell" type="text" data-item="desc" value="' + esc(it.desc) + '" placeholder="Service or product" aria-label="Description">';
      html += '<input class="num" type="text" inputmode="decimal" data-item="qty" value="' + esc(it.qty) + '" placeholder="1" aria-label="Quantity">';
      html += '<input class="num" type="text" inputmode="decimal" data-item="rate" value="' + esc(it.rate) + '" placeholder="0.00" aria-label="Rate">';
      html += '<input class="num" type="text" inputmode="decimal" data-item="tax" value="' + esc(it.tax) + '" placeholder="0" aria-label="Tax percent">';
      html += '<button type="button" class="row-del" data-del="' + i + '" aria-label="Remove item">&times;</button>';
      html += '</div>';
    });
    wrap.innerHTML = html;
  }

  function renderLogo() {
    var box = $('#logo-preview');
    box.innerHTML = state.business.logo
      ? '<img src="' + esc(state.business.logo) + '" alt="Logo">'
      : '<span>Logo</span>';
  }

  function fillForm() {
    document.querySelectorAll('[data-bind]').forEach(function (el) {
      var path = el.getAttribute('data-bind').split('.');
      var val = state;
      for (var i = 0; i < path.length; i++) val = val ? val[path[i]] : '';
      el.value = val == null ? '' : val;
    });
    renderItemsEditor();
    renderLogo();
  }

  function setPath(path, value) {
    var parts = path.split('.');
    var obj = state;
    for (var i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts[parts.length - 1]] = value;
  }

  function refresh() {
    renderSheet();
    save();
  }

  /* ---------------- events ---------------- */

  document.addEventListener('input', function (e) {
    var el = e.target;

    if (el.hasAttribute && el.hasAttribute('data-bind')) {
      setPath(el.getAttribute('data-bind'), el.value);
      refresh();
      return;
    }

    if (el.hasAttribute && el.hasAttribute('data-item')) {
      var row = el.closest('.item-row');
      if (!row) return;
      var i = parseInt(row.getAttribute('data-i'), 10);
      if (!state.items[i]) return;
      state.items[i][el.getAttribute('data-item')] = el.value;
      refresh();
    }
  });

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.hasAttribute && el.hasAttribute('data-bind')) {
      setPath(el.getAttribute('data-bind'), el.value);
      refresh();
    }
  });

  document.addEventListener('click', function (e) {
    var del = e.target.closest ? e.target.closest('[data-del]') : null;
    if (del) {
      var i = parseInt(del.getAttribute('data-del'), 10);
      state.items.splice(i, 1);
      if (!state.items.length) state.items.push({ desc: '', qty: '1', rate: '', tax: '' });
      renderItemsEditor();
      refresh();
    }
  });

  $('#btn-add-item').addEventListener('click', function () {
    var lastTax = state.items.length ? state.items[state.items.length - 1].tax : '';
    state.items.push({ desc: '', qty: '1', rate: '', tax: lastTax || '' });
    renderItemsEditor();
    refresh();
    var rows = document.querySelectorAll('.item-row');
    var last = rows[rows.length - 1];
    if (last) last.querySelector('[data-item="desc"]').focus();
  });

  $('#btn-print').addEventListener('click', function () {
    renderSheet();
    window.print();
  });

  $('#btn-reset').addEventListener('click', function () {
    if (!confirm('Start a new invoice? The current one will be replaced (your saved copy in this browser is overwritten).')) return;
    var logo = state.business.logo;
    var biz = state.business;
    var fresh = blankState();
    // keep the business profile, it rarely changes
    fresh.business = biz;
    fresh.business.logo = logo;
    fresh.meta.number = issueInvoiceNumber();
    state = fresh;
    fillForm();
    refresh();
  });

  $('#btn-sample').addEventListener('click', function () {
    var today = isoToday();
    var logo = state.business.logo;
    state = {
      business: {
        name: 'Advay Design Studio',
        address: '2nd Floor, 14 Lavelle Road\nBengaluru, Karnataka 560001',
        email: 'hello@advaystudio.in',
        phone: '+91 98765 43210',
        taxid: '29ABCDE1234F1Z5',
        logo: logo
      },
      client: {
        name: 'Nimbus Technologies Pvt Ltd',
        address: '5th Floor, Tower B, Prestige Tech Park\nWhitefield, Bengaluru 560066',
        email: 'accounts@nimbustech.io',
        phone: '+91 80 4123 5566',
        taxid: '29AACCN1234B1Z9'
      },
      meta: {
        number: state.meta.number || peekInvoiceNumber(),
        currency: 'INR',
        date: today,
        due: addDays(today, 15),
        taxmode: 'cgst_sgst',
        paid: '20000',
        status: 'auto',
        bank: 'HDFC Bank \u00B7 A/c 50100XXXXXXX \u00B7 IFSC HDFC0000123\nUPI: advaystudio@okhdfcbank',
        notes: 'Thank you for your business!',
        terms: 'Payment due within 15 days. Late payments attract 1.5% interest per month.'
      },
      discount: { type: 'percent', value: '5' },
      items: [
        { desc: 'Brand identity design \u2014 logo, type system, colour palette', qty: '1', rate: '45000', tax: '18' },
        { desc: 'Landing page design (responsive, 6 sections)', qty: '2', rate: '18000', tax: '18' },
        { desc: 'Design handoff & developer support', qty: '4', rate: '2500', tax: '18' }
      ]
    };
    fillForm();
    refresh();
  });

  /* logo upload — downscale to keep localStorage small */

  $('#logo-input').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { alert('Please choose an image file.'); return; }
    var reader = new FileReader();
    reader.onload = function (ev) {
      var img = new Image();
      img.onload = function () {
        var max = 400;
        var w = img.width, h = img.height;
        var ratio = Math.min(1, max / Math.max(w, h));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(w * ratio);
        canvas.height = Math.round(h * ratio);
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var isPng = /png|svg/.test(file.type);
        try {
          state.business.logo = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.92);
        } catch (err) {
          state.business.logo = ev.target.result;
        }
        renderLogo();
        refresh();
      };
      img.onerror = function () { alert('That image could not be read. Try a PNG or JPG.'); };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  $('#logo-remove').addEventListener('click', function () {
    state.business.logo = '';
    renderLogo();
    refresh();
  });

  /* ---------------- boot ---------------- */

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitSheet, 120);
  });

  window.addEventListener('beforeprint', renderSheet);

  load();
  // A brand-new visitor gets the next number from the counter; a returning one
  // keeps whatever number was saved with their draft.
  if (!state.meta.number) state.meta.number = hadSavedState ? peekInvoiceNumber() : issueInvoiceNumber();
  fillForm();
  renderSheet();
  window.addEventListener('load', fitSheet);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitSheet).catch(function () {});
  }
})();
