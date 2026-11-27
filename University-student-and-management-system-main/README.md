# University Student Information & Academic Management System

A complete BCA course project built with **HTML, CSS, JavaScript, PHP, MySQL and XML**.
The login screen is the splash page; after sign-in the application offers student
CRUD (add / edit / delete / display), a MySQL-backed PHP API and a dedicated XML
records page.

> **Live preview in this workspace:** no PHP or MySQL is needed to try it. The
> included Node demo server serves the exact same front-end and the same API
> contract with a local JSON data store. The full PHP/MySQL source is the primary
> submission and runs normally in XAMPP/WAMP.

---

## 1. Features

| Module | What is included |
| --- | --- |
| Login & registration | Splash login page, sign-up form, session handling, hashed passwords, client + server validation |
| Student management | Add, view, edit, delete, live search and course/semester filters |
| Database | MySQL tables `users` and `students`, PDO connection, prepared statements, SQL file with sample data |
| XML | `data/students.xml` document plus a live XML page generated from records, with parsed view, raw source and download |
| UI | Responsive dashboard, statistics, course distribution, modals, toasts, inline field errors |

## 2. Project structure

```
.
├── index.php                  # Splash page entry point (serves the app shell)
├── xml.php                    # Direct link to the generated XML document
├── api/
│   ├── config.php             # MySQL credentials (edit for your XAMPP/WAMP)
│   ├── db.php                 # PDO connection
│   ├── helpers.php            # Validation, sessions, XMLWriter generation
│   ├── auth.php               # Login / registration / logout / session API
│   ├── students.php           # Student CRUD API
│   └── xml.php                # XML document endpoint
├── public/index.html          # Application shell: login, dashboard, students, XML views
├── assets/css/styles.css      # Complete responsive stylesheet
├── assets/js/app.js           # Validation, API calls and all UI behaviour
├── database/university.sql    # Database, tables, default user, 8 sample students
├── data/students.xml          # Static XML document (submission artifact)
├── demo/
│   ├── server.js              # Dependency-free preview server
│   ├── seed.json              # Initial demo data (with salted password hashes)
│   └── data.json              # Generated at runtime — not committed
├── docs/
│   ├── PROJECT_REPORT.md      # Full project report
│   └── screenshots/README.md  # Screenshot checklist and capture steps
└── README.md
```

## 3. Run the real PHP + MySQL version (XAMPP / WAMP)

1. Copy this folder into `htdocs` (XAMPP) or `www` (WAMP), e.g. `C:\xampp\htdocs\university`.
2. Start **Apache** and **MySQL** in the XAMPP/WAMP control panel.
3. Open `http://localhost/phpmyadmin`, choose the **Import** tab and import
   `database/university.sql`. This creates `university_student_management`,
   both tables, the default user and 8 sample students.
4. If your MySQL root user has a password, update `DB_PASS` in `api/config.php`
   (environment variables `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
   are also supported).
5. Open `http://localhost/university/index.php`.

**Preloaded account:** `admin` / `admin123` (or register a new account from the
splash page).

> Make sure the PHP `pdo_mysql` and `xmlwriter` extensions are enabled — both
> are enabled by default in XAMPP/WAMP.

## 4. Run the live demo in this workspace (no PHP/MySQL)

```bash
node demo/server.js
# open http://localhost:3000
```

The preview server binds to `0.0.0.0` and serves the same `public/index.html`,
CSS and JavaScript. It implements `/api/auth.php`, `/api/students.php` and
`/xml.php` exactly like the PHP endpoints, so every screen works. Changes are
saved to `demo/data.json`; delete that file to restore the seed data.

## 5. API reference

All endpoints are relative to the application root and return JSON except the
XML endpoints.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `api/auth.php?action=me` | Current session (`user: null` when signed out) |
| `POST` | `api/auth.php` | `{action:"login"\|"register"\|"logout", ...}` |
| `GET` | `api/students.php` | All records; optional `q`, `course`, `semester`, `id` |
| `POST` | `api/students.php` | `{action:"create"\|"update"\|"delete", ...}` |
| `GET` | `api/xml.php` or `xml.php` | Generated XML document (`?download=1` saves it) |

Example — create a student:

```json
POST api/students.php
{
  "action": "create",
  "register_no": "BCA2024010",
  "name": "Nisha Rao",
  "course": "BCA",
  "semester": "4",
  "email": "nisha.rao@mduniversity.edu",
  "contact": "9876543210"
}
```

Validation is performed twice: instantly in JavaScript for the user, and again
in PHP before any SQL statement runs. Duplicate register numbers/emails are
rejected with HTTP 409; invalid fields return HTTP 422 with a field-error map.

## 6. XML component

* `data/students.xml` is the static document containing the sample records.
* `api/xml.php` (also reachable as `xml.php`) generates a well-formed document
  from MySQL at request time using `XMLWriter`, with escaped values and a
  `<metadata>` summary.
* The **XML Records** screen fetches that document, parses it with the browser's
  `DOMParser`, displays each `<student>` as a card and shows the raw source.

## 7. Submission checklist

- [x] Project source code (PHP, HTML, CSS, JavaScript)
- [x] Database structure and SQL file (`database/university.sql`)
- [x] XML document (`data/students.xml` + generated page)
- [ ] Screenshots — capture from the running app; see `docs/screenshots/README.md`
- [x] Project report (`docs/PROJECT_REPORT.md`)

## 8. Default accounts

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `admin123` | Preloaded in the SQL file and seed data |

New accounts can be created from the **Create account** tab on the splash page.
Passwords are never stored in plain text (`password_hash()` in PHP, scrypt in
the demo server).
