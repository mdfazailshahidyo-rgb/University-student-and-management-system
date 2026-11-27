<?php
/**
 * XML component: generates a well-formed XML document from the MySQL records.
 * Open api/xml.php or xml.php in the browser to view the raw XML.
 * Add ?download=1 to save it as students.xml.
 */
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

$students = db()
    ->query('SELECT id, register_no, name, course, semester, email, contact FROM students ORDER BY id ASC')
    ->fetchAll();

$xml = students_to_xml($students);

header('Content-Type: application/xml; charset=utf-8');
header('Cache-Control: no-store');
if (isset($_GET['download'])) {
    header('Content-Disposition: attachment; filename="students.xml"');
}
echo $xml;
