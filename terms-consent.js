/* Mandatory Terms & Conditions checkbox for every payment form.
   Injects the checkbox above each form's submit button and blocks submission
   (before the form's own handler / Razorpay opens) until it is ticked. */
(function () {
  var FORM_IDS = ['mmForm', 'kmForm', 'hmForm', 'ptForm', 'dpForm', 'registrationForm'];

  var css = document.createElement('style');
  css.textContent =
    '.tc-consent{display:flex;flex-direction:column;gap:5px;margin:2px 0 0;text-align:left}' +
    '.tc-consent label{display:flex;align-items:flex-start;gap:10px;font-size:12.5px;line-height:1.5;color:rgba(255,255,255,.7);cursor:pointer;text-transform:none;letter-spacing:0;font-weight:400}' +
    '.tc-consent input{flex:0 0 auto;width:18px;height:18px;margin:1px 0 0;padding:0;accent-color:#ff6b6b;cursor:pointer}' +
    '.tc-consent a{color:#f7d794;text-decoration:underline}' +
    '.tc-consent .tc-err{display:none;font-size:11.5px;color:#ff5252}' +
    '.tc-consent.tc-invalid .tc-err{display:block}';
  document.head.appendChild(css);

  function ensure(form) {
    if (form.querySelector('.tc-consent')) return true;
    var btn = form.querySelector('button[type="submit"]');
    if (!btn) return false;
    var row = document.createElement('div');
    row.className = 'tc-consent';
    row.innerHTML =
      '<label><input type="checkbox" name="terms" required>' +
      '<span>I agree to the <a href="/terms.html" target="_blank" rel="noopener">Terms &amp; Conditions</a>, including the no-refund policy and the injury-liability terms.</span></label>' +
      '<span class="tc-err">Please accept the Terms &amp; Conditions to continue.</span>';
    row.querySelector('input').addEventListener('change', function () {
      row.classList.remove('tc-invalid');
    });
    btn.parentNode.insertBefore(row, btn);
    return true;
  }

  function scan() {
    FORM_IDS.forEach(function (id) {
      var f = document.getElementById(id);
      if (f) ensure(f);
    });
  }

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || FORM_IDS.indexOf(form.id) === -1) return;
    ensure(form);
    var row = form.querySelector('.tc-consent');
    var box = row && row.querySelector('input');
    if (box && box.checked) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (row) row.classList.add('tc-invalid');
    if (box) box.focus();
  }, true);

  scan();
  document.addEventListener('DOMContentLoaded', scan);
  window.addEventListener('load', scan);
  var obs = new MutationObserver(scan);
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(function () { obs.disconnect(); }, 15000);
})();
