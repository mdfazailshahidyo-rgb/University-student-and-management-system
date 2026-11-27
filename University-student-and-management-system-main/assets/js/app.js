/* =====================================================================
   MD University — front-end controller
   Works with api/*.php (PHP + MySQL) and with the local Node demo server.
   All requests use relative URLs, no hard-coded hostnames.
   ===================================================================== */
(() => {
  'use strict';

  const $  = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const COURSES = ['BCA', 'B.Sc Computer Science', 'B.Com', 'BBA', 'B.A.', 'B.Tech CSE'];
  const state = { user: null, students: [], view: 'dashboard', xmlText: '' };

  /* ----------------------------- helpers ----------------------------- */

  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function initials(name) {
    return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2)
      .map((part) => part[0].toUpperCase()).join('') || '?';
  }

  function show(element) { if (element) element.hidden = false; }
  function hide(element) { if (element) element.hidden = true; }

  async function api(path, options = {}) {
    const opts = { credentials: 'same-origin', ...options };
    opts.headers = { ...(options.headers || {}) };
    if (opts.body && typeof opts.body !== 'string') {
      opts.body = JSON.stringify(opts.body);
      opts.headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await fetch(path, opts);
    } catch (error) {
      throw new Error('Unable to reach the server. Please try again.');
    }
    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error('The server returned an unexpected response.');
    }
    if (!data || data.ok === false) {
      const error = new Error((data && data.message) || 'Request failed. Please try again.');
      error.fields = (data && data.errors) || {};
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function toast(message, type = 'success') {
    const box = $('#toasts');
    const icon = type === 'error' ? 'i-alert' : type === 'info' ? 'i-info' : 'i-check';
    const node = document.createElement('div');
    node.className = `toast toast--${type}`;
    node.innerHTML = `<svg class="icon"><use href="#${icon}"/></svg><span>${esc(message)}</span>`;
    box.appendChild(node);
    setTimeout(() => {
      node.classList.add('is-leaving');
      setTimeout(() => node.remove(), 260);
    }, 3600);
  }

  function clearErrors(root) {
    $$('.field-error', root).forEach((element) => { element.textContent = ''; });
    $$('.is-invalid', root).forEach((element) => element.classList.remove('is-invalid'));
    const alert = $('.form-alert', root);
    if (alert) hide(alert);
  }

  function applyErrors(errors, prefix, root) {
    $$('.field-error', root).forEach((element) => { element.textContent = ''; });
    $$('.is-invalid', root).forEach((element) => element.classList.remove('is-invalid'));
    Object.entries(errors || {}).forEach(([field, message]) => {
      const target = document.getElementById(`${prefix}${field}-error`);
      if (target) target.textContent = message;
      const input = document.getElementById(`${prefix}${field}`) ||
        document.getElementById(`${prefix}${field === 'confirm_password' ? 'confirm' : field}`);
      if (input) input.classList.add('is-invalid');
    });
  }

  function showAlert(id, message) {
    const alert = document.getElementById(id);
    if (!alert) return;
    alert.textContent = message;
    show(alert);
  }

  /* ------------------------- client validation ----------------------- */

  function validateLogin(values) {
    const errors = {};
    if (!values.username.trim()) errors.username = 'Username is required.';
    if (!values.password) errors.password = 'Password is required.';
    return errors;
  }

  function validateRegister(values) {
    const errors = {};
    if (values.full_name.trim().length < 2) errors.full_name = 'Enter your full name.';
    if (!/^[A-Za-z0-9_]{3,30}$/.test(values.username.trim())) errors.username = 'Use 3-30 letters, numbers or underscores.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
    if (values.password.length < 6) errors.password = 'Password must be at least 6 characters.';
    if (values.password !== values.confirm_password) errors.confirm_password = 'Passwords do not match.';
    return errors;
  }

  function validateStudent(values) {
    const errors = {};
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{2,29}$/.test(values.register_no.trim())) errors.register_no = 'Use 3-30 letters, numbers or hyphens.';
    if (values.name.trim().length < 2) errors.name = 'Enter the student name.';
    if (!COURSES.includes(values.course)) errors.course = 'Choose a valid course.';
    if (!/^[1-8]$/.test(String(values.semester))) errors.semester = 'Choose a semester from 1 to 8.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
    if (!/^[6-9][0-9]{9}$/.test(values.contact.trim())) errors.contact = 'Enter a valid 10-digit mobile number.';
    return errors;
  }

  function formValues(form) {
    const data = {};
    $$('input, select', form).forEach((element) => { data[element.name] = element.value; });
    return data;
  }

  /* -------------------------- authentication ------------------------- */

  function switchAuthTab(tab) {
    const login = tab === 'login';
    show(login ? $('#auth-form-login') : $('#auth-form-register'));
    hide(login ? $('#auth-form-register') : $('#auth-form-login'));
    $$('[data-auth-tab]').forEach((button) => {
      const active = button.dataset.authTab === tab;
      button.classList.toggle('is-active', active);
      if (button.getAttribute('role') === 'tab') button.setAttribute('aria-selected', String(active));
    });
    clearErrors($('.auth-form:not([hidden])'));
  }

  function showAuth(tab = 'login') {
    hide($('#boot'));
    hide($('#app-shell'));
    show($('#auth-screen'));
    switchAuthTab(tab);
  }

  async function showApp() {
    const user = state.user;
    $('#sidebar-name').textContent = user.full_name || user.username;
    $('#sidebar-username').textContent = `@${user.username}`;
    $('#sidebar-avatar').textContent = initials(user.full_name || user.username);
    $('#topbar-avatar').textContent = initials(user.full_name || user.username);
    const firstName = (user.full_name || user.username).split(' ')[0];
    $('#dash-greeting').textContent = `Welcome back, ${firstName}`;
    hide($('#auth-screen'));
    hide($('#boot'));
    show($('#app-shell'));
    await loadStudents();
    navigate(location.hash.replace('#', '') || 'dashboard', false);
  }

  async function checkSession() {
    try {
      const result = await api('api/auth.php?action=me');
      if (result.user) {
        state.user = result.user;
        await showApp();
        return;
      }
    } catch (error) { /* not signed in — show login screen */ }
    showAuth();
  }

  async function submitLogin(event) {
    event.preventDefault();
    const form = $('#login-form');
    clearErrors(form);
    const values = formValues(form);
    const errors = validateLogin(values);
    if (Object.keys(errors).length) { applyErrors(errors, 'login-', form); return; }

    const button = $('button[type="submit"]', form);
    button.disabled = true;
    button.textContent = 'Signing in…';
    try {
      const result = await api('api/auth.php', { method: 'POST', body: { action: 'login', ...values } });
      state.user = result.user;
      if ($('#login-remember').checked) localStorage.setItem('vu_username', values.username);
      else localStorage.removeItem('vu_username');
      $('#login-form').reset();
      await showApp();
      toast(`Welcome, ${result.user.full_name.split(' ')[0]}!`);
    } catch (error) {
      if (Object.keys(error.fields || {}).length) applyErrors(error.fields, 'login-', form);
      else showAlert('login-alert', error.message);
    } finally {
      button.disabled = false;
      button.innerHTML = 'Sign in <svg class="icon"><use href="#i-arrow"/></svg>';
    }
  }

  async function submitRegister(event) {
    event.preventDefault();
    const form = $('#register-form');
    clearErrors(form);
    const values = formValues(form);
    const errors = validateRegister(values);
    if (Object.keys(errors).length) { applyErrors(errors, 'reg-', form); return; }

    const button = $('button[type="submit"]', form);
    button.disabled = true;
    button.textContent = 'Creating account…';
    try {
      const result = await api('api/auth.php', { method: 'POST', body: { action: 'register', ...values } });
      state.user = result.user;
      form.reset();
      await showApp();
      toast('Account created successfully. You are now signed in.');
    } catch (error) {
      if (Object.keys(error.fields || {}).length) applyErrors(error.fields, 'reg-', form);
      else showAlert('register-alert', error.message);
    } finally {
      button.disabled = false;
      button.innerHTML = 'Create account <svg class="icon"><use href="#i-arrow"/></svg>';
    }
  }

  async function logout() {
    try { await api('api/auth.php', { method: 'POST', body: { action: 'logout' } }); }
    catch (error) { /* clear the UI regardless */ }
    state.user = null;
    state.students = [];
    location.hash = '';
    showAuth();
    toast('You have been signed out.', 'info');
  }

  /* --------------------------- navigation ---------------------------- */

  const TITLES = {
    dashboard: ['WORKSPACE', 'Dashboard'],
    students: ['MODULE 02 · STUDENT MANAGEMENT', 'Student Records'],
    xml: ['MODULE 04 · XML COMPONENT', 'XML Records'],
  };

  function navigate(view, updateHash = true) {
    if (!TITLES[view]) view = 'dashboard';
    state.view = view;
    if (updateHash && location.hash !== `#${view}`) location.hash = view;
    $$('[data-nav]').forEach((button) => button.classList.toggle('is-active', button.dataset.nav === view));
    $('#page-kicker').textContent = TITLES[view][0];
    $('#page-title').textContent = TITLES[view][1];
    ['dashboard', 'students', 'xml'].forEach((name) => {
      $(`#view-${name}`).hidden = name !== view;
    });
    closeSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (view === 'xml') loadXml();
  }

  function openSidebar() { $('#sidebar').classList.add('is-open'); show($('#sidebar-backdrop')); }
  function closeSidebar() { $('#sidebar').classList.remove('is-open'); hide($('#sidebar-backdrop')); }

  /* -------------------------- student data --------------------------- */

  async function loadStudents() {
    try {
      const result = await api('api/students.php');
      state.students = result.students || [];
    } catch (error) {
      state.students = [];
      toast(error.message, 'error');
    }
    renderAll();
  }

  function filteredStudents() {
    const query = $('#student-search').value.trim().toLowerCase();
    const course = $('#course-filter').value;
    const semester = $('#semester-filter').value;
    return state.students.filter((student) => {
      const matchesText = !query ||
        [student.register_no, student.name, student.email, student.course].join(' ').toLowerCase().includes(query);
      return matchesText && (!course || student.course === course) &&
        (!semester || String(student.semester) === semester);
    });
  }

  function renderAll() {
    renderStudents();
    renderDashboard();
    $('#nav-student-count').textContent = state.students.length;
  }

  function renderStudents() {
    const students = filteredStudents();
    const tbody = $('#students-tbody');
    tbody.innerHTML = students.map((student) => `
      <tr>
        <td><span class="register-code">${esc(student.register_no)}</span></td>
        <td><div class="student-cell"><span class="avatar">${esc(initials(student.name))}</span>
          <span><strong>${esc(student.name)}</strong><small>${esc(student.email)}</small></span></div></td>
        <td><span class="course-tag">${esc(student.course)}</span></td>
        <td><span class="sem-tag">${Math.max(1, Math.min(8, Number(student.semester) || 1))}</span></td>
        <td>${esc(student.contact)}</td>
        <td><div class="row-actions">
          <button class="row-btn" type="button" data-edit="${Number(student.id)}" title="Edit ${esc(student.name)}" aria-label="Edit student"><svg class="icon"><use href="#i-edit"/></svg></button>
          <button class="row-btn row-btn--danger" type="button" data-delete="${Number(student.id)}" title="Delete ${esc(student.name)}" aria-label="Delete student"><svg class="icon"><use href="#i-trash"/></svg></button>
        </div></td>
      </tr>`).join('');

    const empty = students.length === 0;
    $('#students-empty').hidden = !empty;
    $('.data-table--students').closest('.table-wrap').hidden = empty;
    $('#empty-message').textContent = state.students.length === 0
      ? 'No records yet. Add your first student to get started.'
      : 'Try a different search or reset the filters.';
    $('#results-count').textContent = students.length;
    $('#results-info').textContent = `Showing ${students.length} of ${state.students.length} records`;
  }

  function renderDashboard() {
    const all = state.students;
    $('#stat-total').textContent = all.length;
    $('#stat-courses').textContent = new Set(all.map((student) => student.course)).size;
    $('#stat-semester').textContent = all.length
      ? (all.reduce((sum, student) => sum + Number(student.semester), 0) / all.length).toFixed(1)
      : '—';

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    $('#stat-recent').textContent = all.filter((student) => student.created_at && new Date(student.created_at).getTime() >= weekAgo).length;

    $('#recent-tbody').innerHTML = all.slice(0, 5).map((student) => `
      <tr>
        <td><div class="student-cell"><span class="avatar">${esc(initials(student.name))}</span>
          <span><strong>${esc(student.name)}</strong><small>${esc(student.register_no)}</small></span></div></td>
        <td><span class="course-tag">${esc(student.course)}</span></td>
        <td><span class="sem-tag">${Number(student.semester)}</span></td>
        <td style="color:var(--muted);white-space:nowrap">${student.created_at ? esc(new Date(student.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })) : '—'}</td>
      </tr>`).join('') || '<tr><td colspan="4" style="color:var(--muted)">No records yet. Add a student to get started.</td></tr>';

    const counts = COURSES.map((course) => ({ course, count: all.filter((s) => s.course === course).length }))
      .filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
    const max = Math.max(1, ...counts.map((item) => item.count));
    $('#course-bars').innerHTML = counts.length ? counts.map((item) => `
      <div class="course-bar">
        <div class="course-bar__top"><strong>${esc(item.course)}</strong><span>${item.count} student${item.count === 1 ? '' : 's'}</span></div>
        <div class="course-bar__track"><span class="course-bar__fill" style="width:${(item.count / max) * 100}%"></span></div>
      </div>`).join('') : '<p style="color:var(--muted);font-size:12.5px;margin:0">No course data available yet.</p>';
  }

  /* ------------------------ student CRUD modal ----------------------- */

  function openModal(title, body, footer = '') {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = `<div class="modal__body">${body}${footer ? `<div class="modal__footer">${footer}</div>` : ''}</div>`;
    show($('#modal'));
    const first = $('#modal input, #modal select');
    if (first) setTimeout(() => first.focus(), 40);
  }

  function closeModal() { hide($('#modal')); $('#modal-body').innerHTML = ''; }

  function studentFormHtml(student = {}) {
    const options = COURSES.map((course) => `<option value="${esc(course)}"${student.course === course ? ' selected' : ''}>${esc(course)}</option>`).join('');
    const semesters = Array.from({ length: 8 }, (_, index) => index + 1)
      .map((number) => `<option value="${number}"${Number(student.semester) === number ? ' selected' : ''}>Semester ${number}</option>`).join('');
    return `
      <p class="modal-hint">Fields marked with an asterisk are required. The same rules are checked on the server.</p>
      <form id="student-form" novalidate>
        <div class="field-row">
          <div class="field"><label for="st-register_no">Register number *</label>
            <input id="st-register_no" name="register_no" value="${esc(student.register_no || '')}" placeholder="BCA2024010" autocomplete="off"><span class="field-error" id="st-register_no-error"></span></div>
          <div class="field"><label for="st-name">Student name *</label>
            <input id="st-name" name="name" value="${esc(student.name || '')}" placeholder="Full name"><span class="field-error" id="st-name-error"></span></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="st-course">Course *</label>
            <select id="st-course" name="course"><option value="">Select course</option>${options}</select><span class="field-error" id="st-course-error"></span></div>
          <div class="field"><label for="st-semester">Semester *</label>
            <select id="st-semester" name="semester"><option value="">Select semester</option>${semesters}</select><span class="field-error" id="st-semester-error"></span></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="st-email">Email ID *</label>
            <input id="st-email" name="email" type="email" value="${esc(student.email || '')}" placeholder="name@mduniversity.edu"><span class="field-error" id="st-email-error"></span></div>
          <div class="field"><label for="st-contact">Contact number *</label>
            <input id="st-contact" name="contact" value="${esc(student.contact || '')}" placeholder="10-digit mobile number" inputmode="numeric"><span class="field-error" id="st-contact-error"></span></div>
        </div>
        <p class="form-alert" id="st-alert" hidden></p>
      </form>`;
  }

  function openStudentModal(student = null) {
    const editing = Boolean(student);
    openModal(
      editing ? 'Edit student details' : 'Add new student',
      studentFormHtml(student || {}),
      `<button class="btn btn-outline" type="button" data-modal-close>Cancel</button>
       <button class="btn btn-primary" type="submit" form="student-form"><svg class="icon"><use href="#i-check"/></svg>${editing ? 'Save changes' : 'Add student'}</button>`
    );
    $('#student-form').addEventListener('submit', (event) => saveStudent(event, editing ? student.id : null));
  }

  async function saveStudent(event, id) {
    event.preventDefault();
    const form = $('#student-form');
    clearErrors(form);
    const values = formValues(form);
    const errors = validateStudent(values);
    if (Object.keys(errors).length) { applyErrors(errors, 'st-', form); return; }

    const submitButton = $('#modal button[type="submit"]');
    submitButton.disabled = true;
    try {
      await api('api/students.php', {
        method: 'POST',
        body: { action: id ? 'update' : 'create', id: id || undefined, ...values },
      });
      closeModal();
      await loadStudents();
      toast(id ? 'Student details updated successfully.' : 'Student added successfully.');
    } catch (error) {
      if (Object.keys(error.fields || {}).length) applyErrors(error.fields, 'st-', form);
      else showAlert('st-alert', error.message);
    } finally {
      if (submitButton.isConnected) submitButton.disabled = false;
    }
  }

  function openDeleteModal(student) {
    openModal(
      'Delete student record',
      `<div class="delete-box">
         <span class="delete-box__icon"><svg class="icon"><use href="#i-trash"/></svg></span>
         <div><h4>Delete this record permanently?</h4>
           <p>The student will be removed from MySQL and from the generated XML document.</p>
           <div class="delete-box__summary"><strong>${esc(student.name)}</strong> · ${esc(student.register_no)} · ${esc(student.course)}</div>
         </div>
       </div>`,
      `<button class="btn btn-outline" type="button" data-modal-close>Cancel</button>
       <button class="btn btn-primary" type="button" id="confirm-delete" style="background:linear-gradient(135deg,#ef5350,#d32f2f);box-shadow:0 6px 16px rgba(229,72,77,.26)"><svg class="icon"><use href="#i-trash"/></svg> Delete record</button>`
    );
    $('#confirm-delete').addEventListener('click', async () => {
      const button = $('#confirm-delete');
      button.disabled = true;
      try {
        await api('api/students.php', { method: 'POST', body: { action: 'delete', id: student.id } });
        closeModal();
        await loadStudents();
        toast('Student record deleted successfully.');
      } catch (error) {
        toast(error.message, 'error');
        closeModal();
      }
    });
  }

  /* ------------------------------ XML -------------------------------- */

  function highlightXml(text) {
    return esc(text)
      .replace(/(&lt;!--[\s\S]*?--&gt;|&lt;\?xml[\s\S]*?\?&gt;)/g, '<span class="tk-comment">$1</span>')
      .replace(/(&lt;\/?)([\w:-]+)/g, '$1<span class="tk-tag">$2</span>')
      .replace(/([\w:-]+)=(&quot;[^&]*?&quot;)/g, '<span class="tk-attr">$1</span>=<span class="tk-str">$2</span>');
  }

  async function loadXml() {
    try {
      const response = await fetch('xml.php', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error(`XML request failed (${response.status})`);
      const text = await response.text();
      state.xmlText = text;
      const documentXml = new DOMParser().parseFromString(text, 'application/xml');
      if (documentXml.getElementsByTagName('parsererror').length) throw new Error('The XML document could not be parsed.');

      const records = Array.from(documentXml.getElementsByTagName('student'));
      const value = (record, tag) => {
        const node = record.getElementsByTagName(tag)[0];
        return node ? node.textContent : '—';
      };
      $('#xml-record-count').textContent = `${records.length} record${records.length === 1 ? '' : 's'}`;
      $('#xml-records').innerHTML = records.map((record) => `
        <article class="xml-record">
          <div class="xml-record__top"><span class="xml-record__id">ID ${esc(record.getAttribute('id') || '')}</span><span class="sem-tag">Sem ${esc(value(record, 'semester'))}</span></div>
          <strong>${esc(value(record, 'name'))}</strong>
          <div class="xml-record__meta">${esc(value(record, 'registerNo'))}</div>
          <div class="xml-record__row"><b>course</b><span>${esc(value(record, 'course'))}</span></div>
          <div class="xml-record__row"><b>email</b><span>${esc(value(record, 'email'))}</span></div>
        </article>`).join('') || '<p style="color:var(--muted);font-size:12.5px">No records found in the XML document.</p>';
      $('#xml-code').innerHTML = highlightXml(text);
    } catch (error) {
      $('#xml-record-count').textContent = 'Unavailable';
      $('#xml-records').innerHTML = `<p style="color:var(--danger);font-size:12.5px">${esc(error.message)}</p>`;
      $('#xml-code').textContent = error.message;
    }
  }

  /* ------------------------------ events ----------------------------- */

  function bindEvents() {
    $$('[data-auth-tab]').forEach((button) => button.addEventListener('click', () => switchAuthTab(button.dataset.authTab)));
    $('#login-form').addEventListener('submit', submitLogin);
    $('#register-form').addEventListener('submit', submitRegister);

    $$('[data-toggle-password]').forEach((button) => button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.togglePassword);
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      button.innerHTML = `<svg class="icon"><use href="#i-${isPassword ? 'eye-off' : 'eye'}"/></svg>`;
    }));

    $('#forgot-link').addEventListener('click', () => toast('Please contact the university administrator to reset your password.', 'info'));

    document.addEventListener('click', (event) => {
      const nav = event.target.closest('[data-nav]');
      if (nav) { navigate(nav.dataset.nav); return; }
      const add = event.target.closest('[data-action="open-add"]');
      if (add) { openStudentModal(); return; }
      const close = event.target.closest('[data-modal-close]');
      if (close) { closeModal(); return; }
      const edit = event.target.closest('[data-edit]');
      if (edit) {
        const student = state.students.find((item) => Number(item.id) === Number(edit.dataset.edit));
        if (student) openStudentModal(student);
        return;
      }
      const remove = event.target.closest('[data-delete]');
      if (remove) {
        const student = state.students.find((item) => Number(item.id) === Number(remove.dataset.delete));
        if (student) openDeleteModal(student);
      }
    });

    $('#logout-btn').addEventListener('click', logout);
    $('#menu-toggle').addEventListener('click', openSidebar);
    $('#sidebar-close').addEventListener('click', closeSidebar);
    $('#sidebar-backdrop').addEventListener('click', closeSidebar);
    $('#modal-close').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', (event) => { if (event.target === $('#modal')) closeModal(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeModal(); closeSidebar(); } });

    let searchTimer;
    $('#student-search').addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderStudents, 120);
    });
    $('#course-filter').addEventListener('change', renderStudents);
    $('#semester-filter').addEventListener('change', renderStudents);
    $('#clear-filters').addEventListener('click', () => {
      $('#student-search').value = '';
      $('#course-filter').value = '';
      $('#semester-filter').value = '';
      renderStudents();
    });
    $('#xml-refresh').addEventListener('click', async () => {
      await loadXml();
      toast('XML document refreshed.', 'info');
    });

    window.addEventListener('hashchange', () => {
      if (state.user) navigate(location.hash.replace('#', '') || 'dashboard', false);
    });
  }

  /* ------------------------------- init ------------------------------ */

  function init() {
    $('#course-filter').innerHTML = '<option value="">All courses</option>' +
      COURSES.map((course) => `<option value="${esc(course)}">${esc(course)}</option>`).join('');
    $('#topbar-date').textContent = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const remembered = localStorage.getItem('vu_username');
    if (remembered) $('#login-username').value = remembered;
    bindEvents();
    checkSession();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
