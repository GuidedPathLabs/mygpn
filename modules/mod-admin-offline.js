/* ============================================================================
 * GPN CENTRAL SYSTEM 2026 — Offline Ops (Batches, Attendance, Tests, Leaderboard, Files)
 * ============================================================================ */

(function () {
  'use strict';

  const { esc, formatINR, statusBadge, toast, openModal, closeModal, loading, empty } = GPN.ui;

  async function render(container) {
    let activeTab = 'batches';

    container.innerHTML =
      '<div class="gpn-subtabs">' +
        '<button type="button" class="gpn-subtab active" data-tab="batches">Batches & Roster</button>' +
        '<button type="button" class="gpn-subtab" data-tab="attendance">Daily Attendance</button>' +
        '<button type="button" class="gpn-subtab" data-tab="tests">Offline Tests & Scores</button>' +
        '<button type="button" class="gpn-subtab" data-tab="leaderboard">Badges & Leaderboard</button>' +
        '<button type="button" class="gpn-subtab" data-tab="files">GPN Study Files (R2)</button>' +
      '</div>' +
      '<div id="offContent">' + loading('Loading...') + '</div>';

    const contentEl = container.querySelector('#offContent');

    container.querySelectorAll('.gpn-subtab').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        container.querySelectorAll('.gpn-subtab').forEach((b) => b.classList.toggle('active', b === btn));
        loadTab();
      });
    });

    function loadTab() {
      if (activeTab === 'batches') return renderBatches(contentEl);
      if (activeTab === 'attendance') return renderAttendance(contentEl);
      if (activeTab === 'tests') return renderTests(contentEl);
      if (activeTab === 'leaderboard') return renderLeaderboard(contentEl);
      if (activeTab === 'files') return renderFiles(contentEl);
    }

    loadTab();
  }

  /* ---- 1. BATCHES & ROSTER ASSIGNMENT ---- */
  async function renderBatches(el) {
    el.innerHTML = loading('Loading offline batches...');
    const res = await GPN.api('offline.batches.list');
    if (!res.ok) { el.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(res.error) + '</div>'; return; }
    const batches = (res.data && res.data.batches) || [];

    el.innerHTML =
      '<div class="gpn-card">' +
        '<div class="gpn-card-header">' +
          '<h3 class="gpn-card-title">Offline Batches (' + batches.length + ')</h3>' +
          '<button type="button" class="gpn-btn gpn-btn-gold gpn-btn-sm" id="btnNewBatch">+ Create Batch</button>' +
        '</div>' +
        '<div class="gpn-scroll-frame">' +
          '<table class="gpn-table"><thead><tr><th>ID</th><th>Batch Name</th><th>Class / Subject</th><th>Schedule / Timing</th><th>Teacher</th><th>Students</th><th>Action</th></tr></thead><tbody>' +
            (batches.length
              ? batches.map((b) =>
                  '<tr>' +
                    '<td><strong>' + esc(b.Batch_ID) + '</strong></td>' +
                    '<td>' + esc(b.Batch_Name) + '</td>' +
                    '<td>' + esc(b.Class) + ' • ' + esc(b.Subject) + '</td>' +
                    '<td>' + esc(b.Days_Schedule) + ' (' + esc(b.Timing || '-') + ')</td>' +
                    '<td>' + esc(b.Teacher_ID) + '</td>' +
                    '<td><span class="gpn-badge gpn-badge-gold">' + esc(b.Student_Count || 0) + '</span></td>' +
                    '<td><button type="button" class="gpn-btn gpn-btn-outline gpn-btn-sm btnAssignBat" data-id="' + esc(b.Batch_ID) + '" data-name="' + esc(b.Batch_Name) + '">Assign Students</button></td>' +
                  '</tr>'
                ).join('')
              : '<tr><td colspan="7">' + empty('No batches created yet.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>';

    el.querySelector('#btnNewBatch').addEventListener('click', () => {
      openModal('Create Offline Batch',
        '<form id="frmBatch">' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Batch Name *</label><input class="gpn-input" id="bName" required placeholder="e.g. Class 10 Maths 5PM"></div>' +
            '<div class="gpn-field"><label>Class</label><input class="gpn-input" id="bClass" placeholder="Class 10"></div>' +
          '</div>' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Subject</label><input class="gpn-input" id="bSub" value="All Subjects"></div>' +
            '<div class="gpn-field"><label>Teacher</label><select class="gpn-select" id="bTeacher"><option value="T001">T001</option><option value="T002">T002</option></select></div>' +
          '</div>' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Days</label><input class="gpn-input" id="bDays" value="Mon-Sat"></div>' +
            '<div class="gpn-field"><label>Timing</label><input class="gpn-input" id="bTime" placeholder="5:00 PM - 6:00 PM"></div>' +
            '<div class="gpn-field"><label>Monthly Fee (₹)</label><input class="gpn-input" type="number" id="bFee" value="0"></div>' +
          '</div>' +
          '<button type="submit" class="gpn-btn gpn-btn-gold gpn-mt">Create Batch</button>' +
        '</form>'
      );
      document.getElementById('frmBatch').addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await GPN.api('offline.batches.create', {
          Batch_Name: document.getElementById('bName').value.trim(),
          Class: document.getElementById('bClass').value.trim(),
          Subject: document.getElementById('bSub').value.trim(),
          Teacher_ID: document.getElementById('bTeacher').value,
          Days_Schedule: document.getElementById('bDays').value.trim(),
          Timing: document.getElementById('bTime').value.trim(),
          Monthly_Fee: Number(document.getElementById('bFee').value || 0)
        });
        if (r.ok) { closeModal(true); toast('Batch ' + r.data.Batch_ID + ' created.', 'ok'); renderBatches(el); }
        else toast(r.error, 'err');
      });
    });

    el.querySelectorAll('.btnAssignBat').forEach((btn) => {
      btn.addEventListener('click', () => openAssignModal(btn.dataset.id, btn.dataset.name, () => renderBatches(el)));
    });
  }

  async function openAssignModal(batchId, batchName, onDone) {
    openModal('Assign Students → ' + batchName, loading('Loading active students...'));
    const [stRes, rosRes] = await Promise.all([
      GPN.api('master.students.list', { status: 'ACTIVE', mode: 'OFFLINE' }),
      GPN.api('offline.batches.roster', { batchId })
    ]);
    const body = document.getElementById('gpnModalBody');
    if (!stRes.ok) { body.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(stRes.error) + '</div>'; return; }

    const students = (stRes.data && stRes.data.students) || [];
    const inBatch = new Set(((rosRes.ok && rosRes.data && rosRes.data.roster) || []).map((r) => r.Student_ID));

    body.innerHTML =
      '<div class="gpn-scroll-frame compact">' +
        students.map((s) =>
          '<label class="gpn-flex" style="padding:8px 10px;border-bottom:1px solid var(--gpn-border-soft)">' +
            '<input type="checkbox" class="chkBatSt" value="' + esc(s.Student_ID) + '"' + (inBatch.has(s.Student_ID) ? ' checked disabled' : '') + '>' +
            '<span><strong>' + esc(s.Student_ID) + '</strong> — ' + esc(s.Student_Name) + ' (' + esc(s.Class) + ') ' + (inBatch.has(s.Student_ID) ? '<span class="gpn-badge gpn-badge-ok">In Batch</span>' : '') + '</span>' +
          '</label>'
        ).join('') +
      '</div>' +
      '<button type="button" class="gpn-btn gpn-btn-gold gpn-mt" id="btnDoAssign">Assign Selected Students</button>';

    document.getElementById('btnDoAssign').addEventListener('click', async () => {
      const ids = Array.from(body.querySelectorAll('.chkBatSt:checked:not(:disabled)')).map((c) => c.value);
      if (!ids.length) { toast('Select at least one new student.', 'warn'); return; }
      const r = await GPN.api('offline.batches.assign', { batchId, studentIds: ids });
      if (r.ok) { closeModal(true); toast('Assigned ' + r.data.assigned + ' student(s).', 'ok'); onDone(); }
      else toast(r.error, 'err');
    });
  }

  /* ---- 2. DAILY ATTENDANCE ---- */
  async function renderAttendance(el) {
    el.innerHTML = loading('Loading batches...');
    const res = await GPN.api('offline.batches.list');
    const batches = (res.ok && res.data && res.data.batches) || [];
    const todayIso = new Date().toISOString().slice(0, 10);

    el.innerHTML =
      '<div class="gpn-card">' +
        '<h3 class="gpn-card-title">Mark Daily Attendance</h3>' +
        '<div class="gpn-toolbar gpn-mt">' +
          '<select class="gpn-select" id="attBatch" style="max-width:260px">' +
            batches.map((b) => '<option value="' + esc(b.Batch_ID) + '">' + esc(b.Batch_Name) + ' (' + esc(b.Batch_ID) + ')</option>').join('') +
          '</select>' +
          '<input class="gpn-input" type="date" id="attDate" value="' + todayIso + '" style="max-width:170px">' +
          '<button type="button" class="gpn-btn gpn-btn-primary gpn-btn-sm" id="btnLoadAtt">Load Roster</button>' +
        '</div>' +
        '<div id="attRosterWrap">' + (batches.length ? '<p class="gpn-muted">Select a batch and tap Load Roster.</p>' : empty('Create a batch first.')) + '</div>' +
      '</div>';

    el.querySelector('#btnLoadAtt').addEventListener('click', async () => {
      const batchId = el.querySelector('#attBatch').value;
      const date = el.querySelector('#attDate').value;
      if (!batchId) return;

      const wrap = el.querySelector('#attRosterWrap');
      wrap.innerHTML = loading('Loading batch roster...');
      const [rosRes, exRes] = await Promise.all([
        GPN.api('offline.batches.roster', { batchId }),
        GPN.api('offline.attendance.list', { batchId, date })
      ]);
      const roster = (rosRes.ok && rosRes.data && rosRes.data.roster) || [];
      if (!roster.length) { wrap.innerHTML = empty('No students assigned to this batch yet.'); return; }

      const exMap = {};
      ((exRes.ok && exRes.data && exRes.data.attendance) || []).forEach((a) => { exMap[a.Student_ID] = a; });

      wrap.innerHTML =
        '<div class="gpn-scroll-frame">' +
          '<table class="gpn-table"><thead><tr><th>Student</th><th>Status</th><th>Remarks</th></tr></thead><tbody>' +
            roster.map((s) => {
              const cur = exMap[s.Student_ID] || {};
              const st = cur.Status || 'PRESENT';
              return (
                '<tr data-sid="' + esc(s.Student_ID) + '">' +
                  '<td><strong>' + esc(s.Student_Name) + '</strong> <span class="gpn-muted">(' + esc(s.Student_ID) + ')</span></td>' +
                  '<td><select class="gpn-select attSel" style="max-width:140px">' +
                    ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'].map((opt) => '<option value="' + opt + '"' + (st === opt ? ' selected' : '') + '>' + opt + '</option>').join('') +
                  '</select></td>' +
                  '<td><input class="gpn-input attRem" value="' + esc(cur.Remarks || '') + '" placeholder="Optional remark"></td>' +
                '</tr>'
              );
            }).join('') +
          '</tbody></table>' +
        '</div>' +
        '<button type="button" class="gpn-btn gpn-btn-ok gpn-mt" id="btnSaveAtt">Save Attendance</button>';

      wrap.querySelector('#btnSaveAtt').addEventListener('click', async (e) => {
        const entries = Array.from(wrap.querySelectorAll('tbody tr')).map((tr) => ({
          studentId: tr.dataset.sid,
          status: tr.querySelector('.attSel').value,
          remarks: tr.querySelector('.attRem').value.trim()
        }));
        e.target.disabled = true;
        const sv = await GPN.api('offline.attendance.mark', { date, batchId, entries });
        e.target.disabled = false;
        if (sv.ok) toast('Saved! New: ' + sv.data.inserted + ', Updated: ' + sv.data.updated, 'ok');
        else toast(sv.error, 'err');
      });
    });
  }

  /* ---- 3. OFFLINE TESTS & SCORES ---- */
  async function renderTests(el) {
    el.innerHTML = loading('Loading offline tests...');
    const [tRes, bRes] = await Promise.all([GPN.api('offline.tests.list'), GPN.api('offline.batches.list')]);
    const tests = (tRes.ok && tRes.data && tRes.data.tests) || [];
    const batches = (bRes.ok && bRes.data && bRes.data.batches) || [];

    el.innerHTML =
      '<div class="gpn-card">' +
        '<div class="gpn-card-header">' +
          '<h3 class="gpn-card-title">Offline Tests (' + tests.length + ')</h3>' +
          '<button type="button" class="gpn-btn gpn-btn-gold gpn-btn-sm" id="btnNewOffTest">+ Create Offline Test</button>' +
        '</div>' +
        '<div class="gpn-scroll-frame">' +
          '<table class="gpn-table"><thead><tr><th>ID</th><th>Title</th><th>Batch / Subject</th><th>Date</th><th>Max Marks</th><th>Action</th></tr></thead><tbody>' +
            (tests.length
              ? tests.map((t) =>
                  '<tr>' +
                    '<td><strong>' + esc(t.Test_ID) + '</strong></td>' +
                    '<td>' + esc(t.Title) + '</td>' +
                    '<td>' + esc(t.Batch_ID || '-') + ' • ' + esc(t.Subject || '') + '</td>' +
                    '<td>' + esc(t.Test_Date) + '</td>' +
                    '<td>' + esc(t.Max_Marks) + '</td>' +
                    '<td><button type="button" class="gpn-btn gpn-btn-primary gpn-btn-sm btnEnterSc" data-id="' + esc(t.Test_ID) + '" data-bat="' + esc(t.Batch_ID || '') + '" data-max="' + esc(t.Max_Marks) + '" data-title="' + esc(t.Title) + '">Enter Scores</button></td>' +
                  '</tr>'
                ).join('')
              : '<tr><td colspan="6">' + empty('No offline tests yet.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>';

    el.querySelector('#btnNewOffTest').addEventListener('click', () => {
      openModal('Create Offline Test',
        '<form id="frmOffTest">' +
          '<div class="gpn-field"><label>Test Title *</label><input class="gpn-input" id="otTitle" required placeholder="e.g. Ch 1–2 Weekly Maths Test"></div>' +
          '<div class="gpn-form-row gpn-mt">' +
            '<div class="gpn-field"><label>Batch</label><select class="gpn-select" id="otBat"><option value="">All / General</option>' + batches.map((b) => '<option value="' + esc(b.Batch_ID) + '">' + esc(b.Batch_Name) + '</option>').join('') + '</select></div>' +
            '<div class="gpn-field"><label>Subject</label><input class="gpn-input" id="otSub" placeholder="Mathematics"></div>' +
          '</div>' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Max Marks *</label><input class="gpn-input" type="number" id="otMax" value="50" required></div>' +
            '<div class="gpn-field"><label>Test Date</label><input class="gpn-input" type="date" id="otDate"></div>' +
          '</div>' +
          '<button type="submit" class="gpn-btn gpn-btn-gold gpn-mt">Create Test</button>' +
        '</form>'
      );
      document.getElementById('frmOffTest').addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await GPN.api('offline.tests.create', {
          Title: document.getElementById('otTitle').value.trim(),
          Batch_ID: document.getElementById('otBat').value,
          Subject: document.getElementById('otSub').value.trim(),
          Max_Marks: Number(document.getElementById('otMax').value || 50),
          Test_Date: document.getElementById('otDate').value
        });
        if (r.ok) { closeModal(true); toast('Test ' + r.data.Test_ID + ' created.', 'ok'); renderTests(el); }
        else toast(r.error, 'err');
      });
    });

    el.querySelectorAll('.btnEnterSc').forEach((btn) => {
      btn.addEventListener('click', () => openScoresModal(btn.dataset.id, btn.dataset.bat, btn.dataset.max, btn.dataset.title));
    });
  }

  async function openScoresModal(testId, batchId, maxMarks, title) {
    openModal('Scores: ' + title + ' (Max ' + maxMarks + ')', loading('Loading students...'));
    const res = batchId
      ? await GPN.api('offline.batches.roster', { batchId })
      : await GPN.api('master.students.list', { status: 'ACTIVE', mode: 'OFFLINE' });

    const students = batchId ? ((res.data && res.data.roster) || []) : ((res.data && res.data.students) || []);
    const body = document.getElementById('gpnModalBody');
    if (!students.length) { body.innerHTML = empty('No students available for this test.'); return; }

    body.innerHTML =
      '<div class="gpn-scroll-frame compact">' +
        '<table class="gpn-table"><thead><tr><th>Student</th><th>Marks (/' + esc(maxMarks) + ')</th><th>Remark</th></tr></thead><tbody>' +
          students.map((s) =>
            '<tr data-sid="' + esc(s.Student_ID) + '">' +
              '<td><strong>' + esc(s.Student_Name) + '</strong> (' + esc(s.Student_ID) + ')</td>' +
              '<td><input class="gpn-input scMark" type="number" step="0.5" min="0" max="' + esc(maxMarks) + '" placeholder="-" style="max-width:100px"></td>' +
              '<td><input class="gpn-input scRem" placeholder="Good / Needs practice"></td>' +
            '</tr>'
          ).join('') +
        '</tbody></table>' +
      '</div>' +
      '<button type="button" class="gpn-btn gpn-btn-gold gpn-mt" id="btnSaveSc">Save & Auto-Rank Scores</button>';

    document.getElementById('btnSaveSc').addEventListener('click', async () => {
      const scores = [];
      body.querySelectorAll('tbody tr').forEach((tr) => {
        const val = tr.querySelector('.scMark').value;
        if (val !== '') {
          scores.push({ studentId: tr.dataset.sid, marks: Number(val), remark: tr.querySelector('.scRem').value.trim() });
        }
      });
      if (!scores.length) { toast('Enter marks for at least one student.', 'warn'); return; }
      const r = await GPN.api('offline.scores.save', { testId, scores });
      if (r.ok) { closeModal(true); toast('Saved and ranked ' + r.data.saved + ' score(s).', 'ok'); }
      else toast(r.error, 'err');
    });
  }

  /* ---- 4. BADGES & LEADERBOARD ---- */
  async function renderLeaderboard(el) {
    el.innerHTML = loading('Loading leaderboard...');
    const res = await GPN.api('offline.leaderboard', { limit: 50 });
    const board = (res.ok && res.data && res.data.leaderboard) || [];

    el.innerHTML =
      '<div class="gpn-card">' +
        '<div class="gpn-card-header">' +
          '<h3 class="gpn-card-title">🏆 Live Leaderboard & Rewards</h3>' +
          '<button type="button" class="gpn-btn gpn-btn-gold gpn-btn-sm" id="btnAddBadge">+ Award Badge / Remark</button>' +
        '</div>' +
        '<div class="gpn-scroll-frame">' +
          '<table class="gpn-table"><thead><tr><th>Rank</th><th>Student</th><th>Class / Batch</th><th>Tests</th><th>Avg %</th><th>Badge Pts</th><th>Total Score</th></tr></thead><tbody>' +
            (board.length
              ? board.map((r) =>
                  '<tr>' +
                    '<td><strong>#' + esc(r.Rank) + '</strong></td>' +
                    '<td><strong>' + esc(r.Student_Name) + '</strong> <span class="gpn-muted">(' + esc(r.Student_ID) + ')</span></td>' +
                    '<td>' + esc(r.Class) + ' • ' + esc(r.Batch_Name || '-') + '</td>' +
                    '<td>' + esc(r.Tests_Taken) + '</td>' +
                    '<td>' + esc(r.Avg_Percentage) + '%</td>' +
                    '<td>+' + esc(r.Badge_Points) + '</td>' +
                    '<td><span class="gpn-badge gpn-badge-gold">' + esc(r.Leaderboard_Score) + '</span></td>' +
                  '</tr>'
                ).join('')
              : '<tr><td colspan="7">' + empty('No active students ranked yet.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>';

    el.querySelector('#btnAddBadge').addEventListener('click', () => {
      openModal('Award Badge / Teacher Remark',
        '<form id="frmBdg">' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Student ID *</label><input class="gpn-input" id="bgSid" required placeholder="ST001"></div>' +
            '<div class="gpn-field"><label>Type</label><select class="gpn-select" id="bgType"><option value="BADGE">BADGE</option><option value="REWARD">REWARD</option><option value="REMARK">REMARK</option></select></div>' +
          '</div>' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Title *</label><input class="gpn-input" id="bgTitle" required placeholder="e.g. Top Performer"></div>' +
            '<div class="gpn-field"><label>Bonus Points</label><input class="gpn-input" type="number" id="bgPts" value="5"></div>' +
          '</div>' +
          '<div class="gpn-field"><label>Message</label><textarea class="gpn-textarea" id="bgMsg" placeholder="Well done!"></textarea></div>' +
          '<button type="submit" class="gpn-btn gpn-btn-gold gpn-mt">Award Now</button>' +
        '</form>'
      );
      document.getElementById('frmBdg').addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await GPN.api('offline.badges.add', {
          Student_ID: document.getElementById('bgSid').value.trim().toUpperCase(),
          Type: document.getElementById('bgType').value,
          Title: document.getElementById('bgTitle').value.trim(),
          Points: Number(document.getElementById('bgPts').value || 0),
          Message: document.getElementById('bgMsg').value.trim()
        });
        if (r.ok) { closeModal(true); toast('Awarded!', 'ok'); renderLeaderboard(el); }
        else toast(r.error, 'err');
      });
    });
  }

  /* ---- 5. GPN STUDY FILES (R2) ---- */
  async function renderFiles(el) {
    el.innerHTML = loading('Loading study files...');
    const res = await GPN.api('offline.files.list', {});
    const files = (res.ok && res.data && res.data.files) || [];

    el.innerHTML =
      '<div class="gpn-card">' +
        '<div class="gpn-card-header">' +
          '<h3 class="gpn-card-title">Original GPN Study Files (files.guidedpathnoida.in)</h3>' +
          '<button type="button" class="gpn-btn gpn-btn-gold gpn-btn-sm" id="btnAddFile">+ Link R2 Study File</button>' +
        '</div>' +
        '<div class="gpn-scroll-frame">' +
          '<table class="gpn-table"><thead><tr><th>ID</th><th>Title</th><th>Category / Class</th><th>R2 Path</th><th>Links</th></tr></thead><tbody>' +
            (files.length
              ? files.map((f) =>
                  '<tr>' +
                    '<td>' + esc(f.File_ID) + '</td>' +
                    '<td><strong>' + esc(f.Title) + '</strong><div class="gpn-muted">' + esc(f.Subject || '') + '</div></td>' +
                    '<td>' + statusBadge(f.Category) + ' ' + esc(f.Class || 'All') + '</td>' +
                    '<td><code>' + esc(f.R2_Path) + '</code></td>' +
                    '<td><div class="gpn-flex">' +
                      '<a class="gpn-btn gpn-btn-outline gpn-btn-sm" href="' + esc(f.View_URL) + '" target="_blank" rel="noopener">View</a>' +
                      '<a class="gpn-btn gpn-btn-primary gpn-btn-sm" href="' + esc(f.Download_URL) + '" target="_blank" rel="noopener">Download</a>' +
                    '</div></td>' +
                  '</tr>'
                ).join('')
              : '<tr><td colspan="5">' + empty('No study files linked yet.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>';

    el.querySelector('#btnAddFile').addEventListener('click', () => {
      openModal('Link Original GPN R2 Study File',
        '<form id="frmFile">' +
          '<div class="gpn-field"><label>Title *</label><input class="gpn-input" id="flTitle" required placeholder="e.g. Class 10 Ch 1 Real Numbers Notes"></div>' +
          '<div class="gpn-form-row gpn-mt">' +
            '<div class="gpn-field"><label>Category</label><select class="gpn-select" id="flCat"><option value="NOTES">NOTES</option><option value="SOLUTIONS">SOLUTIONS</option><option value="WORKSHEET">WORKSHEET</option><option value="BOOKLET">BOOKLET</option></select></div>' +
            '<div class="gpn-field"><label>Class</label><input class="gpn-input" id="flClass" placeholder="Class 10"></div>' +
            '<div class="gpn-field"><label>Subject</label><input class="gpn-input" id="flSub" placeholder="Mathematics"></div>' +
          '</div>' +
          '<div class="gpn-field"><label>R2 Path * (never ncert-books/)</label><input class="gpn-input" id="flPath" required placeholder="notes/class-10/maths-ch01.pdf"></div>' +
          '<div class="gpn-field gpn-mt"><label>Description</label><input class="gpn-input" id="flDesc"></div>' +
          '<button type="submit" class="gpn-btn gpn-btn-gold gpn-mt">Save Study File</button>' +
        '</form>'
      );
      document.getElementById('frmFile').addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await GPN.api('offline.files.create', {
          Title: document.getElementById('flTitle').value.trim(),
          Category: document.getElementById('flCat').value,
          Class: document.getElementById('flClass').value.trim(),
          Subject: document.getElementById('flSub').value.trim(),
          R2_Path: document.getElementById('flPath').value.trim(),
          Description: document.getElementById('flDesc').value.trim()
        });
        if (r.ok) { closeModal(true); toast('Study file ' + r.data.File_ID + ' linked.', 'ok'); renderFiles(el); }
        else toast(r.error, 'err');
      });
    });
  }

  window.GPN_MODULES = window.GPN_MODULES || {};
  window.GPN_MODULES['admin-offline'] = { render };
})();
