#!/usr/bin/env node
/**
 * Zero-install preview server for the university student management system.
 *
 * It serves the SAME front-end as index.php and implements the SAME JSON/XML
 * endpoints as api/*.php, using a local JSON file instead of MySQL. This lets
 * the project be demonstrated on machines without XAMPP. For the real
 * submission, use index.php + api/*.php + database/university.sql.
 *
 * Run: node demo/server.js   (then open http://localhost:3000)
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(__dirname, 'data.json');
const SEED_FILE = path.join(__dirname, 'seed.json');
const PORT = Number(process.env.PORT || 3000);
const COURSES = ['BCA', 'B.Sc Computer Science', 'B.Com', 'BBA', 'B.A.', 'B.Tech CSE'];

let database = loadDatabase();
const sessions = new Map(); // sid -> user id

function loadDatabase() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, fs.readFileSync(SEED_FILE, 'utf8'));
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    console.error('Could not read demo data, restoring seed:', error.message);
    fs.copyFileSync(SEED_FILE, DATA_FILE);
    return JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  }
}

function persist() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(database, null, 2) + '\n');
}

function field(data, key) {
  const value = data && data[key];
  return value === undefined || value === null ? '' : String(value).trim();
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (error) { reject(new Error('Invalid JSON body.')); }
    });
    req.on('error', reject);
  });
}

function sessionId(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)vu_demo_sid=([a-f0-9]+)/);
  return match ? match[1] : '';
}

function currentUser(req) {
  const id = sessions.get(sessionId(req));
  return id ? database.users.find((user) => user.id === id) || null : null;
}

function publicUser(user) {
  return user && { id: user.id, username: user.username, full_name: user.full_name, email: user.email };
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function passwordMatches(password, user) {
  const actual = Buffer.from(hashPassword(password, user.salt), 'hex');
  const expected = Buffer.from(user.hash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function verifyStudent(data) {
  const value = {
    register_no: field(data, 'register_no').toUpperCase(),
    name: field(data, 'name'),
    course: field(data, 'course'),
    semester: Number(field(data, 'semester')),
    email: field(data, 'email').toLowerCase(),
    contact: field(data, 'contact'),
  };
  const errors = {};
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{2,29}$/.test(value.register_no)) errors.register_no = 'Use 3-30 letters, numbers or hyphens.';
  if (value.name.length < 2 || value.name.length > 100 || !/^[A-Za-z][A-Za-z .'-]*$/.test(value.name)) errors.name = 'Enter a valid student name.';
  if (!COURSES.includes(value.course)) errors.course = 'Choose a valid course.';
  if (!Number.isInteger(value.semester) || value.semester < 1 || value.semester > 8) errors.semester = 'Semester must be a number from 1 to 8.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) errors.email = 'Enter a valid email address.';
  if (!/^[6-9][0-9]{9}$/.test(value.contact)) errors.contact = 'Enter a valid 10-digit mobile number.';
  return { value, errors };
}

function isDuplicate(value, ignoreId = 0) {
  return database.students.some((student) => student.id !== ignoreId &&
    (student.register_no.toLowerCase() === value.register_no.toLowerCase() ||
     student.email.toLowerCase() === value.email.toLowerCase()));
}

function xmlEscape(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function studentsToXml() {
  const students = [...database.students].sort((a, b) => a.id - b.id);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<university name="MD University" generated="' + new Date().toISOString().slice(0, 10) + '">',
    '  <metadata>',
    `    <totalRecords>${students.length}</totalRecords>`,
    '    <source>Local demo data (mirrors MySQL database: university_student_management)</source>',
    '  </metadata>',
    '  <students>',
  ];
  students.forEach((student) => {
    lines.push(`    <student id="${student.id}">`);
    lines.push(`      <registerNo>${xmlEscape(student.register_no)}</registerNo>`);
    lines.push(`      <name>${xmlEscape(student.name)}</name>`);
    lines.push(`      <course>${xmlEscape(student.course)}</course>`);
    lines.push(`      <semester>${Number(student.semester)}</semester>`);
    lines.push(`      <email>${xmlEscape(student.email)}</email>`);
    lines.push(`      <contact>${xmlEscape(student.contact)}</contact>`);
    lines.push('    </student>');
  });
  lines.push('  </students>', '</university>', '');
  return lines.join('\n');
}

/* ------------------------------- routes ------------------------------ */

async function handleAuth(req, res, parsed) {
  const user = currentUser(req);

  if (req.method === 'GET') {
    return sendJson(res, 200, { ok: true, user: publicUser(user) });
  }
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, message: 'Method not allowed.' });

  const body = await readBody(req);
  const action = field(body, 'action');

  if (action === 'login') {
    const username = field(body, 'username');
    const password = field(body, 'password');
    const errors = {};
    if (!username) errors.username = 'Username is required.';
    if (!password) errors.password = 'Password is required.';
    if (Object.keys(errors).length) return sendJson(res, 422, { ok: false, message: 'Please correct the highlighted fields.', errors });

    const found = database.users.find((item) =>
      item.username.toLowerCase() === username.toLowerCase() || item.email.toLowerCase() === username.toLowerCase());
    if (!found || !passwordMatches(password, found)) {
      return sendJson(res, 401, { ok: false, message: 'Invalid username or password.' });
    }
    const sid = crypto.randomBytes(24).toString('hex');
    sessions.set(sid, found.id);
    return sendJson(res, 200, { ok: true, user: publicUser(found) }, {
      'Set-Cookie': `vu_demo_sid=${sid}; Path=/; HttpOnly; SameSite=Lax`,
    });
  }

  if (action === 'register') {
    const fullName = field(body, 'full_name');
    const username = field(body, 'username');
    const email = field(body, 'email').toLowerCase();
    const password = field(body, 'password');
    const errors = {};
    if (fullName.length < 2 || fullName.length > 100) errors.full_name = 'Enter your full name (2-100 characters).';
    if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) errors.username = 'Use 3-30 letters, numbers or underscores.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
    if (password.length < 6) errors.password = 'Password must be at least 6 characters.';
    if (password !== field(body, 'confirm_password')) errors.confirm_password = 'Passwords do not match.';
    if (Object.keys(errors).length) return sendJson(res, 422, { ok: false, message: 'Please correct the highlighted fields.', errors });

    if (database.users.some((item) => item.username.toLowerCase() === username.toLowerCase() || item.email.toLowerCase() === email)) {
      return sendJson(res, 409, { ok: false, message: 'That username or email is already registered.', errors: { username: 'Username or email already in use.' } });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const created = {
      id: database.nextUserId++, username, full_name: fullName, email,
      salt, hash: hashPassword(password, salt), created_at: new Date().toISOString(),
    };
    database.users.push(created);
    persist();
    const sid = crypto.randomBytes(24).toString('hex');
    sessions.set(sid, created.id);
    return sendJson(res, 200, { ok: true, user: publicUser(created), message: 'Account created successfully.' }, {
      'Set-Cookie': `vu_demo_sid=${sid}; Path=/; HttpOnly; SameSite=Lax`,
    });
  }

  if (action === 'logout') {
    sessions.delete(sessionId(req));
    return sendJson(res, 200, { ok: true }, {
      'Set-Cookie': 'vu_demo_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    });
  }

  return sendJson(res, 400, { ok: false, message: 'Unknown action.' });
}

async function handleStudents(req, res, parsed) {
  if (!currentUser(req)) return sendJson(res, 401, { ok: false, message: 'Please log in to continue.' });

  if (req.method === 'GET') {
    if (parsed.searchParams.has('id')) {
      const student = database.students.find((item) => item.id === Number(parsed.searchParams.get('id')));
      return student
        ? sendJson(res, 200, { ok: true, student })
        : sendJson(res, 404, { ok: false, message: 'Student record not found.' });
    }
    const q = (parsed.searchParams.get('q') || '').toLowerCase();
    const course = parsed.searchParams.get('course') || '';
    const semester = parsed.searchParams.get('semester') || '';
    const students = [...database.students].filter((student) =>
      (!q || [student.register_no, student.name, student.email].join(' ').toLowerCase().includes(q)) &&
      (!course || student.course === course) &&
      (!semester || String(student.semester) === semester)
    ).sort((a, b) => b.id - a.id);
    return sendJson(res, 200, { ok: true, students });
  }

  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, message: 'Method not allowed.' });

  const body = await readBody(req);
  const action = field(body, 'action');

  if (action === 'create' || action === 'update') {
    const { value, errors } = verifyStudent(body);
    if (Object.keys(errors).length) return sendJson(res, 422, { ok: false, message: 'Please correct the highlighted fields.', errors });

    const id = action === 'update' ? Number(field(body, 'id')) : 0;
    if (action === 'update' && !database.students.some((item) => item.id === id)) {
      return sendJson(res, 404, { ok: false, message: 'Student record not found.' });
    }
    if (isDuplicate(value, id)) {
      return sendJson(res, 409, {
        ok: false,
        message: 'A student with this register number or email already exists.',
        errors: { register_no: 'Already in use.', email: 'Already in use.' },
      });
    }
    const student = action === 'create'
      ? { id: database.nextStudentId++, ...value, created_at: new Date().toISOString() }
      : Object.assign(database.students.find((item) => item.id === id), value);
    if (action === 'create') database.students.push(student);
    persist();
    return sendJson(res, action === 'create' ? 201 : 200, {
      ok: true, student, message: action === 'create' ? 'Student added successfully.' : 'Student details updated successfully.',
    });
  }

  if (action === 'delete') {
    const id = Number(field(body, 'id'));
    const index = database.students.findIndex((item) => item.id === id);
    if (index === -1) return sendJson(res, 404, { ok: false, message: 'Student record not found.' });
    database.students.splice(index, 1);
    persist();
    return sendJson(res, 200, { ok: true, message: 'Student record deleted successfully.' });
  }

  return sendJson(res, 400, { ok: false, message: 'Unknown action.' });
}

function handleXml(res, parsed) {
  const headers = {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'no-store',
  };
  if (parsed.searchParams.has('download')) {
    headers['Content-Disposition'] = 'attachment; filename="students.xml"';
  }
  res.writeHead(200, headers);
  res.end(studentsToXml());
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
};

function serveStatic(pathname, res) {
  let relative = decodeURIComponent(pathname);
  if (relative === '/' || relative === '/index.php') relative = '/public/index.html';
  const target = path.resolve(ROOT, '.' + relative);
  if (!target.startsWith(ROOT + path.sep) && target !== ROOT) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  const file = fs.existsSync(target) && fs.statSync(target).isFile()
    ? target
    : path.join(ROOT, 'public', 'index.html');
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsed.pathname;

    if (pathname === '/api/auth.php') return await handleAuth(req, res, parsed);
    if (pathname === '/api/students.php') return await handleStudents(req, res, parsed);
    if (pathname === '/api/xml.php' || pathname === '/xml.php') return handleXml(res, parsed);
    return serveStatic(pathname, res);
  } catch (error) {
    console.error('Demo server error:', error);
    if (!res.headersSent) sendJson(res, 500, { ok: false, message: error.message || 'Server error.' });
    else res.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`MD University demo server running at http://localhost:${PORT}`);
});
