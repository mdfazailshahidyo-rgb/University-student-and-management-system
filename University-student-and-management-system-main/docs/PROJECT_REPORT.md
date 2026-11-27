# Project Report

## University Student Information & Academic Management System

**Course:** Bachelor of Computer Applications (BCA)  
**Course outcome:** Develop interactive web applications by integrating front-end and back-end technologies.  
**Technologies:** HTML, CSS, JavaScript, PHP, MySQL, XML, XAMPP/WAMP  
**Demonstration deadline:** 30 November 2026

---

## 1. Introduction

Educational institutions handle a growing volume of student information. Manual
registers and spreadsheets make it difficult to keep records accurate, searchable
and portable. This project develops a web-based **Student Information and
Academic Management System** for a university.

The application lets authorised users log in, register new accounts and manage
student records through four operations — **add, edit, delete and display**.
Student data is stored in MySQL and accessed by PHP using prepared SQL
statements. A separate XML component exports the same records as a well-formed,
portable document and displays them on a dedicated XML page.

The project demonstrates the integration of all three tiers of a web
application: presentation (HTML/CSS/JavaScript), application (PHP) and data
(MySQL), together with XML as a data-exchange format.

## 2. Objectives

1. Design an interactive, responsive web interface using HTML and CSS.
2. Implement client-side validation using JavaScript.
3. Develop server-side functionality using PHP and session-based authentication.
4. Store and retrieve student records in MySQL using INSERT, SELECT, UPDATE and DELETE.
5. Create an XML document containing student records and display it on a separate page.
6. Integrate front-end, back-end, database and XML components into one application.
7. Generate student information dynamically rather than using static pages.

## 3. System architecture

```
Browser
  │  HTML structure + CSS styling + JavaScript validation / interactivity
  ▼
Presentation Layer  ──►  public/index.html, assets/css/styles.css, assets/js/app.js
  │  JSON requests (fetch, same origin, session cookie)
  ▼
Application Layer   ──►  api/auth.php, api/students.php, api/xml.php
  │  PDO prepared statements
  ▼
Database Layer      ──►  MySQL: university_student_management
                          ├── users
                          └── students
  │  XMLWriter serialisation
  ▼
XML Component       ──►  xml.php / data/students.xml  ──►  XML Records page
```

### Data flow

1. A visitor opens `index.php`. The JavaScript checks `api/auth.php?action=me`.
2. If no session exists, the **login splash page** is shown; the user may sign in
   or switch to the registration form.
3. Credentials are validated in the browser and again in PHP. A successful login
   creates a session and reveals the dashboard.
4. The dashboard and student table fetch records from `api/students.php`.
5. Add/Edit/Delete actions send a JSON POST request; PHP validates, runs the
   prepared SQL statement and returns a JSON result.
6. The XML page requests `xml.php`, which generates XML from the current MySQL
   records. The browser parses the document and renders the records.

## 4. Module descriptions

### Module 1 — User login and registration

* `index.php` is the splash page and always starts on the sign-in screen.
* Fields: username/email and password; a **Create account** tab allows new users
  to register with full name, username, email, password and confirmation.
* JavaScript checks required fields, username pattern, email format, minimum
  password length and password confirmation before any request is sent.
* PHP repeats every check, rejects duplicate usernames/emails and stores
  passwords with `password_hash()`. `password_verify()` is used at login.
* `session_regenerate_id(true)` prevents session fixation; logout destroys the
  session. Student APIs return HTTP 401 when no session exists.

### Module 2 — Student management

* **Add New Student:** modal form with register number, name, course, semester,
  email ID and contact number.
* **Edit Student Details:** the same form is pre-filled with the selected record;
  `action: "update"` sends the record id.
* **Delete Student Details:** confirmation dialog shows the student's name and
  register number before the delete request.
* **Display Student Details:** responsive table with live search and course and
  semester filters. The dashboard additionally shows statistics, the five most
  recent admissions and a course-distribution chart.
* Inline field errors, success/error toasts and an empty state provide feedback.

### Module 3 — Database management using MySQL

* `database/university.sql` creates the database, both tables, the default
  account and eight sample students.
* `api/config.php` holds connection settings; `api/db.php` creates a single PDO
  connection with exceptions enabled and `FETCH_ASSOC` results.
* All queries use named placeholders (`prepare` + `execute`), which prevents SQL
  injection. Course/semester filters are whitelisted before being added to SQL.
* Uniqueness of register number and email is enforced both by unique indexes and
  by an application-level check returning HTTP 409.

### Module 4 — XML implementation

* `data/students.xml` is the submission XML document with `<university>`,
  `<metadata>`, `<students>` and `<student id="…">` nodes containing register
  number, name, course, semester, email and contact.
* `api/xml.php` builds the same structure dynamically from MySQL with
  `XMLWriter`, escaping all text values. `xml.php` is a convenience link and
  `?download=1` forces a file download.
* The **XML Records** page loads the document, parses it with `DOMParser`,
  displays each record in a card and shows the raw XML source with basic syntax
  colouring.

## 5. Database design

### Table: `users`

| Field | Type | Constraints | Purpose |
| --- | --- | --- | --- |
| `id` | INT UNSIGNED | PRIMARY KEY, AUTO_INCREMENT | Unique user ID |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL | Login name |
| `full_name` | VARCHAR(100) | NOT NULL | Display name |
| `email` | VARCHAR(150) | UNIQUE, NOT NULL | Login / contact email |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt hash |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Registration time |

### Table: `students`

| Field | Type | Constraints | Purpose |
| --- | --- | --- | --- |
| `id` | INT UNSIGNED | PRIMARY KEY, AUTO_INCREMENT | Unique record ID |
| `register_no` | VARCHAR(30) | UNIQUE, NOT NULL | University register number |
| `name` | VARCHAR(100) | NOT NULL | Student name |
| `course` | VARCHAR(60) | NOT NULL | Programme name |
| `semester` | TINYINT UNSIGNED | CHECK (1–8) | Current semester |
| `email` | VARCHAR(150) | UNIQUE, NOT NULL | Email ID |
| `contact` | VARCHAR(15) | NOT NULL | 10-digit mobile number |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Last modification time |

**Relationships:** each user can manage many student records; the application
does not expose ownership across users in this single-workspace project.

## 6. Program implementation

### 6.1 PHP–MySQL connection (`api/db.php`)

```php
$dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT .
       ';dbname=' . DB_NAME . ';charset=utf8mb4';
$pdo = new PDO($dsn, DB_USER, DB_PASS, [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
]);
```

### 6.2 INSERT operation (`api/students.php`)

```php
$stmt = $pdo->prepare(
    'INSERT INTO students (register_no, name, course, semester, email, contact)
     VALUES (:register_no, :name, :course, :semester, :email, :contact)'
);
$stmt->execute($values);
```

### 6.3 SELECT with filters

```php
$sql = 'SELECT id, register_no, name, course, semester, email, contact
        FROM students';
if ($where) {
    $sql .= ' WHERE ' . implode(' AND ', $where);
}
$sql .= ' ORDER BY id DESC';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$students = $stmt->fetchAll();
```

### 6.4 UPDATE and DELETE operations

```php
$stmt = $pdo->prepare(
    'UPDATE students SET register_no = :register_no, name = :name,
            course = :course, semester = :semester, email = :email,
            contact = :contact
     WHERE id = :id'
);
$stmt->execute($values);

$stmt = $pdo->prepare('DELETE FROM students WHERE id = :id');
$stmt->execute([':id' => $id]);
```

### 6.5 JavaScript client-side validation

```js
function validateStudent(values) {
  const errors = {};
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{2,29}$/.test(values.register_no.trim()))
    errors.register_no = 'Use 3-30 letters, numbers or hyphens.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
    errors.email = 'Enter a valid email address.';
  if (!/^[6-9][0-9]{9}$/.test(values.contact.trim()))
    errors.contact = 'Enter a valid 10-digit mobile number.';
  return errors;
}
```

The PHP function `validate_student()` in `api/helpers.php` applies the same
rules again on the server before the database is touched.

### 6.6 XML generation (`api/xml.php`)

```php
$students = db()
    ->query('SELECT id, register_no, name, course, semester, email, contact
             FROM students ORDER BY id ASC')
    ->fetchAll();
header('Content-Type: application/xml; charset=utf-8');
echo students_to_xml($students);   // XMLWriter, indented and escaped
```

## 7. Output screenshots

Screenshots should be captured after starting the application (XAMPP or
`node demo/server.js`). Use Windows `Snip & Sketch` (`Win + Shift + S`), macOS
`Cmd + Shift + 4`, or Chrome DevTools (`Ctrl/Cmd + Shift + P` → *Capture
screenshot*). Save them in `docs/screenshots/`.

| # | Screen | How to capture |
| --- | --- | --- |
| 1 | Login splash page | Open `index.php` while signed out |
| 2 | Registration form | Click **Create account** on the splash page |
| 3 | Dashboard | Sign in as `admin` / `admin123` |
| 4 | Student records table | Click **Students** in the sidebar |
| 5 | Add student form | Click **Add student**, fill in sample values |
| 6 | Edit student form | Click the pencil icon on any row |
| 7 | Delete confirmation | Click the bin icon on any row |
| 8 | XML records page | Click **XML Records** in the sidebar |
| 9 | Raw XML document | Open **View XML** in a new tab |
| 10 | Validation errors | Submit an empty Add Student form |

## 8. Testing summary

| Test | Expected result |
| --- | --- |
| Login with correct credentials | Session created, dashboard displayed |
| Login with wrong credentials | “Invalid username or password”, no session |
| Register with an existing email | HTTP 409 with a field error |
| Add a valid student | New row appears; record stored in MySQL |
| Add duplicate register number | HTTP 409, no duplicate row |
| Edit a student | Existing record is updated |
| Delete a student | Confirmation shown, then record removed |
| Search / filter | Only matching rows displayed |
| Open XML page | Well-formed XML with all student records |
| Sign out | Session cleared; protected APIs return HTTP 401 |

## 9. Conclusion

The project successfully implements a web-based university student information
system using HTML, CSS, JavaScript, PHP, MySQL and XML. All required modules —
authentication, student CRUD, database operations and XML storage/display —
work together through a consistent interface. Server-side validation, prepared
SQL statements and hashed passwords make the application more robust and
secure than a static demonstration.

The system meets the stated objectives and can be extended with role-based
access, pagination, CSV/PDF reports and a fuller academic records module.

---

**Submitted by:** ____________________  **Register number:** ____________________
