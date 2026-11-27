<?php
/**
 * Authentication endpoint (Module 1).
 *   GET  api/auth.php?action=me  -> current session
 *   POST api/auth.php { action: login|register|logout, ... }
 */
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = isset($_GET['action']) ? (string) $_GET['action'] : '';
$body   = read_json_body();
if ($action === '') {
    $action = field($body, 'action');
}

if ($method === 'GET' && $action === 'me') {
    json_response(['ok' => true, 'user' => current_user()]);
}

if ($method !== 'POST') {
    json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

switch ($action) {
    case 'login': {
        $username = field($body, 'username');
        $password = field($body, 'password');
        $errors   = [];

        if ($username === '') {
            $errors['username'] = 'Username is required.';
        }
        if ($password === '') {
            $errors['password'] = 'Password is required.';
        }
        if ($errors) {
            json_response(['ok' => false, 'message' => 'Please correct the highlighted fields.', 'errors' => $errors], 422);
        }

        $stmt = db()->prepare('SELECT id, username, full_name, email, password_hash FROM users WHERE username = :identity OR email = :identity LIMIT 1');
        $stmt->execute([':identity' => $username]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            json_response(['ok' => false, 'message' => 'Invalid username or password.'], 401);
        }

        session_regenerate_id(true);
        $_SESSION['user'] = [
            'id'        => (int) $user['id'],
            'username'  => $user['username'],
            'full_name' => $user['full_name'],
            'email'     => $user['email'],
        ];
        json_response(['ok' => true, 'user' => $_SESSION['user']]);
        break;
    }

    case 'register': {
        $fullName        = field($body, 'full_name');
        $username        = field($body, 'username');
        $email           = strtolower(field($body, 'email'));
        $password        = field($body, 'password');
        $confirmPassword = field($body, 'confirm_password');
        $errors          = [];

        if (text_length($fullName) < 2 || text_length($fullName) > 100) {
            $errors['full_name'] = 'Enter your full name (2-100 characters).';
        }
        if (!preg_match('/^[A-Za-z0-9_]{3,30}$/', $username)) {
            $errors['username'] = 'Use 3-30 letters, numbers or underscores.';
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Enter a valid email address.';
        }
        if (strlen($password) < 6) {
            $errors['password'] = 'Password must be at least 6 characters.';
        }
        if ($password !== $confirmPassword) {
            $errors['confirm_password'] = 'Passwords do not match.';
        }
        if ($errors) {
            json_response(['ok' => false, 'message' => 'Please correct the highlighted fields.', 'errors' => $errors], 422);
        }

        $pdo = db();
        $check = $pdo->prepare('SELECT COUNT(*) FROM users WHERE username = :username OR email = :email');
        $check->execute([':username' => $username, ':email' => $email]);
        if ((int) $check->fetchColumn() > 0) {
            json_response([
                'ok'      => false,
                'message' => 'That username or email is already registered.',
                'errors'  => ['username' => 'Username or email already in use.'],
            ], 409);
        }

        $insert = $pdo->prepare(
            'INSERT INTO users (username, full_name, email, password_hash) VALUES (:username, :full_name, :email, :hash)'
        );
        $insert->execute([
            ':username'  => $username,
            ':full_name' => $fullName,
            ':email'     => $email,
            ':hash'      => password_hash($password, PASSWORD_DEFAULT),
        ]);

        session_regenerate_id(true);
        $_SESSION['user'] = [
            'id'        => (int) $pdo->lastInsertId(),
            'username'  => $username,
            'full_name' => $fullName,
            'email'     => $email,
        ];
        json_response(['ok' => true, 'user' => $_SESSION['user'], 'message' => 'Account created successfully.']);
        break;
    }

    case 'logout': {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        json_response(['ok' => true]);
        break;
    }

    default:
        json_response(['ok' => false, 'message' => 'Unknown action.'], 400);
}
