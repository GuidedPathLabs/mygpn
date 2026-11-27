/* ============================================================================
 * GPN CENTRAL SYSTEM 2026 — Online Programmes, 1-on-1, Form Creator, Eval & Wallet
 * ============================================================================ */

(function () {
  'use strict';

  const { esc, formatINR, statusBadge, toast, openModal, closeModal, loading, empty } = GPN.ui;

  async function render(container) {
    let activeTab = 'tests';

    container.innerHTML =
      '<div class="gpn-subtabs">' +
        '<button type="button" class="gpn-subtab active" data-tab="tests">Online Tests & Form Builder</button>' +
        '<button type="button" class="gpn-subtab" data-tab="eval">Subjective Evaluation</button>' +
        '<button type="button" class="gpn-subtab" data-tab="prog">Programmes & 1-on-1 Schedule</button>' +
        '<button type="button" class="gpn-subtab" data-tab="wallet">Student Wallet Credit</button>' +
      '</div>' +
      '<div id="onContent">' + loading('Loading...') + '</div>';

    const contentEl = container.querySelector('#onContent');

    container.querySelectorAll('.gpn-subtab').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        container.querySelectorAll('.gpn-subtab').forEach((b) => b.classList.toggle('active', b === btn));
        loadTab();
      });
    });

    function loadTab() {
      if (activeTab === 'tests') return renderTests(contentEl);
      if (activeTab === 'eval') return renderEvaluation(contentEl);
      if (activeTab === 'prog') return renderProgrammes(contentEl);
      if (activeTab === 'wallet') return renderWallet(contentEl);
    }

    loadTab();
  }

  /* ---- 1. ONLINE TESTS & AUTOMATED GOOGLE FORM BUILDER ---- */
  async function renderTests(el) {
    el.innerHTML = loading('Loading online tests...');
    const res = await GPN.api('online.tests.list');
    if (!res.ok) { el.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(res.error) + '</div>'; return; }
    const tests = (res.data && res.data.tests) || [];

    el.innerHTML =
      '<div class="gpn-card">' +
        '<div class="gpn-card-header">' +
          '<h3 class="gpn-card-title">Online Tests (' + tests.length + ')</h3>' +
          '<div class="gpn-flex">' +
            '<button type="button" class="gpn-btn gpn-btn-outline gpn-btn-sm" id="btnManSub">✍ Manual Score Entry</button>' +
            '<button type="button" class="gpn-btn gpn-btn-gold gpn-btn-sm" id="btnNewTest">+ Create Online Test</button>' +
          '</div>' +
        '</div>' +
        '<div class="gpn-scroll-frame">' +
          '<table class="gpn-table"><thead><tr>' +
            '<th>ID</th><th>Title & Class</th><th>Marks / Dur / Fee</th><th>Form</th><th>Status</th><th>Actions</th>' +
          '</tr></thead><tbody>' +
            (tests.length
              ? tests.map((t) =>
                  '<tr>' +
                    '<td><strong>' + esc(t.Test_ID) + '</strong></td>' +
                    '<td><div><strong>' + esc(t.Title) + '</strong></div><div class="gpn-muted">' + esc(t.Class || 'All Classes') + ' • Gap: ' + esc(t.Gap_Hours || 3) + 'h</div></td>' +
                    '<td>' + esc(t.Total_Marks || 0) + 'm • ' + esc(t.Duration_Min || 45) + ' min • ' + formatINR(t.Price) + '</td>' +
                    '<td>' + (t.Form_URL ? '<a href="' + esc(t.Form_URL) + '" target="_blank" rel="noopener">Open Form ↗</a>' : '<span class="gpn-muted">No Form</span>') + '</td>' +
                    '<td>' + statusBadge(t.Status) + '</td>' +
                    '<td><div class="gpn-flex">' +
                      (!t.Form_ID && String(t.Status).toUpperCase() === 'DRAFT'
                        ? '<button type="button" class="gpn-btn gpn-btn-gold gpn-btn-sm btnBuildForm" data-id="' + esc(t.Test_ID) + '" data-title="' + esc(t.Title) + '">Build Form</button>'
                        : '') +
                      '<select class="gpn-select selTestSt" data-id="' + esc(t.Test_ID) + '" style="width:120px;padding:4px 6px;font-size:0.78rem">' +
                        ['DRAFT', 'AVAILABLE', 'CLOSED', 'EVALUATED', 'PUBLISHED'].map((s) => '<option value="' + s + '"' + (String(t.Status).toUpperCase() === s ? ' selected' : '') + '>' + s + '</option>').join('') +
                      '</select>' +
                      (t.Form_ID ? '<button type="button" class="gpn-btn gpn-btn-primary gpn-btn-sm btnSyncForm" data-id="' + esc(t.Test_ID) + '">Sync</button>' : '') +
                      '<button type="button" class="gpn-btn gpn-btn-ok gpn-btn-sm btnPubTest" data-id="' + esc(t.Test_ID) + '">Publish</button>' +
                    '</div></td>' +
                  '</tr>'
                ).join('')
              : '<tr><td colspan="6">' + empty('No online tests created yet.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>';

    el.querySelector('#btnNewTest').addEventListener('click', () => {
      openModal('Create Online Test',
        '<form id="frmOnTest">' +
          '<div class="gpn-field"><label>Test Title *</label><input class="gpn-input" id="ntTitle" required placeholder="e.g. Class 10 Science Ch 1 Quiz"></div>' +
          '<div class="gpn-form-row gpn-mt">' +
            '<div class="gpn-field"><label>Class</label><input class="gpn-input" id="ntClass" placeholder="Class 10"></div>' +
            '<div class="gpn-field"><label>Subject ID / Name</label><input class="gpn-input" id="ntSub" placeholder="Science"></div>' +
            '<div class="gpn-field"><label>Programme ID (optional)</label><input class="gpn-input" id="ntProg" placeholder="PRG001"></div>' +
          '</div>' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Total Marks (0 = auto from Form)</label><input class="gpn-input" type="number" id="ntMarks" value="0"></div>' +
            '<div class="gpn-field"><label>Duration (min)</label><input class="gpn-input" type="number" id="ntDur" value="45"></div>' +
            '<div class="gpn-field"><label>Wallet Fee (₹)</label><input class="gpn-input" type="number" id="ntPrice" value="0"></div>' +
            '<div class="gpn-field"><label>Retest Gap (hrs)</label><input class="gpn-input" type="number" id="ntGap" value="3"></div>' +
          '</div>' +
          '<button type="submit" class="gpn-btn gpn-btn-gold gpn-mt">Create Draft Test</button>' +
        '</form>'
      );
      document.getElementById('frmOnTest').addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await GPN.api('online.tests.create', {
          Title: document.getElementById('ntTitle').value.trim(),
          Class: document.getElementById('ntClass').value.trim(),
          Subject_ID: document.getElementById('ntSub').value.trim(),
          Programme_ID: document.getElementById('ntProg').value.trim(),
          Total_Marks: Number(document.getElementById('ntMarks').value || 0),
          Duration_Min: Number(document.getElementById('ntDur').value || 45),
          Price: Number(document.getElementById('ntPrice').value || 0),
          Gap_Hours: Number(document.getElementById('ntGap').value || 3)
        });
        if (r.ok) { closeModal(true); toast('Test ' + r.data.Test_ID + ' created.', 'ok'); renderTests(el); }
        else toast(r.error, 'err');
      });
    });

    el.querySelector('#btnManSub').addEventListener('click', () => {
      openModal('Manual Test Score Entry (Handwritten / WhatsApp PDF)',
        '<form id="frmManSub">' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Test *</label><select class="gpn-select" id="msTest" required>' +
              tests.map((t) => '<option value="' + esc(t.Test_ID) + '">' + esc(t.Test_ID) + ' — ' + esc(t.Title) + '</option>').join('') +
            '</select></div>' +
            '<div class="gpn-field"><label>Student ID *</label><input class="gpn-input" id="msSid" required placeholder="ST001"></div>' +
          '</div>' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Marks Obtained *</label><input class="gpn-input" type="number" step="0.5" id="msObt" required></div>' +
            '<div class="gpn-field"><label>Max Marks</label><input class="gpn-input" type="number" id="msMax" placeholder="Uses Test Total"></div>' +
            '<div class="gpn-field"><label>Test Date</label><input class="gpn-input" type="date" id="msDate"></div>' +
          '</div>' +
          '<div class="gpn-field"><label>Evidence Link / Notes (optional)</label><input class="gpn-input" id="msEv" placeholder="Drive / WhatsApp ref"></div>' +
          '<label class="gpn-flex gpn-mt"><input type="checkbox" id="msPub" checked> Publish result to student dashboard immediately</label>' +
          '<button type="submit" class="gpn-btn gpn-btn-gold gpn-mt">Save Manual Score</button>' +
        '</form>'
      );
      document.getElementById('frmManSub').addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await GPN.api('online.tests.manualSubmit', {
          testId: document.getElementById('msTest').value,
          studentId: document.getElementById('msSid').value.trim().toUpperCase(),
          marksObtained: Number(document.getElementById('msObt').value),
          maxMarks: document.getElementById('msMax').value ? Number(document.getElementById('msMax').value) : undefined,
          testDate: document.getElementById('msDate').value,
          evidenceUrl: document.getElementById('msEv').value.trim(),
          publishNow: document.getElementById('msPub').checked
        });
        if (r.ok) { closeModal(true); toast('Saved! Score: ' + r.data.Percentage + '%', 'ok'); }
        else toast(r.error, 'err');
      });
    });

    el.querySelectorAll('.btnBuildForm').forEach((btn) => {
      btn.addEventListener('click', () => openFormBuilderModal(btn.dataset.id, btn.dataset.title, () => renderTests(el)));
    });

    el.querySelectorAll('.selTestSt').forEach((sel) => {
      sel.addEventListener('change', async () => {
        const r = await GPN.api('online.tests.setStatus', { testId: sel.dataset.id, status: sel.value });
        if (r.ok) { toast(sel.dataset.id + ' → ' + sel.value, 'ok'); renderTests(el); }
        else { toast(r.error, 'err'); renderTests(el); }
      });
    });

    el.querySelectorAll('.btnSyncForm').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Syncing...';
        const r = await GPN.api('online.tests.sync', { testId: btn.dataset.id });
        btn.disabled = false;
        btn.textContent = 'Sync';
        if (r.ok) toast('Synced! Processed: ' + r.data.processed + ', Rejected: ' + r.data.rejected, 'ok');
        else toast(r.error, 'err');
      });
    });

    el.querySelectorAll('.btnPubTest').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Publish all graded results for ' + btn.dataset.id + ' to students?')) return;
        const r = await GPN.api('online.results.publish', { testId: btn.dataset.id });
        if (r.ok) { toast('Published ' + r.data.published + ' result(s).', 'ok'); renderTests(el); }
        else toast(r.error, 'err');
      });
    });
  }

  function openFormBuilderModal(testId, title, onDone) {
    openModal('Auto-Generate Google Form — ' + testId,
      '<div class="gpn-alert">Creates a Quiz Google Form inside <strong>GPN-TESTS-DB</strong> with mandatory Student ID & 6-char Submission Code block.</div>' +
      '<p class="gpn-muted" style="font-size:0.8rem"><strong>Syntax (1 question per line):</strong><br>' +
      '<code>MCQ | Question text | OptA; OptB; OptC; OptD | CorrectIndex(0-3) | Marks</code><br>' +
      '<code>CHECK | Question | OptA; OptB; OptC | 0,2 | Marks</code><br>' +
      '<code>TF | Statement | true | Marks</code><br>' +
      '<code>ONE | One-word question | Key | Marks</code><br>' +
      '<code>SHORT | Short answer question | Marks</code> or <code>LONG | Long answer | Marks</code></p>' +
      '<form id="frmBuildQuiz">' +
        '<div class="gpn-field"><label>Form Title</label><input class="gpn-input" id="fbTitle" value="' + esc(title) + '"></div>' +
        '<div class="gpn-field gpn-mt"><label>Questions Block *</label><textarea class="gpn-textarea" id="fbBlock" style="min-height:180px" required placeholder="MCQ | What is HCF(12,18)? | 2; 3; 6; 12 | 2 | 1\nSHORT | Explain Euclid division lemma. | 3"></textarea></div>' +
        '<button type="submit" class="gpn-btn gpn-btn-gold gpn-mt" id="btnRunBuildForm">Generate Google Form</button>' +
      '</form>'
    );

    document.getElementById('frmBuildQuiz').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btnRunBuildForm');
      btn.disabled = true;
      btn.textContent = 'Building Google Form...';

      const r = await GPN.api('online.tests.createForm', {
        testId,
        title: document.getElementById('fbTitle').value.trim(),
        questionsBlock: document.getElementById('fbBlock').value
      });

      btn.disabled = false;
      btn.textContent = 'Generate Google Form';
      if (!r.ok) { toast(r.error, 'err'); return; }

      closeModal(true);
      openModal('Google Form Created & Linked',
        '<p><strong>Total Marks:</strong> ' + esc(r.data.grandMax) + ' (Auto: ' + esc(r.data.autoMax) + ', Manual: ' + esc(r.data.manualMax) + ')</p>' +
        '<div class="gpn-flex"><a class="gpn-btn gpn-btn-primary" href="' + esc(r.data.Form_URL) + '" target="_blank" rel="noopener">Student Form URL</a>' +
        '<a class="gpn-btn gpn-btn-outline" href="' + esc(r.data.Edit_URL) + '" target="_blank" rel="noopener">Edit in Google Forms</a></div>' +
        (r.data.warnings && r.data.warnings.length ? '<div class="gpn-alert gpn-alert-warn gpn-mt">' + r.data.warnings.map(esc).join('<br>') + '</div>' : '')
      );
      onDone();
    });
  }

  /* ---- 2. SUBJECTIVE EVALUATION ---- */
  async function renderEvaluation(el) {
    el.innerHTML = loading('Loading pending subjective evaluations...');
    const res = await GPN.api('online.eval.pending');
    if (!res.ok) { el.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(res.error) + '</div>'; return; }
    const list = (res.data && res.data.pending) || [];

    el.innerHTML =
      '<div class="gpn-card">' +
        '<div class="gpn-card-header"><h3 class="gpn-card-title">Pending Subjective Evaluations (' + list.length + ')</h3></div>' +
        '<div class="gpn-scroll-frame">' +
          '<table class="gpn-table"><thead><tr><th>Attempt</th><th>Test ID</th><th>Student</th><th>Submitted At</th><th>Action</th></tr></thead><tbody>' +
            (list.length
              ? list.map((a) =>
                  '<tr>' +
                    '<td><strong>' + esc(a.Attempt_ID) + '</strong></td>' +
                    '<td>' + esc(a.Test_ID) + '</td>' +
                    '<td>' + esc(a.Student_ID) + '</td>' +
                    '<td>' + esc(a.Submitted_At) + '</td>' +
                    '<td><button type="button" class="gpn-btn gpn-btn-gold gpn-btn-sm btnGradeAtt" data-id="' + esc(a.Attempt_ID) + '">Grade Answers</button></td>' +
                  '</tr>'
                ).join('')
              : '<tr><td colspan="5">' + empty('All submitted attempts are evaluated!') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>';

    el.querySelectorAll('.btnGradeAtt').forEach((btn) => {
      btn.addEventListener('click', () => openEvalModal(btn.dataset.id, () => renderEvaluation(el)));
    });
  }

  async function openEvalModal(attemptId, onDone) {
    openModal('Grade Attempt — ' + attemptId, loading('Loading student answers...'));
    const res = await GPN.api('online.eval.get', { attemptId });
    const body = document.getElementById('gpnModalBody');
    if (!res.ok) { body.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(res.error) + '</div>'; return; }

    const answers = (res.data && res.data.answers) || [];
    const manual = answers.filter((a) => a.Evaluation_Mode === 'MANUAL');
    const autoSum = answers.filter((a) => a.Evaluation_Mode === 'AUTO').reduce((s, a) => s + Number(a.Auto_Marks || 0), 0);

    body.innerHTML =
      '<div class="gpn-alert">Auto-graded MCQ score: <strong>' + autoSum + '</strong> • Subjective questions: <strong>' + manual.length + '</strong></div>' +
      '<div class="gpn-scroll-frame compact">' +
        (manual.length
          ? manual.map((a) =>
              '<div class="gpn-card evRow" data-aid="' + esc(a.Answer_ID) + '" style="margin:8px">' +
                '<div><strong>' + esc(a.Question_Title) + '</strong> <span class="gpn-badge gpn-badge-gold">Max: ' + esc(a.Max_Points || '?') + '</span></div>' +
                '<div style="background:#0A192F;padding:8px;border-radius:6px;margin:8px 0;white-space:pre-wrap">' + esc(a.Student_Answer || '(Blank)') + '</div>' +
                '<div class="gpn-form-row">' +
                  '<div class="gpn-field"><label>Marks Awarded</label><input class="gpn-input evMark" type="number" step="0.5" min="0" value="' + esc(a.Manual_Marks !== '' ? a.Manual_Marks : 0) + '"></div>' +
                  '<div class="gpn-field"><label>Remark</label><input class="gpn-input evRem" value="' + esc(a.Evaluator_Remark || '') + '" placeholder="Feedback"></div>' +
                '</div>' +
              '</div>'
            ).join('')
          : empty('No manual questions in this attempt.')) +
      '</div>' +
      '<div class="gpn-flex gpn-mt">' +
        '<button type="button" class="gpn-btn gpn-btn-gold" id="btnSaveEval">Save Marks</button>' +
        '<button type="button" class="gpn-btn gpn-btn-ok" id="btnSavePubEval">Save & Publish Result</button>' +
      '</div>';

    async function saveEval(publishAfter) {
      const evaluations = Array.from(body.querySelectorAll('.evRow')).map((row) => ({
        answerId: row.dataset.aid,
        marks: Number(row.querySelector('.evMark').value || 0),
        remark: row.querySelector('.evRem').value.trim()
      }));
      const sv = await GPN.api('online.eval.submit', { attemptId, evaluations });
      if (!sv.ok) { toast(sv.error, 'err'); return; }
      if (publishAfter) {
        await GPN.api('online.results.publish', { attemptId });
        toast('Evaluated & Published! Total: ' + sv.data.totalObtained + '/' + sv.data.maxMarks, 'ok');
      } else {
        toast('Saved! Total: ' + sv.data.totalObtained + '/' + sv.data.maxMarks, 'ok');
      }
      closeModal(true);
      onDone();
    }

    document.getElementById('btnSaveEval').addEventListener('click', () => saveEval(false));
    document.getElementById('btnSavePubEval').addEventListener('click', () => saveEval(true));
  }

  /* ---- 3. PROGRAMMES, ENROLMENTS & 1-ON-1 SCHEDULE ---- */
  async function renderProgrammes(el) {
    el.innerHTML = loading('Loading programmes & schedule...');
    const [pRes, sRes] = await Promise.all([GPN.api('online.programmes.list'), GPN.api('online.sessions.list')]);
    const progs = (pRes.ok && pRes.data && pRes.data.programmes) || [];
    const sess = (sRes.ok && sRes.data && sRes.data.sessions) || [];

    el.innerHTML =
      '<div class="gpn-card">' +
        '<div class="gpn-card-header">' +
          '<h3 class="gpn-card-title">Online Programmes (' + progs.length + ')</h3>' +
          '<div class="gpn-flex">' +
            '<button type="button" class="gpn-btn gpn-btn-outline gpn-btn-sm" id="btnEnrolSt">+ Enrol Student</button>' +
            '<button type="button" class="gpn-btn gpn-btn-gold gpn-btn-sm" id="btnNewProg">+ Create Programme</button>' +
          '</div>' +
        '</div>' +
        '<div class="gpn-scroll-frame compact">' +
          '<table class="gpn-table"><thead><tr><th>ID</th><th>Programme</th><th>Class / Board</th><th>Weeks</th><th>Status</th></tr></thead><tbody>' +
            (progs.length
              ? progs.map((p) => '<tr><td><strong>' + esc(p.Programme_ID) + '</strong></td><td>' + esc(p.Name) + '</td><td>' + esc(p.Class) + ' • ' + esc(p.Board) + '</td><td>' + esc(p.Num_Weeks) + 'w</td><td>' + statusBadge(p.Status) + '</td></tr>').join('')
              : '<tr><td colspan="5">' + empty('No programmes created.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>' +
      '<div class="gpn-card">' +
        '<div class="gpn-card-header">' +
          '<h3 class="gpn-card-title">1-on-1 Classes & Scheduled Exam Windows (' + sess.length + ')</h3>' +
          '<button type="button" class="gpn-btn gpn-btn-primary gpn-btn-sm" id="btnNewSess">+ Schedule Session / Exam Window</button>' +
        '</div>' +
        '<div class="gpn-scroll-frame compact">' +
          '<table class="gpn-table"><thead><tr><th>ID</th><th>Date & Time</th><th>Type</th><th>Student / Ref</th><th>Link</th><th>Status</th></tr></thead><tbody>' +
            (sess.length
              ? sess.map((s) =>
                  '<tr>' +
                    '<td>' + esc(s.Session_ID) + '</td>' +
                    '<td><strong>' + esc(s.Date) + '</strong> ' + esc(s.Start_Time) + '–' + esc(s.End_Time) + '</td>' +
                    '<td>' + statusBadge(s.Type) + '</td>' +
                    '<td>' + esc(s.Student_ID || 'All') + (s.Ref_ID ? ' • Ref: <code>' + esc(s.Ref_ID) + '</code>' : '') + '</td>' +
                    '<td>' + (s.Meeting_Link ? '<a href="' + esc(s.Meeting_Link) + '" target="_blank" rel="noopener">Join ↗</a>' : '-') + '</td>' +
                    '<td>' + statusBadge(s.Status) + '</td>' +
                  '</tr>'
                ).join('')
              : '<tr><td colspan="6">' + empty('No sessions scheduled yet.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>';

    el.querySelector('#btnNewProg').addEventListener('click', () => {
      openModal('Create Online Programme',
        '<form id="frmProg">' +
          '<div class="gpn-field"><label>Programme Name *</label><input class="gpn-input" id="prName" required></div>' +
          '<div class="gpn-form-row gpn-mt">' +
            '<div class="gpn-field"><label>Class</label><input class="gpn-input" id="prCls" placeholder="Class 10"></div>' +
            '<div class="gpn-field"><label>Board</label><input class="gpn-input" id="prBrd" value="CBSE"></div>' +
            '<div class="gpn-field"><label>Weeks</label><input class="gpn-input" type="number" id="prWks" value="12"></div>' +
          '</div>' +
          '<button type="submit" class="gpn-btn gpn-btn-gold gpn-mt">Create</button>' +
        '</form>'
      );
      document.getElementById('frmProg').addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await GPN.api('online.programmes.create', {
          Name: document.getElementById('prName').value.trim(),
          Class: document.getElementById('prCls').value.trim(),
          Board: document.getElementById('prBrd').value.trim(),
          Num_Weeks: Number(document.getElementById('prWks').value || 12)
        });
        if (r.ok) { closeModal(true); toast('Created ' + r.data.Programme_ID, 'ok'); renderProgrammes(el); }
        else toast(r.error, 'err');
      });
    });

    el.querySelector('#btnEnrolSt').addEventListener('click', () => {
      openModal('Enrol Student in Programme',
        '<form id="frmEnr">' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Student ID *</label><input class="gpn-input" id="enSid" required placeholder="ST001"></div>' +
            '<div class="gpn-field"><label>Programme *</label><select class="gpn-select" id="enPrg" required>' +
              progs.map((p) => '<option value="' + esc(p.Programme_ID) + '">' + esc(p.Programme_ID) + ' — ' + esc(p.Name) + '</option>').join('') +
            '</select></div>' +
          '</div>' +
          '<div class="gpn-field"><label>Start Date (blank = today)</label><input class="gpn-input" type="date" id="enStart"></div>' +
          '<button type="submit" class="gpn-btn gpn-btn-gold gpn-mt">Enrol & Enable Online Access</button>' +
        '</form>'
      );
      document.getElementById('frmEnr').addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await GPN.api('online.enrolments.create', {
          Student_ID: document.getElementById('enSid').value.trim().toUpperCase(),
          Programme_ID: document.getElementById('enPrg').value,
          Start_Date: document.getElementById('enStart').value
        });
        if (r.ok) { closeModal(true); toast('Enrolled ' + r.data.Enrolment_ID, 'ok'); }
        else toast(r.error, 'err');
      });
    });

    el.querySelector('#btnNewSess').addEventListener('click', () => {
      openModal('Schedule Session / Dual-Window Test',
        '<form id="frmSess">' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Type *</label><select class="gpn-select" id="scType"><option value="1-on-1">1-on-1</option><option value="Class">Class</option><option value="Test">Test (Activates 3-hr Dual Window)</option><option value="Revision">Revision</option></select></div>' +
            '<div class="gpn-field"><label>Date *</label><input class="gpn-input" type="date" id="scDate" required></div>' +
          '</div>' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Start Time (24h)</label><input class="gpn-input" id="scStart" value="17:00"></div>' +
            '<div class="gpn-field"><label>End Time (24h)</label><input class="gpn-input" id="scEnd" value="18:00"></div>' +
          '</div>' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Student ID (blank = all)</label><input class="gpn-input" id="scSid" placeholder="ST001"></div>' +
            '<div class="gpn-field"><label>Ref Test ID (for Type=Test)</label><input class="gpn-input" id="scRef" placeholder="TST0001"></div>' +
          '</div>' +
          '<div class="gpn-field"><label>Meeting Link (optional)</label><input class="gpn-input" id="scLink" placeholder="https://meet.google.com/..."></div>' +
          '<div class="gpn-field gpn-mt"><label>Notes</label><input class="gpn-input" id="scNotes"></div>' +
          '<button type="submit" class="gpn-btn gpn-btn-gold gpn-mt">Save Schedule</button>' +
        '</form>'
      );
      document.getElementById('frmSess').addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await GPN.api('online.sessions.create', {
          Type: document.getElementById('scType').value,
          Date: document.getElementById('scDate').value,
          Start_Time: document.getElementById('scStart').value.trim(),
          End_Time: document.getElementById('scEnd').value.trim(),
          Student_ID: document.getElementById('scSid').value.trim().toUpperCase(),
          Ref_ID: document.getElementById('scRef').value.trim().toUpperCase(),
          Meeting_Link: document.getElementById('scLink').value.trim(),
          Notes: document.getElementById('scNotes').value.trim()
        });
        if (r.ok) { closeModal(true); toast('Scheduled ' + r.data.Session_ID, 'ok'); renderProgrammes(el); }
        else toast(r.error, 'err');
      });
    });
  }

  /* ---- 4. WALLET CREDIT ---- */
  function renderWallet(el) {
    el.innerHTML =
      '<div class="gpn-card">' +
        '<h3 class="gpn-card-title">Credit Student Exam Wallet</h3>' +
        '<p class="gpn-muted">Add verified UPI / Cash balance for paid online tests. (Note: strict No Auto-Refund policy applies once an exam token is issued.)</p>' +
        '<form id="frmWallet">' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Student ID *</label><input class="gpn-input" id="wlSid" required placeholder="ST001"></div>' +
            '<div class="gpn-field"><label>Amount (₹) *</label><input class="gpn-input" type="number" min="1" id="wlAmt" required></div>' +
            '<div class="gpn-field"><label>Method</label><select class="gpn-select" id="wlMeth"><option value="UPI">UPI</option><option value="CASH">CASH</option><option value="BANK">BANK</option></select></div>' +
          '</div>' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Payment Reference</label><input class="gpn-input" id="wlRef" placeholder="UTR / Receipt Ref"></div>' +
            '<div class="gpn-field"><label>Notes</label><input class="gpn-input" id="wlNotes" placeholder="Wallet top-up"></div>' +
          '</div>' +
          '<button type="submit" class="gpn-btn gpn-btn-ok">Credit Wallet Now</button>' +
        '</form>' +
        '<div id="wlOut" class="gpn-mt"></div>' +
      '</div>';

    el.querySelector('#frmWallet').addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await GPN.api('online.wallet.credit', {
        studentId: el.querySelector('#wlSid').value.trim().toUpperCase(),
        amount: Number(el.querySelector('#wlAmt').value),
        method: el.querySelector('#wlMeth').value,
        reference: el.querySelector('#wlRef').value.trim(),
        notes: el.querySelector('#wlNotes').value.trim()
      });
      if (r.ok) {
        toast('Wallet credited!', 'ok');
        el.querySelector('#wlOut').innerHTML =
          '<div class="gpn-alert">Entry <strong>' + esc(r.data.Entry_ID) + '</strong> saved. New Balance: <strong>' + formatINR(r.data.Balance_After) + '</strong></div>';
        e.target.reset();
      } else toast(r.error, 'err');
    });
  }

  window.GPN_MODULES = window.GPN_MODULES || {};
  window.GPN_MODULES['admin-online'] = { render };
})();
