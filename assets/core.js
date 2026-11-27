/* ============================================================================
 * GPN CENTRAL SYSTEM 2026 — Shared Core Engine (API, Auth, Modals, Footer)
 * Strictly Zero Secrets & Zero Public Phone Exposure.
 * ============================================================================ */

(function (global) {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbye5oa2t3zqUPMURBvDcuOXwoexdSKrtz7RMiK9WDVzFwYCWXKmNoHxza4i4i77Sf3g/exec';

  const URLS = {
    WEBSITE: 'https://www.guidedpathnoida.in',
    ABOUT: 'https://www.guidedpathnoida.in/about',
    FEES: 'https://www.guidedpathnoida.in/fees',
    REFUNDS: 'https://www.guidedpathnoida.in/refunds',
    CONTACT: 'https://www.guidedpathnoida.in/contact',
    LOGO: 'https://assets.guidedpathnoida.in/gpn/gpn-logo1.jpg',
    FILES_BASE: 'https://files.guidedpathnoida.in/',
    DOWNLOAD_BASE: 'https://download.guidedpathnoida.in/'
  };

  const SES_TOKEN_KEY = 'gpn_session_token';
  const SES_USER_KEY = 'gpn_session_user';

  /* ---- XSS-Safe Utilities ---- */
  function esc(val) {
    return String(val == null ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatINR(num) {
    const n = Number(num || 0);
    return '₹' + (isNaN(n) ? '0' : n.toLocaleString('en-IN'));
  }

  function statusBadge(status) {
    const s = String(status || '').toUpperCase();
    let cls = 'gpn-badge-info';
    if (['PAID', 'ACTIVE', 'PRESENT', 'PUBLISHED', 'OPEN', 'EVALUATED', 'SENT', 'COMPLETED'].includes(s)) cls = 'gpn-badge-ok';
    else if (['UNPAID', 'PENDING', 'LATE', 'DRAFT', 'IN_PROGRESS', 'PENDING_EVAL'].includes(s)) cls = 'gpn-badge-warn';
    else if (['OVERDUE', 'ABSENT', 'INACTIVE', 'FAILED', 'EXPIRED', 'REVERSED', 'CLOSED'].includes(s)) cls = 'gpn-badge-err';
    return '<span class="gpn-badge ' + cls + '">' + esc(s || '-') + '</span>';
  }

  /* ---- Toast System ---- */
  function getToastWrap() {
    let wrap = document.getElementById('gpnToastWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'gpnToastWrap';
      wrap.className = 'gpn-toast-wrap';
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  function toast(message, type) {
    const wrap = getToastWrap();
    const el = document.createElement('div');
    el.className = 'gpn-toast ' + (type || '');
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => { el.remove(); }, 4000);
  }

  /* ---- Modal System ---- */
  function closeModal(force) {
    const bd = document.getElementById('gpnModalBackdrop');
    if (!bd) return;
    if (bd.dataset.locked === 'true' && !force) return;
    bd.remove();
  }

  function openModal(title, bodyHtml, opts) {
    opts = opts || {};
    closeModal(true);
    const bd = document.createElement('div');
    bd.id = 'gpnModalBackdrop';
    bd.className = 'gpn-modal-backdrop';
    bd.dataset.locked = opts.locked ? 'true' : 'false';

    bd.innerHTML =
      '<div class="gpn-modal" role="dialog" aria-modal="true">' +
        '<div class="gpn-modal-head">' +
          '<h3 class="gpn-card-title">' + esc(title) + '</h3>' +
          (opts.locked ? '' : '<button type="button" class="gpn-btn gpn-btn-outline gpn-btn-sm" id="gpnModalCloseBtn">✕</button>') +
        '</div>' +
        '<div id="gpnModalBody">' + bodyHtml + '</div>' +
      '</div>';

    document.body.appendChild(bd);

    if (!opts.locked) {
      bd.addEventListener('click', (e) => { if (e.target === bd) closeModal(); });
      const btn = document.getElementById('gpnModalCloseBtn');
      if (btn) btn.addEventListener('click', () => closeModal());
    }
    return bd;
  }

  /* ---- Session Storage (Never localStorage) ---- */
  const auth = {
    getToken() { return sessionStorage.getItem(SES_TOKEN_KEY) || ''; },
    getUser() {
      try { return JSON.parse(sessionStorage.getItem(SES_USER_KEY) || 'null'); }
      catch (e) { return null; }
    },
    setSession(token, user) {
      sessionStorage.setItem(SES_TOKEN_KEY, token || '');
      sessionStorage.setItem(SES_USER_KEY, JSON.stringify(user || null));
    },
    clearSession() {
      sessionStorage.removeItem(SES_TOKEN_KEY);
      sessionStorage.removeItem(SES_USER_KEY);
    },
    async logout() {
      try { await api('auth.logout', {}, { silentAuthRedirect: true }); } catch (e) {}
      auth.clearSession();
      window.location.href = './index.html';
    },
    async requireAuth(allowedRoles) {
      const token = auth.getToken();
      if (!token) {
        window.location.href = './index.html';
        return null;
      }
      const res = await api('auth.me', {}, { silentAuthRedirect: true });
      if (!res.ok) {
        auth.clearSession();
        window.location.href = './index.html';
        return null;
      }
      const user = res.data;
      auth.setSession(token, user);

      if (allowedRoles && allowedRoles.length && !allowedRoles.includes(user.role)) {
        toast('Access denied for your account role.', 'err');
        window.location.href = './index.html';
        return null;
      }
      if (user.mustChangePassword) {
        openChangePasswordModal(true);
      }
      return user;
    }
  };

  /* ---- CORS-Safe Apps Script API Client ---- */
  async function api(action, payload, opts) {
    opts = opts || {};
    const body = {
      action: action,
      token: auth.getToken(),
      payload: payload || {}
    };

    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
      });
      const json = await resp.json();

      if (!json.ok) {
        if (json.code === 'UNAUTHORIZED' && !opts.silentAuthRedirect) {
          auth.clearSession();
          toast('Session expired. Please sign in again.', 'warn');
          setTimeout(() => { window.location.href = './index.html'; }, 900);
        } else if (json.code === 'MUST_CHANGE_PASSWORD') {
          openChangePasswordModal(true);
        }
      }
      return json;
    } catch (err) {
      return { ok: false, code: 'NETWORK_ERROR', error: 'Network error. Please check your connection and retry.' };
    }
  }

  /* ---- Forced & Voluntary Change Password Modal ---- */
  function openChangePasswordModal(forced) {
    const note = forced
      ? '<div class="gpn-alert gpn-alert-warn"><strong>First-Login Security Check:</strong> You must set a new permanent password (minimum 8 characters) before accessing the dashboard.</div>'
      : '<p class="gpn-muted">Choose a strong password of at least 8 characters.</p>';

    const html =
      note +
      '<form id="gpnChangePwForm">' +
        '<div class="gpn-field"><label>Current Password</label><input class="gpn-input" type="password" id="gpnCurPw" required autocomplete="current-password"></div>' +
        '<div class="gpn-field gpn-mt"><label>New Password (min 8 chars)</label><input class="gpn-input" type="password" id="gpnNewPw" required minlength="8" autocomplete="new-password"></div>' +
        '<div class="gpn-field gpn-mt"><label>Confirm New Password</label><input class="gpn-input" type="password" id="gpnConfPw" required minlength="8" autocomplete="new-password"></div>' +
        '<div id="gpnPwErr" class="gpn-muted gpn-mt" style="color:var(--gpn-err)"></div>' +
        '<div class="gpn-flex gpn-mt">' +
          '<button type="submit" class="gpn-btn gpn-btn-gold" id="gpnPwSubmitBtn">Update Password</button>' +
          (forced ? '<button type="button" class="gpn-btn gpn-btn-outline" id="gpnPwLogoutBtn">Logout</button>' : '') +
        '</div>' +
      '</form>';

    openModal(forced ? 'Set New Password Required' : 'Change Password', html, { locked: Boolean(forced) });

    const logoutBtn = document.getElementById('gpnPwLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => auth.logout());

    document.getElementById('gpnChangePwForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const cur = document.getElementById('gpnCurPw').value;
      const nw = document.getElementById('gpnNewPw').value;
      const cf = document.getElementById('gpnConfPw').value;
      const errEl = document.getElementById('gpnPwErr');
      errEl.textContent = '';

      if (nw.length < 8) { errEl.textContent = 'New password must be at least 8 characters.'; return; }
      if (nw !== cf) { errEl.textContent = 'New password and confirmation do not match.'; return; }

      const btn = document.getElementById('gpnPwSubmitBtn');
      btn.disabled = true;
      btn.textContent = 'Updating...';

      const res = await api('auth.changePassword', { currentPassword: cur, newPassword: nw });
      btn.disabled = false;
      btn.textContent = 'Update Password';

      if (!res.ok) {
        errEl.textContent = res.error || 'Could not update password.';
        return;
      }

      const u = auth.getUser();
      if (u) { u.mustChangePassword = false; auth.setSession(auth.getToken(), u); }
      closeModal(true);
      toast('Password updated successfully!', 'ok');
      if (forced) window.location.reload();
    });
  }

  /* ---- Global Report Error Modal ---- */
  function openReportErrorModal(pageName, tabName) {
    const html =
      '<p class="gpn-muted">Found a bug or wrong data? Send a quick report directly to Guided Path Noida support.</p>' +
      '<form id="gpnErrRepForm">' +
        '<div class="gpn-field"><label>Page / Section</label><input class="gpn-input" id="gpnErrPage" value="' + esc(pageName || document.title) + ' — ' + esc(tabName || 'General') + '" readonly></div>' +
        '<div class="gpn-field gpn-mt"><label>Describe the issue</label><textarea class="gpn-textarea" id="gpnErrDesc" required minlength="5" placeholder="What happened and what did you tap?"></textarea></div>' +
        '<div class="gpn-mt"><button type="submit" class="gpn-btn gpn-btn-primary" id="gpnErrSendBtn">Submit Error Report</button></div>' +
      '</form>';

    openModal('Report an Error', html);

    document.getElementById('gpnErrRepForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const desc = document.getElementById('gpnErrDesc').value.trim();
      const btn = document.getElementById('gpnErrSendBtn');
      btn.disabled = true;
      btn.textContent = 'Sending...';

      const res = await api('report.error', {
        page: pageName || document.title,
        tab: tabName || 'General',
        description: desc,
        device: navigator.userAgent
      }, { silentAuthRedirect: true });

      btn.disabled = false;
      btn.textContent = 'Submit Error Report';
      if (res.ok) {
        closeModal(true);
        toast('Report ' + (res.data.reportId || '') + ' sent to GPN Support.', 'ok');
      } else {
        toast(res.error || 'Failed to send report.', 'err');
      }
    });
  }

  /* ---- Post-Login ONLY WhatsApp Support Widget (Student / Parent) ---- */
  async function initSupportWidget() {
    if (!auth.getToken()) return;
    const res = await api('auth.supportContacts', {}, { silentAuthRedirect: true });
    if (!res.ok || !res.data || !Array.isArray(res.data.contacts)) return;

    const existing = document.getElementById('gpnWaFab');
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = 'gpnWaFab';
    btn.className = 'gpn-wa-fab gpn-no-print';
    btn.type = 'button';
    btn.textContent = '💬 WhatsApp Support';
    btn.addEventListener('click', () => {
      const items = res.data.contacts.map((c) =>
        '<div class="gpn-card" style="margin-bottom:10px">' +
          '<div><strong>' + esc(c.displayName) + '</strong> (' + esc(c.adminId) + ')</div>' +
          '<div class="gpn-muted" style="margin:4px 0">' + esc(c.email || '') + '</div>' +
          '<div class="gpn-flex gpn-mt">' +
            '<a class="gpn-btn gpn-btn-ok gpn-btn-sm" target="_blank" rel="noopener" href="' + esc(c.whatsappUrl) + '">Chat on WhatsApp</a>' +
            '<a class="gpn-btn gpn-btn-outline gpn-btn-sm" target="_blank" rel="noopener" href="' + esc(c.aboutUrl || URLS.ABOUT) + '">About Profile</a>' +
          '</div>' +
        '</div>'
      ).join('');
      openModal('GPN Support Contacts', items);
    });
    document.body.appendChild(btn);
  }

  /* ---- Dynamic Footer Loader ---- */
  async function initFooter(targetId) {
    const el = document.getElementById(targetId || 'gpnFooter');
    if (!el) return;

    let brand = 'Guided Path Noida';
    let tagline = 'Learn • Practice • Grow | Sector 62, Noida';
    let copyright = '© 2026 Guided Path Noida. All rights reserved.';
    let links = [
      { label: 'Home', url: URLS.WEBSITE },
      { label: 'About Us', url: URLS.ABOUT },
      { label: 'Fees', url: URLS.FEES },
      { label: 'Refund Policy', url: URLS.REFUNDS },
      { label: 'Contact', url: URLS.CONTACT }
    ];
    let socials = [];

    try {
      const res = await api('promos.public.bundle', {}, { silentAuthRedirect: true });
      if (res.ok && res.data && res.data.footer) {
        const fc = res.data.footer;
        if (fc.brandTitle) brand = fc.brandTitle;
        if (fc.tagline) tagline = fc.tagline;
        if (fc.copyright) copyright = fc.copyright;
        if (Array.isArray(fc.links) && fc.links.length) links = fc.links;
        if (Array.isArray(fc.socials)) socials = fc.socials;
      }
    } catch (e) {}

    el.innerHTML =
      '<div style="font-weight:700;color:var(--gpn-gold)">' + esc(brand) + '</div>' +
      '<div class="gpn-muted">' + esc(tagline) + '</div>' +
      '<div class="gpn-footer-links">' +
        links.map((l) => '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + '</a>').join('') +
      '</div>' +
      (socials.length
        ? '<div class="gpn-footer-socials">' +
            socials.map((s) =>
              '<a href="' + esc(s.URL) + '" target="_blank" rel="noopener" title="' + esc(s.Label || s.Platform) + '">' +
                '<img src="' + esc(s.Icon_URL) + '" alt="' + esc(s.Platform) + '" loading="lazy" decoding="async">' +
              '</a>'
            ).join('') +
          '</div>'
        : '') +
      '<div style="font-size:0.78rem;margin-top:6px">' + esc(copyright) + '</div>';
  }

  /* ---- Printable / Save-as-PDF Helper ---- */
  function printHtml(title, bodyHtml) {
    const win = window.open('', '_blank', 'width=840,height=900');
    if (!win) { toast('Please allow popups to print or save as PDF.', 'warn'); return; }
    win.document.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>body{font-family:Segoe UI,Arial,sans-serif;color:#111;padding:24px;max-width:800px;margin:auto}h1,h2,h3{color:#0A192F;margin:0 0 8px}table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}th,td{border:1px solid #cbd5e1;padding:7px 9px;text-align:left}th{background:#0A192F;color:#FFD54F}.hdr{display:flex;align-items:center;gap:12px;border-bottom:2px solid #0A192F;padding-bottom:10px;margin-bottom:14px}.hdr img{width:54px;height:54px;border-radius:50%}.meta{font-size:12px;color:#475569}@media print{.no-print{display:none}}</style>' +
      '</head><body>' +
      '<div class="no-print" style="text-align:right;margin-bottom:12px"><button onclick="window.print()" style="padding:8px 16px;background:#0A192F;color:#FFD54F;border:none;border-radius:6px;cursor:pointer;font-weight:700">Print / Save as PDF</button></div>' +
      bodyHtml +
      '</body></html>'
    );
    win.document.close();
  }

  /* ---- PWA Registration ---- */
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  global.GPN = {
    API_URL,
    URLS,
    api,
    auth,
    ui: {
      esc,
      formatINR,
      statusBadge,
      toast,
      openModal,
      closeModal,
      printHtml,
      empty: (msg) => '<div class="gpn-center gpn-muted">' + esc(msg || 'No records found.') + '</div>',
      loading: (msg) => '<div class="gpn-center gpn-muted">' + esc(msg || 'Loading...') + '</div>'
    },
    openChangePasswordModal,
    openReportErrorModal,
    initSupportWidget,
    initFooter,
    registerSW
  };
})(window);
