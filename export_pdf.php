<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/config/bootstrap.php';
require_once dirname(__DIR__) . '/config/simple_pdf.php';

require_auth();

$selectedId = trim((string) ($_GET['id'] ?? ''));
$detail = $selectedId !== '' ? fetch_offense_detail($selectedId) : null;
$lines = [];

if ($detail) {
    $lines = [
        'Offense ID: ' . $detail['offense_code'],
        'Driver: ' . $detail['driver_name'],
        'Vehicle Plate: ' . $detail['vehicle_plate'],
        'Offense Type: ' . $detail['offense_type'],
        'Status: ' . $detail['status'],
        'Location: ' . $detail['location'],
        'Occurred At: ' . $detail['occurred_at'],
        'Fine Amount: ZMW ' . number_format((float) $detail['fine_amount'], 2),
        'Officer: ' . $detail['officer_name'],
        'Notes: ' . preg_replace('/\s+/', ' ', (string) $detail['notes']),
    ];
    SimplePdf::output('offense-report-' . $detail['offense_code'] . '.pdf', 'Traffic Offense Detailed Report', $lines);
}

$lines[] = 'Traffic Offense Summary Report';
$lines[] = 'Generated: ' . date('Y-m-d H:i:s');
foreach (array_slice(fetch_offenses($_GET), 0, 30) as $offense) {
    $lines[] = sprintf(
        '%s | %s | %s | %s | ZMW %s',
        $offense['offense_code'],
        $offense['driver_name'],
        $offense['offense_type'],
        $offense['status'],
        number_format((float) $offense['fine_amount'], 2)
    );
}

SimplePdf::output('traffic-summary-report.pdf', 'Traffic Offense Summary', $lines);
