<?php
/**
 * Splash page / application entry point.
 *
 * The login screen is the first screen a visitor sees; after a successful
 * login the same page switches to the dashboard (hash-based navigation).
 */
declare(strict_types=1);
header('Cache-Control: no-store');
require __DIR__ . '/public/index.html';
