/* ============================================================================
 * GPN CENTRAL SYSTEM 2026 — Unified Students, Bulk Register, Parents & Contacts
 * ============================================================================ */

(function () {
  'use strict';

  const { esc, formatINR, statusBadge, toast, openModal, closeModal, printHtml, loading, empty } = GPN.ui;

  const CLASSES = [
    'Nursery', 'LKG', 'UKG',
    'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
    'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
    'Class 11', 'Class 12', 'NEET', 'IIT JEE', 'Other'
  ];

  async function render(container) {
    let activeTab = 'students';

    container.innerHTML =
      '<div class="gpn-subtabs">' +
        '<button type="button" class="gpn-subtab active" data-tab="students">Unified Students</button>' +
        '<button type="button" class="gpn-subtab" data-tab="bulk">Bulk / Batch Register</button>' +
        '<button type="button" class="gpn-subtab" data-tab="parents">Parents</button>' +
        '<button type="button" class="gpn-subtab" data-tab="contacts">Permanent Contact Directory</button>' +
      '</div>' +
      '<div id="stContent">' + loading('Loading...') + '</div>';

    const contentEl = container.querySelector('#stContent');

    container.querySelectorAll('.gpn-subtab').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        container.querySelectorAll('.gpn-subtab').forEach((b) => b.classList.toggle('active', b === btn));
        loadTab();
      });
    });

    function loadTab() {
      if (activeTab === 'students') return renderStudents(contentEl);
      if (activeTab === 'bulk') return renderBulkRegister(contentEl);
      if (activeTab === 'parents') return renderParents(contentEl);
      if (activeTab === 'contacts') return renderContacts(contentEl);
    }

    loadTab();
  }

  /* ---- 1. UNIFIED STUDENTS ---- */
  async function renderStudents(el) {
    el.innerHTML =
      '<div class="gpn-card">' +
        '<div class="gpn-card-header">' +
          '<h3 class="gpn-card-title">Unified Students Directory</h3>' +
          '<button type="button" class="gpn-btn gpn-btn-gold gpn-btn-sm" id="btnNewStudent">+ Add Student</button>' +
        '</div>' +
        '<div class="gpn-toolbar">' +
          '<input class="gpn-input" id="fStSearch" placeholder="Search ID, name, phone, school..." style="max-width:250px">' +
          '<select class="gpn-select" id="fStStatus" style="max-width:130px"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ALL">All Status</option></select>' +
          '<select class="gpn-select" id="fStMode" style="max-width:130px"><option value="ALL">All Modes</option><option value="OFFLINE">Offline</option><option value="ONLINE">Online</option><option value="BOTH">Both</option></select>' +
          '<select class="gpn-select" id="fStTeacher" style="max-width:130px"><option value="ALL">All Teachers</option><option value="T001">T001</option><option value="T002">T002</option></select>' +
          '<button type="button" class="gpn-btn gpn-btn-primary gpn-btn-sm" id="btnStFilter">Search</button>' +
        '</div>' +
        '<div id="stTableWrap">' + loading('Loading students...') + '</div>' +
      '</div>';

    el.querySelector('#btnNewStudent').addEventListener('click', () => openStudentModal(null, fetchList));
    el.querySelector('#btnStFilter').addEventListener('click', fetchList);
    el.querySelector('#fStSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchList(); });

    async function fetchList() {
      const wrap = el.querySelector('#stTableWrap');
      wrap.innerHTML = loading('Fetching students...');
      const res = await GPN.api('master.students.list', {
        search: el.querySelector('#fStSearch').value.trim(),
        status: el.querySelector('#fStStatus').value,
        mode: el.querySelector('#fStMode').value,
        teacherId: el.querySelector('#fStTeacher').value
      });
      if (!res.ok) { wrap.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(res.error) + '</div>'; return; }

      const list = (res.data && res.data.students) || [];
      if (!list.length) { wrap.innerHTML = empty('No students found matching your filter.'); return; }

      wrap.innerHTML =
        '<div class="gpn-muted" style="margin-bottom:8px">Showing ' + list.length + ' student(s)</div>' +
        '<div class="gpn-scroll-frame">' +
          '<table class="gpn-table"><thead><tr>' +
            '<th>ID</th><th>Student & Parent</th><th>Class / Batch</th><th>Mode / Teacher</th><th>Fee / DOJ</th><th>Status</th><th>Actions</th>' +
          '</tr></thead><tbody>' +
            list.map((s) =>
              '<tr>' +
                '<td><strong>' + esc(s.Student_ID) + '</strong></td>' +
                '<td><div><strong>' + esc(s.Student_Name) + '</strong></div><div class="gpn-muted">' + esc(s.Father_Name || '-') + ' • ' + esc(s.Parent_Phone || '') + '</div></td>' +
                '<td><div>' + esc(s.Class || '-') + '</div><div class="gpn-muted">' + esc(s.Batch_Name || 'No Batch') + '</div></td>' +
                '<td><div>' + statusBadge(s.Mode) + '</div><div class="gpn-muted">' + esc(s.Teacher_ID) + '</div></td>' +
                '<td><div>' + formatINR(s.Monthly_Fee) + '</div><div class="gpn-muted">' + esc(s.DOJ || '') + '</div></td>' +
                '<td>' + statusBadge(s.Student_Status) + '</td>' +
                '<td><div class="gpn-flex">' +
                  '<button type="button" class="gpn-btn gpn-btn-outline gpn-btn-sm btnEdSt" data-id="' + esc(s.Student_ID) + '">Edit</button>' +
                  '<button type="button" class="gpn-btn gpn-btn-outline gpn-btn-sm btnRpSt" data-id="' + esc(s.Student_ID) + '">Report</button>' +
                  '<button type="button" class="gpn-btn gpn-btn-outline gpn-btn-sm btnPwSt" data-id="' + esc(s.Student_ID) + '">Reset PW</button>' +
                '</div></td>' +
              '</tr>'
            ).join('') +
          '</tbody></table>' +
        '</div>';

      wrap.querySelectorAll('.btnEdSt').forEach((b) => {
        b.addEventListener('click', () => {
          const st = list.find((x) => x.Student_ID === b.dataset.id);
          if (st) openStudentModal(st, fetchList);
        });
      });

      wrap.querySelectorAll('.btnRpSt').forEach((b) => {
        b.addEventListener('click', () => printStudentReportCard(b.dataset.id));
      });

      wrap.querySelectorAll('.btnPwSt').forEach((b) => {
        b.addEventListener('click', () => resetUserPw('STUDENT', b.dataset.id));
      });
    }

    fetchList();
  }

  function openStudentModal(st, onSaved) {
    const isEdit = Boolean(st);
    const s = st || {};
    const clsOpts = CLASSES.map((c) => '<option value="' + esc(c) + '"' + (s.Class === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');

    openModal(isEdit ? 'Edit Student — ' + s.Student_ID : 'Register New Student',
      '<form id="frmStudent">' +
        '<div class="gpn-form-row">' +
          '<div class="gpn-field"><label>Student Name *</label><input class="gpn-input" id="sName" value="' + esc(s.Student_Name || '') + '" required></div>' +
          '<div class="gpn-field"><label>Father / Parent Name</label><input class="gpn-input" id="sFather" value="' + esc(s.Father_Name || '') + '"></div>' +
        '</div>' +
        '<div class="gpn-form-row">' +
          '<div class="gpn-field"><label>Parent Phone (10-digit) *</label><input class="gpn-input" id="sPhone" value="' + esc(s.Parent_Phone || '') + '" required></div>' +
          '<div class="gpn-field"><label>Parent WhatsApp (10-digit)</label><input class="gpn-input" id="sWa" value="' + esc(s.Parent_WhatsApp || '') + '" placeholder="Same as phone if blank"></div>' +
        '</div>' +
        '<div class="gpn-form-row">' +
          '<div class="gpn-field"><label>Class</label><select class="gpn-select" id="sClass">' + clsOpts + '</select></div>' +
          '<div class="gpn-field"><label>School Name</label><input class="gpn-input" id="sSchool" value="' + esc(s.School_Name || '') + '"></div>' +
        '</div>' +
        '<div class="gpn-form-row">' +
          '<div class="gpn-field"><label>Mode</label><select class="gpn-select" id="sMode">' +
            ['OFFLINE', 'ONLINE', 'BOTH'].map((m) => '<option value="' + m + '"' + (s.Mode === m ? ' selected' : '') + '>' + m + '</option>').join('') +
          '</select></div>' +
          '<div class="gpn-field"><label>Teacher</label><select class="gpn-select" id="sTeacher">' +
            '<option value="T001"' + (s.Teacher_ID === 'T001' ? ' selected' : '') + '>T001 — Super Admin</option>' +
            '<option value="T002"' + (s.Teacher_ID === 'T002' ? ' selected' : '') + '>T002 — Academic Head</option>' +
          '</select></div>' +
        '</div>' +
        '<div class="gpn-form-row">' +
          '<div class="gpn-field"><label>Monthly Fee (₹)</label><input class="gpn-input" type="number" min="0" id="sFee" value="' + esc(s.Monthly_Fee != null ? s.Monthly_Fee : 0) + '"></div>' +
          '<div class="gpn-field"><label>DOJ (e.g. 21-Oct-2026)</label><input class="gpn-input" id="sDoj" value="' + esc(s.DOJ || '') + '" placeholder="Leave blank for today"></div>' +
        '</div>' +
        '<div class="gpn-form-row">' +
          '<div class="gpn-field"><label>Batch Name</label><input class="gpn-input" id="sBatch" value="' + esc(s.Batch_Name || '') + '"></div>' +
          '<div class="gpn-field"><label>Status</label><select class="gpn-select" id="sStatus">' +
            '<option value="ACTIVE"' + (s.Student_Status !== 'INACTIVE' ? ' selected' : '') + '>ACTIVE</option>' +
            '<option value="INACTIVE"' + (s.Student_Status === 'INACTIVE' ? ' selected' : '') + '>INACTIVE</option>' +
          '</select></div>' +
        '</div>' +
        '<div class="gpn-field"><label>Parent Email / Notes</label><input class="gpn-input" id="sEmail" value="' + esc(s.Parent_Email || '') + '" placeholder="Parent email (optional)"></div>' +
        '<div class="gpn-field gpn-mt"><label>Notes</label><input class="gpn-input" id="sNotes" value="' + esc(s.Notes || '') + '"></div>' +
        '<div class="gpn-flex gpn-mt"><button type="submit" class="gpn-btn gpn-btn-gold" id="btnSaveSt">' + (isEdit ? 'Save Changes' : 'Create Student & Auto-Link Parent') + '</button></div>' +
      '</form>'
    );

    document.getElementById('frmStudent').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btnSaveSt');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      const payload = {
        Student_Name: document.getElementById('sName').value.trim(),
        Father_Name: document.getElementById('sFather').value.trim(),
        Parent_Phone: document.getElementById('sPhone').value.trim(),
        Parent_WhatsApp: document.getElementById('sWa').value.trim() || document.getElementById('sPhone').value.trim(),
        Class: document.getElementById('sClass').value,
        School_Name: document.getElementById('sSchool').value.trim(),
        Mode: document.getElementById('sMode').value,
        Teacher_ID: document.getElementById('sTeacher').value,
        Monthly_Fee: Number(document.getElementById('sFee').value || 0),
        DOJ: document.getElementById('sDoj').value.trim(),
        Batch_Name: document.getElementById('sBatch').value.trim(),
        Student_Status: document.getElementById('sStatus').value,
        Parent_Email: document.getElementById('sEmail').value.trim(),
        Notes: document.getElementById('sNotes').value.trim()
      };

      const res = isEdit
        ? await GPN.api('master.students.update', { studentId: s.Student_ID, patch: payload })
        : await GPN.api('master.students.create', payload);

      btn.disabled = false;
      if (!res.ok) { toast(res.error, 'err'); btn.textContent = isEdit ? 'Save Changes' : 'Create Student'; return; }

      closeModal(true);
      if (!isEdit) {
        openModal('Student Created Successfully',
          '<div class="gpn-alert">Share these first-login credentials with the student/parent (forced password change on first login):</div>' +
          '<p><strong>Student ID:</strong> ' + esc(res.data.Student_ID) + '<br><strong>Default Password:</strong> <code>' + esc(res.data.Default_Password) + '</code></p>' +
          (res.data.Parent ? '<p><strong>Parent Portal ID:</strong> ' + esc(res.data.Parent.parentId) + (res.data.Parent.created ? ' (Default PW: <code>' + esc(res.data.Parent.defaultPassword) + '</code>)' : ' (Linked to existing parent)') + '</p>' : '')
        );
      } else {
        toast('Student updated.', 'ok');
      }
      if (onSaved) onSaved();
    });
  }

  async function resetUserPw(userType, userId) {
    if (!confirm('Generate a new temporary password for ' + userType + ' ' + userId + '?')) return;
    const res = await GPN.api('master.users.resetPassword', { userType, userId });
    if (!res.ok) { toast(res.error, 'err'); return; }
    openModal('Temporary Password Generated',
      '<div class="gpn-alert gpn-alert-warn">User will be forced to set a new password immediately on next login.</div>' +
      '<p><strong>User ID:</strong> ' + esc(res.data.userId) + '<br><strong>Temporary Password:</strong> <code style="font-size:1.1rem">' + esc(res.data.temporaryPassword) + '</code></p>'
    );
  }

  async function printStudentReportCard(studentId) {
    toast('Generating report card...', 'ok');
    const res = await GPN.api('reports.studentCard', { studentId });
    if (!res.ok) { toast(res.error, 'err'); return; }
    const d = res.data;
    const s = d.student || {};

    const scoreRows = (d.scores || []).map((sc) =>
      '<tr><td>' + esc(sc.Date) + '</td><td>' + esc(sc.Mode) + '</td><td>' + esc(sc.Title) + '</td><td>' + esc(sc.Subject) + '</td><td>' + esc(sc.Marks) + ' / ' + esc(sc.Max) + '</td><td>' + esc(sc.Pct) + '%</td><td>' + esc(sc.Rank) + '</td></tr>'
    ).join('') || '<tr><td colspan="7">No tests recorded yet.</td></tr>';

    const feeRows = (d.fees || []).map((f) =>
      '<tr><td>' + esc(f.Cycle_Label) + '</td><td>' + esc(f.Due_Date) + '</td><td>' + formatINR(f.Cycle_Fee) + '</td><td>' + esc(f.Payment_Status) + '</td><td>' + esc(f.Receipt_No || '-') + '</td></tr>'
    ).join('') || '<tr><td colspan="5">No fee cycles recorded.</td></tr>';

    printHtml('Student Report — ' + s.Student_ID,
      '<div class="hdr"><img src="' + esc(d.brand.logo) + '"><div><h2>' + esc(d.brand.name) + ' — Student Report Card</h2><div class="meta">Session: ' + esc(d.brand.session) + ' • Generated: ' + esc(d.generatedAt) + '</div></div></div>' +
      '<table><tr><th>Student</th><td>' + esc(s.Student_Name) + ' (' + esc(s.Student_ID) + ')</td><th>Class / Batch</th><td>' + esc(s.Class) + ' / ' + esc(s.Batch_Name || '-') + '</td></tr>' +
      '<tr><th>Parent</th><td>' + esc(s.Father_Name || '-') + ' (' + esc(s.Parent_Phone || '') + ')</td><th>Attendance</th><td>' + esc(d.attendance.present) + ' / ' + esc(d.attendance.total) + ' (' + esc(d.attendance.pct) + '%)</td></tr></table>' +
      '<h3>Test Performance</h3><table><thead><tr><th>Date</th><th>Mode</th><th>Test</th><th>Subject</th><th>Score</th><th>%</th><th>Rank</th></tr></thead><tbody>' + scoreRows + '</tbody></table>' +
      '<h3>Fee Ledger</h3><table><thead><tr><th>Cycle</th><th>Due Date</th><th>Fee</th><th>Status</th><th>Receipt</th></tr></thead><tbody>' + feeRows + '</tbody></table>'
    );
  }

  /* ---- 2. BULK / BATCH REGISTER (UP TO 100) ---- */
  function renderBulkRegister(el) {
    el.innerHTML =
      '<div class="gpn-card">' +
        '<h3 class="gpn-card-title">Bulk / Batch Student Registration (Up to 100 at once)</h3>' +
        '<p class="gpn-muted">Paste one student per line using commas:<br><code>Student Name, Father Name, 10-digit Phone, Class, School Name, Monthly Fee, DOJ (optional)</code></p>' +
        '<div class="gpn-form-row">' +
          '<div class="gpn-field"><label>Default Mode</label><select class="gpn-select" id="bkMode"><option value="OFFLINE">OFFLINE</option><option value="ONLINE">ONLINE</option><option value="BOTH">BOTH</option></select></div>' +
          '<div class="gpn-field"><label>Default Teacher</label><select class="gpn-select" id="bkTeacher"><option value="T001">T001</option><option value="T002">T002</option></select></div>' +
          '<div class="gpn-field"><label>Default Batch Name</label><input class="gpn-input" id="bkBatch" placeholder="e.g. Class 10 Maths Evening"></div>' +
        '</div>' +
        '<div class="gpn-field"><label>Student Rows</label><textarea class="gpn-textarea" id="bkCsv" style="min-height:170px" placeholder="Aarav Sharma, Rajesh Sharma, 9876543210, Class 10, DPS Noida, 2500, 01-Apr-2026"></textarea></div>' +
        '<button type="button" class="gpn-btn gpn-btn-gold gpn-mt" id="btnBulkRun">Register Batch Now</button>' +
        '<div id="bkResult" class="gpn-mt"></div>' +
      '</div>';

    el.querySelector('#btnBulkRun').addEventListener('click', async (e) => {
      const lines = el.querySelector('#bkCsv').value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (!lines.length) { toast('Paste at least one student line.', 'warn'); return; }

      const students = lines.map((line) => {
        const p = line.split(',').map((x) => x.trim());
        return {
          Student_Name: p[0] || '',
          Father_Name: p[1] || '',
          Parent_Phone: p[2] || '',
          Class: p[3] || '',
          School_Name: p[4] || '',
          Monthly_Fee: Number(p[5] || 0),
          DOJ: p[6] || ''
        };
      });

      const btn = e.target;
      btn.disabled = true;
      btn.textContent = 'Registering ' + students.length + ' students...';

      const res = await GPN.api('master.students.bulkRegister', {
        defaultMode: el.querySelector('#bkMode').value,
        defaultTeacher: el.querySelector('#bkTeacher').value,
        defaultBatch: el.querySelector('#bkBatch').value.trim(),
        students
      });

      btn.disabled = false;
      btn.textContent = 'Register Batch Now';

      const out = el.querySelector('#bkResult');
      if (!res.ok) { out.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(res.error) + '</div>'; return; }

      const d = res.data;
      out.innerHTML =
        '<div class="gpn-alert">Created: <strong>' + d.createdCount + '</strong> • Failed: <strong>' + d.failedCount + '</strong></div>' +
        (d.created.length
          ? '<div class="gpn-scroll-frame compact"><table class="gpn-table"><thead><tr><th>Row</th><th>Student ID</th><th>Name</th><th>Default Password</th></tr></thead><tbody>' +
              d.created.map((c) => '<tr><td>' + c.row + '</td><td><strong>' + esc(c.Student_ID) + '</strong></td><td>' + esc(c.Student_Name) + '</td><td><code>' + esc(c.Default_Password) + '</code></td></tr>').join('') +
            '</tbody></table></div>'
          : '') +
        (d.errors.length
          ? '<div class="gpn-alert gpn-alert-err gpn-mt">' + d.errors.map((er) => 'Row ' + er.row + ' (' + esc(er.Student_Name) + '): ' + esc(er.error)).join('<br>') + '</div>'
          : '');
    });
  }

  /* ---- 3. PARENTS LIST ---- */
  async function renderParents(el) {
    el.innerHTML = loading('Loading parent accounts...');
    const res = await GPN.api('master.parents.list');
    if (!res.ok) { el.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(res.error) + '</div>'; return; }

    const list = (res.data && res.data.parents) || [];
    el.innerHTML =
      '<div class="gpn-card">' +
        '<h3 class="gpn-card-title">Auto-Linked Parent Accounts (' + list.length + ')</h3>' +
        '<div class="gpn-scroll-frame gpn-mt">' +
          '<table class="gpn-table"><thead><tr><th>Parent ID</th><th>Name</th><th>Phone / WhatsApp</th><th>Linked Students</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
            (list.length
              ? list.map((p) =>
                  '<tr>' +
                    '<td><strong>' + esc(p.Parent_ID) + '</strong></td>' +
                    '<td>' + esc(p.Parent_Name) + '</td>' +
                    '<td>' + esc(p.Parent_Phone) + '</td>' +
                    '<td>' + esc(p.Linked_Student_IDs) + '</td>' +
                    '<td>' + statusBadge(p.Parent_Status) + '</td>' +
                    '<td><button type="button" class="gpn-btn gpn-btn-outline gpn-btn-sm btnPwPar" data-id="' + esc(p.Parent_ID) + '">Reset PW</button></td>' +
                  '</tr>'
                ).join('')
              : '<tr><td colspan="6">' + empty('No parent accounts yet.') + '</td></tr>') +
          '</tbody></table>' +
        '</div>' +
      '</div>';

    el.querySelectorAll('.btnPwPar').forEach((b) => {
      b.addEventListener('click', () => resetUserPw('PARENT', b.dataset.id));
    });
  }

  /* ---- 4. PERMANENT CONTACT DIRECTORY ---- */
  async function renderContacts(el) {
    el.innerHTML =
      '<div class="gpn-card">' +
        '<div class="gpn-card-header">' +
          '<h3 class="gpn-card-title">Permanent Contact Directory (Forever Protected)</h3>' +
          '<button type="button" class="gpn-btn gpn-btn-gold gpn-btn-sm" id="btnAddLead">+ Add Manual Lead</button>' +
        '</div>' +
        '<div class="gpn-toolbar">' +
          '<input class="gpn-input" id="fCtSearch" placeholder="Search name, phone, school..." style="max-width:260px">' +
          '<select class="gpn-select" id="fCtStatus" style="max-width:150px"><option value="ALL">All Status</option><option value="ACTIVE">ACTIVE</option><option value="LEAD">LEAD</option><option value="CUSTOMER">CUSTOMER</option><option value="ARCHIVED">ARCHIVED</option></select>' +
          '<button type="button" class="gpn-btn gpn-btn-primary gpn-btn-sm" id="btnCtFilter">Filter</button>' +
        '</div>' +
        '<div id="ctTableWrap">' + loading('Loading directory...') + '</div>' +
      '</div>';

    async function loadContacts() {
      const wrap = el.querySelector('#ctTableWrap');
      const res = await GPN.api('master.contacts.list', {
        search: el.querySelector('#fCtSearch').value.trim(),
        status: el.querySelector('#fCtStatus').value
      });
      if (!res.ok) { wrap.innerHTML = '<div class="gpn-alert gpn-alert-err">' + esc(res.error) + '</div>'; return; }
      const rows = (res.data && res.data.contacts) || [];
      if (!rows.length) { wrap.innerHTML = empty('No contacts found.'); return; }

      wrap.innerHTML =
        '<div class="gpn-muted" style="margin-bottom:8px">Total matching contacts: ' + rows.length + '</div>' +
        '<div class="gpn-scroll-frame">' +
          '<table class="gpn-table"><thead><tr><th>ID</th><th>Name</th><th>Phone</th><th>Class / School</th><th>Source</th><th>Status</th></tr></thead><tbody>' +
            rows.map((c) =>
              '<tr>' +
                '<td>' + esc(c.Contact_ID) + '</td>' +
                '<td><strong>' + esc(c.Student_Name) + '</strong><div class="gpn-muted">' + esc(c.Father_Name || '') + '</div></td>' +
                '<td>' + esc(c.Phone) + '</td>' +
                '<td>' + esc(c.Class || '-') + '<div class="gpn-muted">' + esc(c.School_Name || '') + '</div></td>' +
                '<td>' + esc(c.Source || '') + '</td>' +
                '<td>' + statusBadge(c.Status) + '</td>' +
              '</tr>'
            ).join('') +
          '</tbody></table>' +
        '</div>';
    }

    el.querySelector('#btnCtFilter').addEventListener('click', loadContacts);
    el.querySelector('#btnAddLead').addEventListener('click', () => {
      openModal('Add Contact / Inquiry Lead',
        '<form id="frmLead">' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Student / Lead Name *</label><input class="gpn-input" id="ldName" required></div>' +
            '<div class="gpn-field"><label>Parent Name</label><input class="gpn-input" id="ldFather"></div>' +
          '</div>' +
          '<div class="gpn-form-row">' +
            '<div class="gpn-field"><label>Phone *</label><input class="gpn-input" id="ldPhone" required></div>' +
            '<div class="gpn-field"><label>Class</label><input class="gpn-input" id="ldClass" placeholder="e.g. Class 9"></div>' +
          '</div>' +
          '<div class="gpn-field"><label>School</label><input class="gpn-input" id="ldSchool"></div>' +
          '<button type="submit" class="gpn-btn gpn-btn-gold gpn-mt">Save to Permanent Directory</button>' +
        '</form>'
      );
      document.getElementById('frmLead').addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await GPN.api('master.contacts.add', {
          Student_Name: document.getElementById('ldName').value.trim(),
          Father_Name: document.getElementById('ldFather').value.trim(),
          Phone: document.getElementById('ldPhone').value.trim(),
          Class: document.getElementById('ldClass').value.trim(),
          School_Name: document.getElementById('ldSchool').value.trim()
        });
        if (r.ok) { closeModal(true); toast('Saved contact ' + r.data.Contact_ID, 'ok'); loadContacts(); }
        else toast(r.error, 'err');
      });
    });

    loadContacts();
  }

  window.GPN_MODULES = window.GPN_MODULES || {};
  window.GPN_MODULES['admin-students'] = { render };
})();
