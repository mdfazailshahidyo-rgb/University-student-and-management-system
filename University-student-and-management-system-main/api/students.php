<?php
/**
 * Student CRUD endpoint (Modules 2 & 3).
 *   GET  api/students.php[?q=&course=&semester=&id=]
 *   POST api/students.php { action: create|update|delete, ... }
 */
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

require_login();

$pdo    = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    if (isset($_GET['id'])) {
        $stmt = $pdo->prepare('SELECT id, register_no, name, course, semester, email, contact, created_at FROM students WHERE id = :id');
        $stmt->execute([':id' => (int) $_GET['id']]);
        $student = $stmt->fetch();
        if (!$student) {
            json_response(['ok' => false, 'message' => 'Student record not found.'], 404);
        }
        json_response(['ok' => true, 'student' => $student]);
    }

    $where  = [];
    $params = [];

    $search = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
    if ($search !== '') {
        $where[] = '(register_no LIKE :search OR name LIKE :search OR email LIKE :search)';
        $params[':search'] = '%' . $search . '%';
    }

    $course = isset($_GET['course']) ? (string) $_GET['course'] : '';
    if ($course !== '' && in_array($course, COURSES, true)) {
        $where[] = 'course = :course';
        $params[':course'] = $course;
    }

    $semester = isset($_GET['semester']) ? (string) $_GET['semester'] : '';
    if ($semester !== '' && ctype_digit($semester) && (int) $semester >= 1 && (int) $semester <= 8) {
        $where[] = 'semester = :semester';
        $params[':semester'] = (int) $semester;
    }

    $sql = 'SELECT id, register_no, name, course, semester, email, contact, created_at FROM students';
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY id DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    json_response(['ok' => true, 'students' => $stmt->fetchAll()]);
}

if ($method !== 'POST') {
    json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

$body   = read_json_body();
$action = field($body, 'action');

/** Check register number / email uniqueness before INSERT or UPDATE. */
function assert_unique(PDO $pdo, array $values, int $excludeId = 0): void
{
    $sql = 'SELECT COUNT(*) FROM students WHERE (register_no = :register_no OR email = :email)';
    if ($excludeId > 0) {
        $sql .= ' AND id <> :exclude_id';
    }
    $stmt = $pdo->prepare($sql);
    $params = [
        ':register_no' => $values['register_no'],
        ':email'       => $values['email'],
    ];
    if ($excludeId > 0) {
        $params[':exclude_id'] = $excludeId;
    }
    $stmt->execute($params);
    if ((int) $stmt->fetchColumn() > 0) {
        json_response([
            'ok'      => false,
            'message' => 'A student with this register number or email already exists.',
            'errors'  => [
                'register_no' => 'Register number or email is already in use.',
                'email'       => 'Register number or email is already in use.',
            ],
        ], 409);
    }
}

switch ($action) {
    case 'create': {
        $errors = validate_student($body);
        if ($errors) {
            json_response(['ok' => false, 'message' => 'Please correct the highlighted fields.', 'errors' => $errors], 422);
        }
        $values = normalise_student($body);
        assert_unique($pdo, $values);

        $stmt = $pdo->prepare(
            'INSERT INTO students (register_no, name, course, semester, email, contact)
             VALUES (:register_no, :name, :course, :semester, :email, :contact)'
        );
        $stmt->execute($values);
        $id = (int) $pdo->lastInsertId();

        $saved = $pdo->query('SELECT id, register_no, name, course, semester, email, contact, created_at FROM students WHERE id = ' . $id)->fetch();
        json_response(['ok' => true, 'message' => 'Student added successfully.', 'student' => $saved], 201);
        break;
    }

    case 'update': {
        $id = (int) field($body, 'id');
        if ($id <= 0) {
            json_response(['ok' => false, 'message' => 'Invalid student id.'], 400);
        }
        $errors = validate_student($body);
        if ($errors) {
            json_response(['ok' => false, 'message' => 'Please correct the highlighted fields.', 'errors' => $errors], 422);
        }
        $values = normalise_student($body);

        $exists = $pdo->prepare('SELECT id FROM students WHERE id = :id');
        $exists->execute([':id' => $id]);
        if (!$exists->fetch()) {
            json_response(['ok' => false, 'message' => 'Student record not found.'], 404);
        }
        assert_unique($pdo, $values, $id);

        $values['id'] = $id;
        $stmt = $pdo->prepare(
            'UPDATE students SET register_no = :register_no, name = :name, course = :course,
                    semester = :semester, email = :email, contact = :contact
             WHERE id = :id'
        );
        $stmt->execute($values);

        $saved = $pdo->query('SELECT id, register_no, name, course, semester, email, contact, created_at FROM students WHERE id = ' . $id)->fetch();
        json_response(['ok' => true, 'message' => 'Student details updated successfully.', 'student' => $saved]);
        break;
    }

    case 'delete': {
        $id = (int) field($body, 'id');
        if ($id <= 0) {
            json_response(['ok' => false, 'message' => 'Invalid student id.'], 400);
        }
        $stmt = $pdo->prepare('DELETE FROM students WHERE id = :id');
        $stmt->execute([':id' => $id]);
        if ($stmt->rowCount() === 0) {
            json_response(['ok' => false, 'message' => 'Student record not found.'], 404);
        }
        json_response(['ok' => true, 'message' => 'Student record deleted successfully.']);
        break;
    }

    default:
        json_response(['ok' => false, 'message' => 'Unknown action.'], 400);
}
