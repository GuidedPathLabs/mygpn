/* ============================================================================
 * GPN CENTRAL SYSTEM 2026 — Unified Student & Parent Portal Modules
 * Registers: portal-home, portal-offline, portal-online, portal-leaderboard
 * ============================================================================ */

(function () {
  'use strict';

  const { esc, formatINR, statusBadge, toast, openModal, closeModal, printHtml, loading, empty } = GPN.ui;

  let activeChildId = '';

  function resolveStudentId(user) {
    if (user.role === 'STUDENT') return user.userId;
    const kids = Array.isArray(user.linkedStudentIds) ? user.linkedStudentIds : [];
    if (!activeChildId || !kids.includes(activeChildId)) activeChildId = kids[0] || '';
    return activeChildId;
  }

  function renderChildSwitcher(user, onSwitch) {
    if (user.role !== 'PARENT') return '';
    const kids = Array.isArray(user.linkedStudentIds) ? user.linkedStudentIds : [];
    if (kids.length <= 1) return '';
    setTimeout(() => {
      const sel = document.getElementById('gpnChildSwitcher');
      if (sel) sel.addEventListener('change', () => { activeChildId = sel.value; onSwitch(); });
    }, 0);
    return (
      '<div class="gpn-toolbar">' +
        '<span class="gpn-muted"><strong>Viewing Child:</strong></span>' +
        '<select class="gpn-select" id="gpnChildSwitcher" style="max-width:220px">' +
          kids.map((id) => '<option value="' + esc(id) + '"' + (id === activeChildId ? ' selected' : '') + '>' + esc(id) + '</option>').join('') +
        '</select>' +
      '</div>'
    );
  }

  /* ---- 1. PORTAL HOME & FEES ---- */
  async function renderHome(container, user) {
    const sid = resolveStudentId(user);
    if (!sid) { container.innerHTML = empty('No student profile linked to your account.'); return; }
    container.innerHTML = loading('Loading your profile & fee ledger...');

    const [stRes, feeRes] = await Promise.all([
      GPN.api('master.students.get', { studentId: sid }),
      GPN.api('fees.portalSummary', { studentId: sid })
    ]);
    if (!stRes.ok) { container.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(stRes.error) + '</div>'; return; }

    const s = (stRes.data && stRes.data.student) || {};
    const f = (feeRes.ok && feeRes.data) || { unpaidTotal: 0, cycles: [], receipts: [] };

    container.innerHTML =
      renderChildSwitcher(user, () => renderHome(container, user)) +
      '<div class="gpn-grid gpn-grid-3">' +
        '<div class="gpn-kpi"><div class="gpn-kpi-label">Student</div><div class="gpn-kpi-value" style="font-size:1.2rem">' + esc(s.Student_Name) + '</div><div class="gpn-kpi-sub">' + esc(s.Student_ID) + ' • ' + esc(s.Class) + ' • ' + esc(s.Batch_Name || s.Mode) + '</div></div>' +
        '<div class="gpn-kpi"><div class="gpn-kpi-label">Pending Fees</div><div class="gpn-kpi-value" style="color:' + (f.unpaidTotal > 0 ? 'var(--gpn-warn)' : 'var(--gpn-ok)') + '">' + formatINR(f.unpaidTotal) + '</div><div class="gpn-kpi-sub"><a href="' + esc(f.feesUrl || GPN.URLS.FEES) + '" target="_blank" rel="noopener">Pay Fee Online →</a></div></div>' +
        '<div class="gpn-kpi"><div class="gpn-kpi-label">Academic Mentor</div><div class="gpn-kpi-value" style="font-size:1.2rem">' + esc(s.Teacher_ID === 'T002' ? 'Academic Head' : 'Super Admin') + '</div><div class="gpn-kpi-sub"><a href="' + esc(GPN.URLS.ABOUT) + '" target="_blank" rel="noopener">About Mentor ↗</a></div></div>' +
      '</div>' +
      '<div class="gpn-card gpn-mt">' +
        '<div class="gpn-card-header">' +
          '<h3 class="gpn-card-title">Fee Cycles & Receipts</h3>' +
          '<button type="button" class="gpn-btn gpn-btn-outline gpn-btn-sm" id="btnMyReportCard">🖨 Print Report Card</button>' +
        '</div>' +
        '<div class="gpn-scroll-frame compact">' +
          '<table class="gpn-table"><thead><tr><th>Cycle</th><th>Period</th><th>Due Date</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead><tbody>' +
            (f.cycles.length
              ? f.cycles.map((c) =>
                  '<tr>' +
                    '<td><strong>' + esc(c.Cycle_Label) + '</strong></td>' +
                    '<td>' + esc(c.Cycle_Start) + ' → ' + esc(c.Cycle_End) + '</td>' +
                    '<td>' + esc(c.Due_Date) + '</td>' +
                    '<td><strong>' + formatINR(c.Cycle_Fee) + '</strong></td>' +
                    '<td>' + statusBadge(c.Payment_Status) + '</td>' +
                    '<td>' + (c.Receipt_No ? '<button type="button" class="gpn-btn gpn-btn-outline gpn-btn-sm btnPrintRcp" data-rcp="' + esc(c.Receipt_No) + '">Receipt</button>' : '<a class="gpn-btn gpn-btn-gold gpn-btn-sm" href="' + esc(f.feesUrl || GPN.URLS.FEES) + '" target="_blank" rel="noopener">Pay</a>') + '</td>' +
                  '</tr>'
                ).join('')
              : '<tr><td colspan="6">' + empty('No fee cycles generated yet.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>';

    container.querySelector('#btnMyReportCard').addEventListener('click', () => printMyCard(sid));
    container.querySelectorAll('.btnPrintRcp').forEach((b) => {
      b.addEventListener('click', () => printMyReceipt(b.dataset.rcp));
    });
  }

  async function printMyReceipt(receiptNo) {
    const r = await GPN.api('reports.feeReceipt', { receiptNo });
    if (!r.ok) { toast(r.error, 'err'); return; }
    const d = r.data, rc = d.receipt, st = d.student;
    printHtml('Fee Receipt ' + rc.Receipt_No,
      '<div class="hdr"><img src="' + esc(d.brand.logo) + '"><div><h2>' + esc(d.brand.name) + ' — Fee Receipt</h2><div class="meta">' + esc(d.brand.address) + '</div></div></div>' +
      '<table><tr><th>Receipt No</th><td><strong>' + esc(rc.Receipt_No) + '</strong></td><th>Paid At</th><td>' + esc(rc.Paid_At) + '</td></tr>' +
      '<tr><th>Student</th><td>' + esc(st.Student_Name) + ' (' + esc(st.Student_ID) + ')</td><th>Cycle</th><td>' + esc(rc.Cycle_Label) + '</td></tr>' +
      '<tr><th>Amount</th><td><strong>' + formatINR(rc.Amount) + '</strong></td><th>Method</th><td>' + esc(rc.Method) + '</td></tr></table>'
    );
  }

  async function printMyCard(studentId) {
    const r = await GPN.api('reports.studentCard', { studentId });
    if (!r.ok) { toast(r.error, 'err'); return; }
    const d = r.data, s = d.student || {};
    const scRows = (d.scores || []).map((x) => '<tr><td>' + esc(x.Date) + '</td><td>' + esc(x.Mode) + '</td><td>' + esc(x.Title) + '</td><td>' + esc(x.Marks) + '/' + esc(x.Max) + '</td><td>' + esc(x.Pct) + '%</td></tr>').join('') || '<tr><td colspan="5">No test scores yet.</td></tr>';
    printHtml('Progress Report — ' + s.Student_Name,
      '<div class="hdr"><img src="' + esc(d.brand.logo) + '"><div><h2>' + esc(d.brand.name) + ' — Progress Report</h2><div class="meta">Session: ' + esc(d.brand.session) + ' • Generated: ' + esc(d.generatedAt) + '</div></div></div>' +
      '<table><tr><th>Student</th><td>' + esc(s.Student_Name) + ' (' + esc(s.Student_ID) + ')</td><th>Attendance</th><td>' + esc(d.attendance.present) + '/' + esc(d.attendance.total) + ' (' + esc(d.attendance.pct) + '%)</td></tr></table>' +
      '<h3>Test Performance</h3><table><thead><tr><th>Date</th><th>Mode</th><th>Test</th><th>Marks</th><th>%</th></tr></thead><tbody>' + scRows + '</tbody></table>'
    );
  }

  /* ---- 2. OFFLINE ATTENDANCE, SCORES, BADGES & STUDY FILES ---- */
  async function renderOffline(container, user) {
    const sid = resolveStudentId(user);
    if (!sid) { container.innerHTML = empty('No student profile linked.'); return; }
    container.innerHTML = loading('Loading attendance, tests & study files...');

    const res = await GPN.api('offline.portalSummary', { studentId: sid });
    if (!res.ok) { container.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(res.error) + '</div>'; return; }
    const d = res.data || {};
    const att = d.attendance || { totalDays: 0, presentDays: 0, percentage: 0, recent: [] };

    container.innerHTML =
      renderChildSwitcher(user, () => renderOffline(container, user)) +
      '<div class="gpn-grid gpn-grid-3">' +
        '<div class="gpn-kpi"><div class="gpn-kpi-label">Attendance Rate</div><div class="gpn-kpi-value">' + esc(att.percentage) + '%</div><div class="gpn-kpi-sub">' + esc(att.presentDays) + ' / ' + esc(att.totalDays) + ' days present</div></div>' +
        '<div class="gpn-kpi"><div class="gpn-kpi-label">Offline Tests Taken</div><div class="gpn-kpi-value">' + esc((d.scores || []).length) + '</div><div class="gpn-kpi-sub">Class evaluations</div></div>' +
        '<div class="gpn-kpi"><div class="gpn-kpi-label">Badges & Remarks</div><div class="gpn-kpi-value">' + esc((d.badgesAndRemarks || []).length) + '</div><div class="gpn-kpi-sub">Teacher feedback</div></div>' +
      '</div>' +
      '<div class="gpn-card gpn-mt">' +
        '<h3 class="gpn-card-title">📚 GPN Study Material & Notes</h3>' +
        '<div class="gpn-scroll-frame compact gpn-mt">' +
          '<table class="gpn-table"><thead><tr><th>Title</th><th>Category</th><th>Subject</th><th>Access</th></tr></thead><tbody>' +
            ((d.studyFiles || []).length
              ? d.studyFiles.map((f) => '<tr><td><strong>' + esc(f.Title) + '</strong><div class="gpn-muted">' + esc(f.Description || '') + '</div></td><td>' + statusBadge(f.Category) + '</td><td>' + esc(f.Subject || '-') + '</td><td><a class="gpn-btn gpn-btn-primary gpn-btn-sm" href="' + esc(f.Download_URL) + '" target="_blank" rel="noopener">Download PDF</a></td></tr>').join('')
              : '<tr><td colspan="4">' + empty('No study files assigned for your class yet.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>' +
      '<div class="gpn-grid gpn-grid-2">' +
        '<div class="gpn-card">' +
          '<h3 class="gpn-card-title">Offline Test Scores</h3>' +
          '<div class="gpn-scroll-frame compact gpn-mt">' +
            '<table class="gpn-table"><thead><tr><th>Date</th><th>Test</th><th>Marks</th><th>Rank</th></tr></thead><tbody>' +
              ((d.scores || []).length
                ? d.scores.map((sc) => '<tr><td>' + esc(sc.Test_Date) + '</td><td><strong>' + esc(sc.Test_Title) + '</strong></td><td>' + esc(sc.Marks_Obtained) + '/' + esc(sc.Max_Marks) + ' (' + esc(sc.Percentage) + '%)</td><td>#' + esc(sc.Rank) + '</td></tr>').join('')
                : '<tr><td colspan="4">' + empty('No offline test scores yet.') + '</td></tr>') +
            '</tbody></table>' +
          '</div>' +
        '</div>' +
        '<div class="gpn-card">' +
          '<h3 class="gpn-card-title">Recent Attendance & Teacher Remarks</h3>' +
          '<div class="gpn-scroll-frame compact gpn-mt">' +
            '<table class="gpn-table"><thead><tr><th>Date</th><th>Status</th><th>Remarks</th></tr></thead><tbody>' +
              (att.recent.length
                ? att.recent.map((a) => '<tr><td>' + esc(a.Date) + '</td><td>' + statusBadge(a.Status) + '</td><td>' + esc(a.Remarks || '-') + '</td></tr>').join('')
                : '<tr><td colspan="3">' + empty('No attendance records yet.') + '</td></tr>') +
            '</tbody></table>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ---- 3. ONLINE TESTS, WALLET & 1-ON-1 SESSIONS ---- */
  async function renderOnline(container, user) {
    const sid = resolveStudentId(user);
    if (!sid) { container.innerHTML = empty('No student profile linked.'); return; }
    container.innerHTML = loading('Loading online tests, wallet & sessions...');

    const res = await GPN.api('online.portalSummary', { studentId: sid });
    if (!res.ok) { container.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(res.error) + '</div>'; return; }
    const d = res.data || {};
    const isStudent = user.role === 'STUDENT';

    container.innerHTML =
      renderChildSwitcher(user, () => renderOnline(container, user)) +
      '<div class="gpn-grid gpn-grid-3">' +
        '<div class="gpn-kpi"><div class="gpn-kpi-label">Exam Wallet Balance</div><div class="gpn-kpi-value">' + formatINR(d.walletBalance) + '</div><div class="gpn-kpi-sub">Used for paid online tests</div></div>' +
        '<div class="gpn-kpi"><div class="gpn-kpi-label">Available Tests</div><div class="gpn-kpi-value">' + esc((d.tests || []).filter((t) => t.Status === 'AVAILABLE').length) + '</div><div class="gpn-kpi-sub">Dual-window (3-hr gap)</div></div>' +
        '<div class="gpn-kpi"><div class="gpn-kpi-label">Published Results</div><div class="gpn-kpi-value">' + esc((d.results || []).length) + '</div><div class="gpn-kpi-sub">Verified scores</div></div>' +
      '</div>' +
      '<div class="gpn-card gpn-mt">' +
        '<h3 class="gpn-card-title">📝 Online Tests</h3>' +
        '<div class="gpn-scroll-frame compact gpn-mt">' +
          '<table class="gpn-table"><thead><tr><th>Test</th><th>Marks / Dur</th><th>Fee</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
            ((d.tests || []).length
              ? d.tests.map((t) =>
                  '<tr>' +
                    '<td><strong>' + esc(t.Title) + '</strong><div class="gpn-muted">' + esc(t.Test_ID) + '</div></td>' +
                    '<td>' + esc(t.Total_Marks) + 'm • ' + esc(t.Duration_Min) + ' min</td>' +
                    '<td>' + (Number(t.Price) > 0 ? formatINR(t.Price) : '<span class="gpn-badge gpn-badge-ok">FREE</span>') + '</td>' +
                    '<td>' + statusBadge(t.Status) + '</td>' +
                    '<td>' + (isStudent && String(t.Status).toUpperCase() === 'AVAILABLE'
                      ? '<button type="button" class="gpn-btn gpn-btn-gold gpn-btn-sm btnStartTest" data-id="' + esc(t.Test_ID) + '" data-title="' + esc(t.Title) + '" data-price="' + esc(t.Price || 0) + '">Start Test</button>'
                      : '<span class="gpn-muted">' + (isStudent ? esc(t.Status) : 'Student login required') + '</span>') +
                    '</td>' +
                  '</tr>'
                ).join('')
              : '<tr><td colspan="5">' + empty('No online tests assigned right now.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>' +
      '<div class="gpn-grid gpn-grid-2">' +
        '<div class="gpn-card">' +
          '<h3 class="gpn-card-title">Published Online Results</h3>' +
          '<div class="gpn-scroll-frame compact gpn-mt">' +
            '<table class="gpn-table"><thead><tr><th>Date</th><th>Test</th><th>Score</th><th>%</th></tr></thead><tbody>' +
              ((d.results || []).length
                ? d.results.map((r) => '<tr><td>' + esc(r.Test_Date) + '</td><td>' + esc(r.Test_ID) + '</td><td><strong>' + esc(r.Marks_Obtained) + '/' + esc(r.Max_Marks) + '</strong></td><td><span class="gpn-badge gpn-badge-gold">' + esc(r.Percentage) + '%</span></td></tr>').join('')
                : '<tr><td colspan="4">' + empty('No published online results yet.') + '</td></tr>') +
            '</tbody></table>' +
          '</div>' +
        '</div>' +
        '<div class="gpn-card">' +
          '<h3 class="gpn-card-title">Upcoming 1-on-1 & Class Schedule</h3>' +
          '<div class="gpn-scroll-frame compact gpn-mt">' +
            '<table class="gpn-table"><thead><tr><th>Date & Time</th><th>Type</th><th>Link</th></tr></thead><tbody>' +
              ((d.sessions || []).length
                ? d.sessions.map((s) => '<tr><td><strong>' + esc(s.Date) + '</strong> ' + esc(s.Start_Time) + '–' + esc(s.End_Time) + '</td><td>' + statusBadge(s.Type) + '</td><td>' + (s.Meeting_Link ? '<a class="gpn-btn gpn-btn-primary gpn-btn-sm" href="' + esc(s.Meeting_Link) + '" target="_blank" rel="noopener">Join</a>' : esc(s.Notes || '-')) + '</td></tr>').join('')
                : '<tr><td colspan="3">' + empty('No scheduled sessions.') + '</td></tr>') +
            '</tbody></table>' +
          '</div>' +
        '</div>' +
      '</div>';

    container.querySelectorAll('.btnStartTest').forEach((btn) => {
      btn.addEventListener('click', () => {
        const price = Number(btn.dataset.price || 0);
        openModal('Start Online Exam — ' + btn.dataset.title,
          '<div class="gpn-alert gpn-alert-warn"><strong>Important Exam & No-Refund Policy:</strong><br>' + esc(d.policyNotice || 'If failed, missed, or expired, the test fee remains charged with NO refund.') + '</div>' +
          '<p><strong>Test Fee:</strong> ' + (price > 0 ? formatINR(price) + ' (deducted from Wallet)' : 'FREE') + '</p>' +
          '<label class="gpn-flex" style="margin:12px 0"><input type="checkbox" id="chkNoRef"> <span>I understand and accept the <a href="' + esc(d.refundsUrl || GPN.URLS.REFUNDS) + '" target="_blank" rel="noopener">No-Refund Exam Policy</a>.</span></label>' +
          '<button type="button" class="gpn-btn gpn-btn-gold" id="btnConfirmStart">Generate 6-Char Exam Code & Launch</button>'
        );

        document.getElementById('btnConfirmStart').addEventListener('click', async (e) => {
          if (!document.getElementById('chkNoRef').checked) { toast('Please accept the exam policy checkbox first.', 'warn'); return; }
          e.target.disabled = true;
          e.target.textContent = 'Generating Token...';
          const r = await GPN.api('online.tests.start', { testId: btn.dataset.id, acceptedNoRefundPolicy: true });
          if (!r.ok) {
            e.target.disabled = false;
            e.target.textContent = 'Generate 6-Char Exam Code & Launch';
            toast(r.error, 'err');
            return;
          }
          const td = r.data;
          openModal('Exam Token Issued — Copy Before Opening',
            '<div class="gpn-alert">Enter your exact <strong>Student ID (' + esc(user.userId) + ')</strong> and the 6-character <strong>Submission Code</strong> below inside the Google Form.</div>' +
            '<div class="gpn-center" style="background:#0A192F;border:2px dashed var(--gpn-gold);border-radius:10px;padding:16px;margin:10px 0">' +
              '<div class="gpn-muted">Submission Code</div>' +
              '<div style="font-size:2rem;font-weight:900;letter-spacing:4px;color:var(--gpn-gold)">' + esc(td.code) + '</div>' +
              '<div class="gpn-muted">Expires: ' + esc(td.expiresAt) + '</div>' +
            '</div>' +
            '<div class="gpn-flex gpn-mt" style="justify-content:center">' +
              '<a class="gpn-btn gpn-btn-ok" href="' + esc(td.formUrl) + '" target="_blank" rel="noopener">Open Exam Form Now ↗</a>' +
            '</div>'
          );
        });
      });
    });
  }

  /* ---- 4. LEADERBOARD ---- */
  async function renderLeaderboard(container, user) {
    container.innerHTML = loading('Loading GPN Leaderboard...');
    const res = await GPN.api('offline.leaderboard', { limit: 50 });
    const board = (res.ok && res.data && res.data.leaderboard) || [];

    container.innerHTML =
      '<div class="gpn-card">' +
        '<h3 class="gpn-card-title">🏆 Guided Path Noida Top Performers</h3>' +
        '<div class="gpn-scroll-frame gpn-mt">' +
          '<table class="gpn-table"><thead><tr><th>Rank</th><th>Student</th><th>Class</th><th>Tests</th><th>Avg %</th><th>Badge Pts</th><th>Total Score</th></tr></thead><tbody>' +
            (board.length
              ? board.map((r) =>
                  '<tr' + (r.Student_ID === resolveStudentId(user) ? ' style="background:rgba(255,213,79,0.12)"' : '') + '>' +
                    '<td><strong>#' + esc(r.Rank) + '</strong></td>' +
                    '<td><strong>' + esc(r.Student_Name) + '</strong></td>' +
                    '<td>' + esc(r.Class || '-') + '</td>' +
                    '<td>' + esc(r.Tests_Taken) + '</td>' +
                    '<td>' + esc(r.Avg_Percentage) + '%</td>' +
                    '<td>+' + esc(r.Badge_Points) + '</td>' +
                    '<td><span class="gpn-badge gpn-badge-gold">' + esc(r.Leaderboard_Score) + '</span></td>' +
                  '</tr>'
                ).join('')
              : '<tr><td colspan="7">' + empty('Leaderboard will appear once tests are recorded.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>';
  }

  window.GPN_MODULES = window.GPN_MODULES || {};
  window.GPN_MODULES['portal-home'] = { render: renderHome };
  window.GPN_MODULES['portal-offline'] = { render: renderOffline };
  window.GPN_MODULES['portal-online'] = { render: renderOnline };
  window.GPN_MODULES['portal-leaderboard'] = { render: renderLeaderboard };
})();
