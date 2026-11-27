/* ============================================================================
 * GPN CENTRAL SYSTEM 2026 — DOJ Fee Ledger (No Partial Payments) & Automation
 * ============================================================================ */

(function () {
  'use strict';

  const { esc, formatINR, statusBadge, toast, openModal, closeModal, printHtml, loading, empty } = GPN.ui;

  async function render(container, user) {
    const isSuper = user && user.role === 'SUPER_ADMIN';
    let activeTab = 'ledger';

    container.innerHTML =
      '<div class="gpn-subtabs">' +
        '<button type="button" class="gpn-subtab active" data-tab="ledger">Fee Cycles & Payments</button>' +
        '<button type="button" class="gpn-subtab" data-tab="auto">Automation & Kill-Switch</button>' +
      '</div>' +
      '<div id="feeContent">' + loading('Loading...') + '</div>';

    const contentEl = container.querySelector('#feeContent');

    container.querySelectorAll('.gpn-subtab').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        container.querySelectorAll('.gpn-subtab').forEach((b) => b.classList.toggle('active', b === btn));
        loadTab();
      });
    });

    function loadTab() {
      if (activeTab === 'ledger') return renderLedger(contentEl);
      if (activeTab === 'auto') return renderAutomation(contentEl, isSuper);
    }

    loadTab();
  }

  /* ---- 1. FEE LEDGER ---- */
  function renderLedger(el) {
    el.innerHTML =
      '<div class="gpn-card">' +
        '<div class="gpn-card-header">' +
          '<h3 class="gpn-card-title">DOJ-Anchored Fee Ledger (Full-Fee Only)</h3>' +
          '<div class="gpn-flex">' +
            '<button type="button" class="gpn-btn gpn-btn-outline gpn-btn-sm" id="btnPrintFeeSum">🖨 Print Summary</button>' +
            '<button type="button" class="gpn-btn gpn-btn-gold gpn-btn-sm" id="btnSyncCycles">↻ Sync DOJ Cycles</button>' +
          '</div>' +
        '</div>' +
        '<div class="gpn-toolbar">' +
          '<input class="gpn-input" id="fFeeSearch" placeholder="Search student, ID, cycle..." style="max-width:240px">' +
          '<select class="gpn-select" id="fFeeStatus" style="max-width:140px"><option value="UNPAID">UNPAID</option><option value="OVERDUE">OVERDUE</option><option value="PAID">PAID</option><option value="ALL">ALL</option></select>' +
          '<select class="gpn-select" id="fFeeTeacher" style="max-width:130px"><option value="ALL">All Teachers</option><option value="T001">T001</option><option value="T002">T002</option></select>' +
          '<button type="button" class="gpn-btn gpn-btn-primary gpn-btn-sm" id="btnFeeLoad">Filter</button>' +
        '</div>' +
        '<div id="feeTableWrap">' + loading('Loading fee cycles...') + '</div>' +
      '</div>';

    async function fetchCycles() {
      const wrap = el.querySelector('#feeTableWrap');
      wrap.innerHTML = loading('Fetching fee cycles...');
      const res = await GPN.api('fees.cycles.list', {
        search: el.querySelector('#fFeeSearch').value.trim(),
        status: el.querySelector('#fFeeStatus').value,
        teacherId: el.querySelector('#fFeeTeacher').value
      });
      if (!res.ok) { wrap.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(res.error) + '</div>'; return; }
      const list = (res.data && res.data.cycles) || [];
      if (!list.length) { wrap.innerHTML = empty('No fee cycles match your filter.'); return; }

      wrap.innerHTML =
        '<div class="gpn-muted" style="margin-bottom:8px">Showing ' + list.length + ' cycle(s)</div>' +
        '<div class="gpn-scroll-frame">' +
          '<table class="gpn-table"><thead><tr>' +
            '<th>Cycle</th><th>Student</th><th>Period & Due</th><th>Fee</th><th>Status</th><th>Action</th>' +
          '</tr></thead><tbody>' +
            list.map((c) => {
              const paid = String(c.Payment_Status).toUpperCase() === 'PAID';
              return (
                '<tr>' +
                  '<td><strong>' + esc(c.Cycle_ID) + '</strong><div class="gpn-muted">' + esc(c.Cycle_Label) + '</div></td>' +
                  '<td><strong>' + esc(c.Student_Name) + '</strong><div class="gpn-muted">' + esc(c.Student_ID) + ' • ' + esc(c.Teacher_ID) + '</div></td>' +
                  '<td><div>' + esc(c.Cycle_Start) + ' → ' + esc(c.Cycle_End) + '</div><div class="gpn-muted">Due: ' + esc(c.Due_Date) + (c.Days_Overdue > 0 ? ' • <strong style="color:var(--gpn-err)">' + c.Days_Overdue + 'd late</strong>' : '') + '</div></td>' +
                  '<td><strong>' + formatINR(c.Cycle_Fee) + '</strong>' + (paid ? '<div class="gpn-muted">' + esc(c.Payment_Method) + ' • ' + esc(c.Paid_At) + '</div>' : '') + '</td>' +
                  '<td>' + statusBadge(c.Bucket) + '</td>' +
                  '<td><div class="gpn-flex">' +
                    (!paid
                      ? '<button type="button" class="gpn-btn gpn-btn-ok gpn-btn-sm btnMarkPaid" data-id="' + esc(c.Cycle_ID) + '" data-fee="' + esc(c.Cycle_Fee) + '" data-name="' + esc(c.Student_Name) + '" data-label="' + esc(c.Cycle_Label) + '">Mark Paid</button>'
                      : '<button type="button" class="gpn-btn gpn-btn-outline gpn-btn-sm btnReceipt" data-rcp="' + esc(c.Receipt_No) + '">Receipt</button>' +
                        '<button type="button" class="gpn-btn gpn-btn-danger gpn-btn-sm btnRevPay" data-id="' + esc(c.Cycle_ID) + '">Reverse</button>') +
                  '</div></td>' +
                '</tr>'
              );
            }).join('') +
          '</tbody></table>' +
        '</div>';

      wrap.querySelectorAll('.btnMarkPaid').forEach((b) => {
        b.addEventListener('click', () => openPayModal(b.dataset.id, Number(b.dataset.fee), b.dataset.name, b.dataset.label, fetchCycles));
      });

      wrap.querySelectorAll('.btnReceipt').forEach((b) => {
        b.addEventListener('click', () => printReceipt(b.dataset.rcp));
      });

      wrap.querySelectorAll('.btnRevPay').forEach((b) => {
        b.addEventListener('click', async () => {
          if (!confirm('Reverse payment for ' + b.dataset.id + ' and void its receipt?')) return;
          const r = await GPN.api('fees.cycles.toggle', { cycleId: b.dataset.id, mode: 'REVERSE' });
          if (r.ok) { toast('Payment reversed.', 'warn'); fetchCycles(); }
          else toast(r.error, 'err');
        });
      });
    }

    el.querySelector('#btnFeeLoad').addEventListener('click', fetchCycles);
    el.querySelector('#fFeeSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchCycles(); });

    el.querySelector('#btnSyncCycles').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = 'Syncing...';
      const r = await GPN.api('fees.cycles.sync');
      btn.disabled = false;
      btn.textContent = '↻ Sync DOJ Cycles';
      if (r.ok) { toast('Checked ' + r.data.studentsChecked + ' students • Created ' + r.data.cyclesCreated + ' cycle(s).', 'ok'); fetchCycles(); }
      else toast(r.error, 'err');
    });

    el.querySelector('#btnPrintFeeSum').addEventListener('click', async () => {
      const r = await GPN.api('reports.feeSummary', { teacherId: el.querySelector('#fFeeTeacher').value });
      if (!r.ok) { toast(r.error, 'err'); return; }
      const d = r.data;
      const rows = (d.cycles || []).map((c) =>
        '<tr><td>' + esc(c.Student_ID) + '</td><td>' + esc(c.Student_Name) + '</td><td>' + esc(c.Cycle_Label) + '</td><td>' + esc(c.Due_Date) + '</td><td>' + formatINR(c.Cycle_Fee) + '</td><td>' + esc(c.Payment_Status) + '</td><td>' + esc(c.Receipt_No || '-') + '</td></tr>'
      ).join('');
      printHtml('GPN Fee Summary',
        '<div class="hdr"><img src="' + esc(GPN.URLS.LOGO) + '"><div><h2>Guided Path Noida — Fee Summary Report</h2><div class="meta">Session: ' + esc(d.session) + ' • Generated: ' + esc(d.generatedAt) + '</div></div></div>' +
        '<table><tr><th>Paid Total</th><td>' + formatINR(d.totals.paidSum) + ' (' + d.totals.paidCount + ' cycles)</td><th>Pending Total</th><td>' + formatINR(d.totals.unpaidSum) + ' (' + d.totals.unpaidCount + ' cycles)</td></tr></table>' +
        '<table><thead><tr><th>ID</th><th>Student</th><th>Cycle</th><th>Due</th><th>Fee</th><th>Status</th><th>Receipt</th></tr></thead><tbody>' + rows + '</tbody></table>'
      );
    });

    fetchCycles();
  }

  function openPayModal(cycleId, fullFee, studentName, label, onDone) {
    openModal('Mark Full Fee Paid — ' + cycleId,
      '<div class="gpn-alert"><strong>Strict No Partial Payment Rule:</strong> Only full cycle fee (' + formatINR(fullFee) + ') is accepted.</div>' +
      '<p><strong>' + esc(studentName) + '</strong> — ' + esc(label) + '</p>' +
      '<form id="frmPay">' +
        '<div class="gpn-form-row">' +
          '<div class="gpn-field"><label>Full Amount (₹)</label><input class="gpn-input" value="' + esc(fullFee) + '" readonly></div>' +
          '<div class="gpn-field"><label>Method</label><select class="gpn-select" id="payMeth"><option value="UPI">UPI</option><option value="CASH">CASH</option><option value="BANK">BANK</option></select></div>' +
        '</div>' +
        '<div class="gpn-field"><label>Transaction Reference (optional)</label><input class="gpn-input" id="payRef" placeholder="UPI UTR / Cash note"></div>' +
        '<button type="submit" class="gpn-btn gpn-btn-ok gpn-mt">Confirm Paid & Issue Receipt</button>' +
      '</form>'
    );

    document.getElementById('frmPay').addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await GPN.api('fees.cycles.toggle', {
        cycleId,
        mode: 'MARK_PAID',
        amount: fullFee,
        method: document.getElementById('payMeth').value,
        reference: document.getElementById('payRef').value.trim()
      });
      if (r.ok) {
        closeModal(true);
        toast('Paid! Receipt ' + r.data.Receipt_No + ' issued.', 'ok');
        onDone();
      } else toast(r.error, 'err');
    });
  }

  async function printReceipt(receiptNo) {
    const r = await GPN.api('reports.feeReceipt', { receiptNo });
    if (!r.ok) { toast(r.error, 'err'); return; }
    const d = r.data;
    const rc = d.receipt;
    const st = d.student;
    printHtml('Fee Receipt ' + rc.Receipt_No,
      '<div class="hdr"><img src="' + esc(d.brand.logo) + '"><div><h2>' + esc(d.brand.name) + ' — Fee Receipt</h2><div class="meta">' + esc(d.brand.address) + ' • ' + esc(d.brand.website) + '</div></div></div>' +
      '<table>' +
        '<tr><th>Receipt No</th><td><strong>' + esc(rc.Receipt_No) + '</strong></td><th>Paid At</th><td>' + esc(rc.Paid_At) + '</td></tr>' +
        '<tr><th>Student</th><td>' + esc(st.Student_Name) + ' (' + esc(st.Student_ID) + ')</td><th>Class / Batch</th><td>' + esc(st.Class) + ' / ' + esc(st.Batch_Name || '-') + '</td></tr>' +
        '<tr><th>Parent</th><td>' + esc(st.Father_Name || '-') + ' (' + esc(st.Phone || '') + ')</td><th>Fee Cycle</th><td>' + esc(rc.Cycle_Label) + '</td></tr>' +
        '<tr><th>Amount Paid</th><td><strong>' + formatINR(rc.Amount) + '</strong></td><th>Method / Ref</th><td>' + esc(rc.Method) + ' ' + esc(rc.Reference || '') + '</td></tr>' +
      '</table>' +
      '<p class="meta">Computer-generated receipt. Refund Policy: ' + esc(d.brand.refundsUrl) + '</p>'
    );
  }

  /* ---- 2. AUTOMATION & KILL-SWITCH ---- */
  async function renderAutomation(el, isSuper) {
    el.innerHTML = loading('Loading automation dashboard...');
    const res = await GPN.api('auto.dashboard');
    if (!res.ok) { el.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(res.error) + '</div>'; return; }
    const d = res.data || {};

    el.innerHTML =
      '<div class="gpn-card">' +
        '<div class="gpn-card-header">' +
          '<div><h3 class="gpn-card-title">Master Automation Kill-Switch</h3><div class="gpn-muted">Admin Digest Recipient: ' + esc(d.adminEmailTo) + '</div></div>' +
          '<div class="gpn-flex">' +
            statusBadge(d.launchEnabled ? 'ACTIVE' : 'INACTIVE') +
            (isSuper
              ? '<button type="button" class="gpn-btn ' + (d.launchEnabled ? 'gpn-btn-danger' : 'gpn-btn-ok') + ' gpn-btn-sm" id="btnToggleKill">' + (d.launchEnabled ? 'Turn OFF Automation' : 'Turn ON Live Automation') + '</button>'
              : '<span class="gpn-muted">Super Admin (T001) only</span>') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="gpn-card">' +
        '<h3 class="gpn-card-title">WhatsApp Reminder Log (Latest 80)</h3>' +
        '<div class="gpn-scroll-frame compact gpn-mt">' +
          '<table class="gpn-table"><thead><tr><th>Sent At</th><th>Student / Cycle</th><th>Day / Template</th><th>Recipient</th><th>Status</th></tr></thead><tbody>' +
            ((d.messageLogs || []).length
              ? d.messageLogs.map((m) => '<tr><td>' + esc(m.Sent_At) + '</td><td>' + esc(m.Student_ID) + ' / ' + esc(m.Cycle_ID) + '</td><td>Day ' + esc(m.Reminder_Day) + ' (' + esc(m.Template_Name) + ')</td><td>' + esc(m.Recipient) + '</td><td>' + statusBadge(m.Delivery_Status || m.API_Status) + '</td></tr>').join('')
              : '<tr><td colspan="5">' + empty('No WhatsApp logs yet (waiting for n8n Phase 3).') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>' +
      '<div class="gpn-grid gpn-grid-2">' +
        '<div class="gpn-card">' +
          '<h3 class="gpn-card-title">Admin Email Digests</h3>' +
          '<div class="gpn-scroll-frame compact gpn-mt">' +
            '<table class="gpn-table"><thead><tr><th>Sent At</th><th>Day</th><th>Overdue</th><th>Status</th></tr></thead><tbody>' +
              ((d.emailLogs || []).length
                ? d.emailLogs.map((em) => '<tr><td>' + esc(em.Sent_At) + '</td><td>Day ' + esc(em.Reminder_Day) + '</td><td>' + esc(em.Overdue_Count) + '</td><td>' + statusBadge(em.Status) + '</td></tr>').join('')
                : '<tr><td colspan="4">' + empty('No email logs yet.') + '</td></tr>') +
            '</tbody></table>' +
          '</div>' +
        '</div>' +
        '<div class="gpn-card">' +
          '<h3 class="gpn-card-title">Sync & Webhook Logs</h3>' +
          '<div class="gpn-scroll-frame compact gpn-mt">' +
            '<table class="gpn-table"><thead><tr><th>Time</th><th>Actor / Source</th><th>Details</th></tr></thead><tbody>' +
              ((d.syncLogs || []).length
                ? d.syncLogs.map((sy) => '<tr><td>' + esc(sy.Run_At) + '</td><td>' + esc(sy.Actor) + '</td><td>Checked: ' + esc(sy.Students_Checked) + ', Created: ' + esc(sy.Cycles_Created) + '</td></tr>').join('')
                : '<tr><td colspan="3">' + empty('No sync runs logged yet.') + '</td></tr>') +
            '</tbody></table>' +
          '</div>' +
        '</div>' +
      '</div>';

    if (isSuper) {
      el.querySelector('#btnToggleKill').addEventListener('click', async () => {
        const next = !d.launchEnabled;
        if (!confirm((next ? 'ENABLE' : 'DISABLE') + ' live n8n WhatsApp & Email automation?')) return;
        const r = await GPN.api('auto.killSwitch', { enabled: next });
        if (r.ok) { toast('Automation is now ' + (next ? 'ON' : 'OFF'), next ? 'ok' : 'warn'); renderAutomation(el, true); }
        else toast(r.error, 'err');
      });
    }
  }

  window.GPN_MODULES = window.GPN_MODULES || {};
  window.GPN_MODULES['admin-fees'] = { render };
})();
