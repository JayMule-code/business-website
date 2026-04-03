<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/config/bootstrap.php';

require_auth();

$selectedId = trim((string) ($_GET['id'] ?? ''));
$detail = $selectedId !== '' ? fetch_offense_detail($selectedId) : null;

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="traffic-report.csv"');

$out = fopen('php://output', 'w');

if ($detail) {
    fputcsv($out, ['Offense ID', 'Driver', 'Plate', 'Offense Type', 'Location', 'Occurred At', 'Fine Amount', 'Status', 'Officer']);
    fputcsv($out, [
        $detail['offense_code'],
        $detail['driver_name'],
        $detail['vehicle_plate'],
        $detail['offense_type'],
        $detail['location'],
        $detail['occurred_at'],
        $detail['fine_amount'],
        $detail['status'],
        $detail['officer_name'],
    ]);
} else {
    fputcsv($out, ['Offense ID', 'Driver', 'Plate', 'Offense Type', 'Location', 'Occurred At', 'Fine Amount', 'Status', 'Officer', 'Evidence Count']);
    foreach (fetch_offenses($_GET) as $offense) {
        fputcsv($out, [
            $offense['offense_code'],
            $offense['driver_name'],
            $offense['vehicle_plate'],
            $offense['offense_type'],
            $offense['location'],
            $offense['occurred_at'],
            $offense['fine_amount'],
            $offense['status'],
            $offense['officer_name'],
            $offense['evidence_count'],
        ]);
    }
}

fclose($out);
exit;
