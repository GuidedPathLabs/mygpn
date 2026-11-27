/* ============================================================================
 * GPN CENTRAL SYSTEM 2026 — Admin Overview, Settings, Error Reports & Maintenance
 * ============================================================================ */

(function () {
  'use strict';

  const { esc, formatINR, statusBadge, toast, openModal, closeModal, loading, empty } = GPN.ui;

  async function render(container, user) {
    const isSuper = user && user.role === 'SUPER_ADMIN';
    let activeTab = 'kpi';

    container.innerHTML =
      '<div class="gpn-subtabs">' +
        '<button type="button" class="gpn-subtab active" data-tab="kpi">Executive Overview</button>' +
        '<button type="button" class="gpn-subtab" data-tab="settings">Settings & Modules</button>' +
        '<button type="button" class="gpn-subtab" data-tab="errors">Error Reports & Activity</button>' +
        (isSuper ? '<button type="button" class="gpn-subtab" data-tab="maint">Maintenance (T001)</button>' : '') +
      '</div>' +
      '<div id="ovContent">' + loading('Loading overview...') + '</div>';

    const contentEl = container.querySelector('#ovContent');

    container.querySelectorAll('.gpn-subtab').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        container.querySelectorAll('.gpn-subtab').forEach((b) => b.classList.toggle('active', b === btn));
        loadTab();
      });
    });

    async function loadTab() {
      contentEl.innerHTML = loading('Fetching data...');
      if (activeTab === 'kpi') return renderKPIs(contentEl);
      if (activeTab === 'settings') return renderSettings(contentEl, isSuper);
      if (activeTab === 'errors') return renderErrorsAndLogs(contentEl);
      if (activeTab === 'maint' && isSuper) return renderMaintenance(contentEl);
    }

    loadTab();
  }

  async function renderKPIs(el) {
    const res = await GPN.api('master.overview');
    if (!res.ok) {
      el.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(res.error) + '</div>';
      return;
    }
    const d = res.data || {};
    const fees = d.fees || {};
    const byT = d.byTeacher || {};

    el.innerHTML =
      '<div class="gpn-alert ' + (d.launchEnabled ? '' : 'gpn-alert-warn') + '">' +
        '<strong>Session ' + esc(d.session || '2026-27') + '</strong> • Automation Kill-Switch: ' +
        statusBadge(d.launchEnabled ? 'ACTIVE' : 'DRAFT') +
        (d.launchEnabled ? ' (Live reminders enabled)' : ' (Safe dry-run mode — no automated WhatsApp/Emails sent)') +
      '</div>' +
      '<div class="gpn-grid gpn-grid-4">' +
        kpiCard('Active Students', d.activeStudents || 0, 'Total: ' + (d.totalStudents || 0) + ' • Inactive: ' + (d.inactiveStudents || 0)) +
        kpiCard('Offline / Online', (d.offlineActive || 0) + ' / ' + (d.onlineActive || 0), 'T001: ' + (byT.T001 || 0) + ' • T002: ' + (byT.T002 || 0)) +
        kpiCard('Fees Collected', formatINR(fees.paidTotal), 'Pending: ' + formatINR(fees.pendingTotal)) +
        kpiCard('Overdue Cycles', fees.overdueCycles || 0, 'Open Error Reports: ' + (d.openErrors || 0)) +
      '</div>' +
      '<div class="gpn-card gpn-mt">' +
        '<div class="gpn-card-header">' +
          '<h3 class="gpn-card-title">System Health & Permanent Directory</h3>' +
          '<button type="button" class="gpn-btn gpn-btn-outline gpn-btn-sm" id="btnOvRefresh">↻ Refresh</button>' +
        '</div>' +
        '<div class="gpn-grid gpn-grid-3">' +
          '<div class="gpn-kpi"><div class="gpn-kpi-label">Permanent Contact Directory</div><div class="gpn-kpi-value">' + esc(d.contactsCount || 0) + '</div><div class="gpn-kpi-sub">Forever-protected records</div></div>' +
          '<div class="gpn-kpi"><div class="gpn-kpi-label">Super Admin (T001)</div><div class="gpn-kpi-value">' + esc(byT.T001 || 0) + '</div><div class="gpn-kpi-sub"><a href="https://www.guidedpathnoida.in/about" target="_blank" rel="noopener">Dr. Abhishek Tripathi</a></div></div>' +
          '<div class="gpn-kpi"><div class="gpn-kpi-label">Academic Head (T002)</div><div class="gpn-kpi-value">' + esc(byT.T002 || 0) + '</div><div class="gpn-kpi-sub"><a href="https://www.guidedpathnoida.in/about" target="_blank" rel="noopener">Mrs. Rishu Tripathi</a></div></div>' +
        '</div>' +
      '</div>';

    el.querySelector('#btnOvRefresh').addEventListener('click', () => renderKPIs(el));
  }

  function kpiCard(label, value, sub) {
    return (
      '<div class="gpn-kpi">' +
        '<div class="gpn-kpi-label">' + esc(label) + '</div>' +
        '<div class="gpn-kpi-value">' + esc(value) + '</div>' +
        '<div class="gpn-kpi-sub">' + esc(sub) + '</div>' +
      '</div>'
    );
  }

  async function renderSettings(el, isSuper) {
    const [setRes, modRes] = await Promise.all([
      GPN.api('master.settings.get'),
      GPN.api('master.modules.list')
    ]);
    if (!setRes.ok) {
      el.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(setRes.error) + '</div>';
      return;
    }

    const settings = (setRes.data && setRes.data.settings) || [];
    const modules = (modRes.ok && modRes.data && modRes.data.modules) || [];

    el.innerHTML =
      '<div class="gpn-card">' +
        '<div class="gpn-card-header"><h3 class="gpn-card-title">Global System Settings</h3>' +
          (isSuper ? '<button type="button" class="gpn-btn gpn-btn-gold gpn-btn-sm" id="btnAddSetting">+ Add / Update Key</button>' : '<span class="gpn-muted">Read-only (T001 edits)</span>') +
        '</div>' +
        '<div class="gpn-scroll-frame compact">' +
          '<table class="gpn-table"><thead><tr><th>Key</th><th>Value</th><th>Updated</th>' + (isSuper ? '<th>Action</th>' : '') + '</tr></thead><tbody>' +
            (settings.length
              ? settings.map((s) =>
                  '<tr>' +
                    '<td><strong>' + esc(s.Key) + '</strong></td>' +
                    '<td>' + esc(s.Value) + '</td>' +
                    '<td class="gpn-muted">' + esc(s.Updated_At || '') + '</td>' +
                    (isSuper ? '<td><button type="button" class="gpn-btn gpn-btn-outline gpn-btn-sm btnEditSet" data-key="' + esc(s.Key) + '" data-val="' + esc(s.Value) + '">Edit</button></td>' : '') +
                  '</tr>'
                ).join('')
              : '<tr><td colspan="4">' + empty('No settings found.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>' +
      '<div class="gpn-card">' +
        '<div class="gpn-card-header"><h3 class="gpn-card-title">Modules Registry (Feature Toggles)</h3></div>' +
        '<div class="gpn-scroll-frame compact">' +
          '<table class="gpn-table"><thead><tr><th>Module Key</th><th>Name</th><th>Status</th>' + (isSuper ? '<th>Toggle</th>' : '') + '</tr></thead><tbody>' +
            (modules.length
              ? modules.map((m) => {
                  const on = String(m.Enabled).toUpperCase() === 'TRUE';
                  return (
                    '<tr>' +
                      '<td><code>' + esc(m.Module_Key) + '</code></td>' +
                      '<td>' + esc(m.Display_Name || m.Module_Key) + '</td>' +
                      '<td>' + statusBadge(on ? 'ACTIVE' : 'INACTIVE') + '</td>' +
                      (isSuper ? '<td><button type="button" class="gpn-btn gpn-btn-sm ' + (on ? 'gpn-btn-outline' : 'gpn-btn-ok') + ' btnToggleMod" data-key="' + esc(m.Module_Key) + '" data-next="' + (!on) + '">' + (on ? 'Disable' : 'Enable') + '</button></td>' : '') +
                    '</tr>'
                  );
                }).join('')
              : '<tr><td colspan="4">' + empty('No modules listed.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>';

    if (isSuper) {
      const openSetModal = (k, v) => {
        openModal('Update Setting',
          '<form id="frmSetUpd">' +
            '<div class="gpn-field"><label>Key</label><input class="gpn-input" id="inpSetK" value="' + esc(k || '') + '" ' + (k ? 'readonly' : 'required') + '></div>' +
            '<div class="gpn-field gpn-mt"><label>Value</label><input class="gpn-input" id="inpSetV" value="' + esc(v || '') + '" required></div>' +
            '<button type="submit" class="gpn-btn gpn-btn-gold gpn-mt">Save Setting</button>' +
          '</form>'
        );
        document.getElementById('frmSetUpd').addEventListener('submit', async (e) => {
          e.preventDefault();
          const r = await GPN.api('master.settings.update', {
            key: document.getElementById('inpSetK').value.trim(),
            value: document.getElementById('inpSetV').value.trim()
          });
          if (r.ok) { closeModal(true); toast('Setting saved.', 'ok'); renderSettings(el, true); }
          else toast(r.error, 'err');
        });
      };

      const addBtn = el.querySelector('#btnAddSetting');
      if (addBtn) addBtn.addEventListener('click', () => openSetModal('', ''));
      el.querySelectorAll('.btnEditSet').forEach((b) => b.addEventListener('click', () => openSetModal(b.dataset.key, b.dataset.val)));
      el.querySelectorAll('.btnToggleMod').forEach((b) => {
        b.addEventListener('click', async () => {
          b.disabled = true;
          const r = await GPN.api('master.modules.toggle', { moduleKey: b.dataset.key, enabled: b.dataset.next === 'true' });
          if (r.ok) { toast('Module updated.', 'ok'); renderSettings(el, true); }
          else { toast(r.error, 'err'); b.disabled = false; }
        });
      });
    }
  }

  async function renderErrorsAndLogs(el) {
    const res = await GPN.api('master.settings.get');
    if (!res.ok) {
      el.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(res.error) + '</div>';
      return;
    }
    const errs = (res.data && res.data.errorReports) || [];
    const acts = (res.data && res.data.recentActivity) || [];

    el.innerHTML =
      '<div class="gpn-card">' +
        '<div class="gpn-card-header"><h3 class="gpn-card-title">Recent Error Reports (Latest 50)</h3></div>' +
        '<div class="gpn-scroll-frame compact">' +
          '<table class="gpn-table"><thead><tr><th>ID</th><th>Time</th><th>User</th><th>Page / Tab</th><th>Description</th><th>Status</th></tr></thead><tbody>' +
            (errs.length
              ? errs.map((r) =>
                  '<tr>' +
                    '<td>' + esc(r.Report_ID) + '</td>' +
                    '<td>' + esc(r.Reported_At) + '</td>' +
                    '<td>' + esc(r.User_ID) + ' (' + esc(r.User_Role) + ')</td>' +
                    '<td>' + esc(r.Page) + ' / ' + esc(r.Tab_Module) + '</td>' +
                    '<td>' + esc(r.Description) + '</td>' +
                    '<td>' + statusBadge(r.Status) + '</td>' +
                  '</tr>'
                ).join('')
              : '<tr><td colspan="6">' + empty('No error reports logged.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>' +
      '<div class="gpn-card">' +
        '<div class="gpn-card-header"><h3 class="gpn-card-title">Audit Activity Log (Latest 60)</h3></div>' +
        '<div class="gpn-scroll-frame compact">' +
          '<table class="gpn-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead><tbody>' +
            (acts.length
              ? acts.map((a) =>
                  '<tr>' +
                    '<td>' + esc(a.Timestamp) + '</td>' +
                    '<td>' + esc(a.Actor_ID) + '</td>' +
                    '<td><span class="gpn-badge gpn-badge-gold">' + esc(a.Action) + '</span></td>' +
                    '<td>' + esc(a.Details) + '</td>' +
                  '</tr>'
                ).join('')
              : '<tr><td colspan="4">' + empty('No activity logged yet.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>';
  }

  function renderMaintenance(el) {
    el.innerHTML =
      '<div class="gpn-grid gpn-grid-2">' +
        '<div class="gpn-card">' +
          '<h3 class="gpn-card-title">On-Demand Google Drive Backup</h3>' +
          '<p class="gpn-muted">Creates an immediate JSON snapshot of all 8 spreadsheets inside <strong>GPN-Central-2026-Backups</strong> (weekly automatic Sunday 02:00 IST backup runs independently).</p>' +
          '<button type="button" class="gpn-btn gpn-btn-primary" id="btnBackupNow">💾 Run Backup Now</button>' +
          '<div id="backupStatus" class="gpn-muted gpn-mt"></div>' +
        '</div>' +
        '<div class="gpn-card">' +
          '<h3 class="gpn-card-title">Annual Session Rollover</h3>' +
          '<p class="gpn-muted">Runs a full backup first, updates active session dates, and optionally promotes active students (Nursery → Class 11) by one class.</p>' +
          '<form id="frmRollover">' +
            '<div class="gpn-form-row">' +
              '<div class="gpn-field"><label>New Session Label</label><input class="gpn-input" id="rolLabel" placeholder="2027-28" required></div>' +
              '<div class="gpn-field"><label>Start Date</label><input class="gpn-input" type="date" id="rolStart" required></div>' +
              '<div class="gpn-field"><label>End Date</label><input class="gpn-input" type="date" id="rolEnd" required></div>' +
            '</div>' +
            '<label class="gpn-flex" style="margin-bottom:10px"><input type="checkbox" id="rolPromote"> Promote active students to next class</label>' +
            '<button type="submit" class="gpn-btn gpn-btn-gold">Execute Session Rollover</button>' +
          '</form>' +
        '</div>' +
      '</div>' +
      '<div class="gpn-card" style="border-color:rgba(239,68,68,0.5)">' +
        '<h3 class="gpn-card-title" style="color:var(--gpn-err)">⚠ Verified Hard Delete Cascade (Operational Sheets Only)</h3>' +
        '<p class="gpn-muted">Archives a JSON snapshot to Drive, marks the student as <strong>ARCHIVED</strong> inside the permanent Contact Directory (never deleted), and clears their rows from operational sheets to keep sheets fast.</p>' +
        '<div class="gpn-toolbar">' +
          '<input class="gpn-input" id="hdStudentId" placeholder="Student ID (e.g. ST001)" style="max-width:220px">' +
          '<button type="button" class="gpn-btn gpn-btn-danger" id="btnHdPreview">Preview Impact</button>' +
        '</div>' +
        '<div id="hdPreviewBox"></div>' +
      '</div>';

    el.querySelector('#btnBackupNow').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = 'Backing up all 8 sheets...';
      const r = await GPN.api('maintenance.backupNow');
      btn.disabled = false;
      btn.textContent = '💾 Run Backup Now';
      if (r.ok) {
        toast('Backup completed!', 'ok');
        el.querySelector('#backupStatus').textContent = 'Last manual backup: ' + r.data.backedUpAt;
      } else toast(r.error, 'err');
    });

    el.querySelector('#frmRollover').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!confirm('Confirm Annual Session Rollover? A full Drive backup will run automatically first.')) return;
      const r = await GPN.api('maintenance.rollover', {
        newSessionLabel: el.querySelector('#rolLabel').value.trim(),
        newSessionStart: el.querySelector('#rolStart').value,
        newSessionEnd: el.querySelector('#rolEnd').value,
        promoteClasses: el.querySelector('#rolPromote').checked
      });
      if (r.ok) toast('Rolled over to ' + r.data.sessionLabel + ' (Promoted: ' + r.data.promotedStudents + ')', 'ok');
      else toast(r.error, 'err');
    });

    el.querySelector('#btnHdPreview').addEventListener('click', async () => {
      const sid = el.querySelector('#hdStudentId').value.trim().toUpperCase();
      if (!sid) { toast('Enter a Student ID first.', 'warn'); return; }
      const box = el.querySelector('#hdPreviewBox');
      box.innerHTML = loading('Calculating cascade impact...');
      const r = await GPN.api('maintenance.hardDelete.preview', { studentId: sid });
      if (!r.ok) { box.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(r.error) + '</div>'; return; }

      const d = r.data;
      const rowsHtml = Object.keys(d.willDelete).map((k) =>
        '<tr><td>' + esc(k) + '</td><td><strong>' + esc(d.willDelete[k]) + '</strong></td></tr>'
      ).join('');

      box.innerHTML =
        '<div class="gpn-alert gpn-alert-warn">' +
          '<strong>Target:</strong> ' + esc(d.student.Student_Name) + ' (' + esc(d.student.Student_ID) + ') • ' + esc(d.notice) +
        '</div>' +
        '<div class="gpn-scroll-frame compact"><table class="gpn-table"><thead><tr><th>Table</th><th>Rows Removed</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div>' +
        '<div class="gpn-toolbar gpn-mt">' +
          '<input class="gpn-input" id="hdConfirmInp" placeholder="Type ' + esc(d.confirmToken) + ' to confirm" style="max-width:260px">' +
          '<button type="button" class="gpn-btn gpn-btn-danger" id="btnHdExecute">Permanently Clear Operational Rows</button>' +
        '</div>';

      box.querySelector('#btnHdExecute').addEventListener('click', async () => {
        const txt = box.querySelector('#hdConfirmInp').value.trim();
        const exRes = await GPN.api('maintenance.hardDelete.execute', { studentId: d.student.Student_ID, confirmText: txt });
        if (exRes.ok) {
          toast('Cleared ' + d.student.Student_ID + ' (Contact Directory preserved).', 'ok');
          box.innerHTML = '<div class="gpn-alert">Done. JSON archive saved to Drive and Contact Directory marked ARCHIVED.</div>';
        } else toast(exRes.error, 'err');
      });
    });
  }

  window.GPN_MODULES = window.GPN_MODULES || {};
  window.GPN_MODULES['admin-overview'] = { render };
})();
