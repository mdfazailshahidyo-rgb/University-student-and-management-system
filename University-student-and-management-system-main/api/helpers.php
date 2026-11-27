<?php
/** Shared helpers: JSON responses, sessions, validation and XML generation. */
declare(strict_types=1);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

const COURSES = [
    'BCA',
    'B.Sc Computer Science',
    'B.Com',
    'BBA',
    'B.A.',
    'B.Tech CSE',
];

/** Send a JSON response and stop execution. */
function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/** Decode a JSON request body into an array. */
function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

/** Trim a string field coming from the request. */
function field(array $data, string $key): string
{
    return isset($data[$key]) && is_scalar($data[$key])
        ? trim((string) $data[$key])
        : '';
}

/** The logged-in user from the session, or null. */
function current_user(): ?array
{
    return isset($_SESSION['user']) && is_array($_SESSION['user']) ? $_SESSION['user'] : null;
}

/** Guard for endpoints that require an authenticated session. */
function require_login(): array
{
    $user = current_user();
    if ($user === null) {
        json_response(['ok' => false, 'message' => 'Please log in to continue.'], 401);
    }
    return $user;
}

/** Character count that also works without the mbstring extension. */
function text_length(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

/**
 * Client-independent server-side validation for a student record.
 * Returns an associative array of field => message.
 */
function validate_student(array $data): array
{
    $errors = [];

    $registerNo = field($data, 'register_no');
    if ($registerNo === '') {
        $errors['register_no'] = 'Register number is required.';
    } elseif (!preg_match('/^[A-Za-z0-9][A-Za-z0-9-]{2,29}$/', $registerNo)) {
        $errors['register_no'] = 'Use 3-30 letters, numbers or hyphens.';
    }

    $name = field($data, 'name');
    if ($name === '') {
        $errors['name'] = 'Student name is required.';
    } elseif (text_length($name) < 2 || text_length($name) > 100) {
        $errors['name'] = 'Name must be between 2 and 100 characters.';
    } elseif (!preg_match('/^[\p{L}][\p{L}\p{M} .\'\-]*$/u', $name)) {
        $errors['name'] = 'Name may contain only letters, spaces, dots and hyphens.';
    }

    if (!in_array(field($data, 'course'), COURSES, true)) {
        $errors['course'] = 'Choose a valid course.';
    }

    $semester = field($data, 'semester');
    if ($semester === '' || !ctype_digit($semester) || (int) $semester < 1 || (int) $semester > 8) {
        $errors['semester'] = 'Semester must be a number from 1 to 8.';
    }

    $email = field($data, 'email');
    if ($email === '') {
        $errors['email'] = 'Email ID is required.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Enter a valid email address.';
    }

    $contact = field($data, 'contact');
    if ($contact === '') {
        $errors['contact'] = 'Contact number is required.';
    } elseif (!preg_match('/^[6-9][0-9]{9}$/', $contact)) {
        $errors['contact'] = 'Enter a valid 10-digit mobile number.';
    }

    return $errors;
}

/** Convert a validated request into the values stored in MySQL. */
function normalise_student(array $data): array
{
    return [
        'register_no' => strtoupper(field($data, 'register_no')),
        'name'        => field($data, 'name'),
        'course'      => field($data, 'course'),
        'semester'    => (int) field($data, 'semester'),
        'email'       => strtolower(field($data, 'email')),
        'contact'     => field($data, 'contact'),
    ];
}

/** Build the XML document that represents the current student records. */
function students_to_xml(array $students): string
{
    $writer = new XMLWriter();
    $writer->openMemory();
    $writer->setIndent(true);
    $writer->setIndentString('  ');
    $writer->startDocument('1.0', 'UTF-8');

    $writer->startElement('university');
    $writer->writeAttribute('name', 'MD University');
    $writer->writeAttribute('generated', date('Y-m-d'));

    $writer->startElement('metadata');
    $writer->writeElement('totalRecords', (string) count($students));
    $writer->writeElement('source', 'MySQL database: university_student_management');
    $writer->endElement(); // metadata

    $writer->startElement('students');
    foreach ($students as $student) {
        $writer->startElement('student');
        $writer->writeAttribute('id', (string) (int) $student['id']);
        $writer->writeElement('registerNo', (string) $student['register_no']);
        $writer->writeElement('name', (string) $student['name']);
        $writer->writeElement('course', (string) $student['course']);
        $writer->writeElement('semester', (string) (int) $student['semester']);
        $writer->writeElement('email', (string) $student['email']);
        $writer->writeElement('contact', (string) $student['contact']);
        $writer->endElement(); // student
    }
    $writer->endElement(); // students
    $writer->endElement(); // university
    $writer->endDocument();

    return $writer->outputMemory(true);
}
