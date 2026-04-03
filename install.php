<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/config/bootstrap.php';

$pdo = db();
$schema = file_get_contents(__DIR__ . '/schema.sql');

foreach (array_filter(array_map('trim', explode(';', (string) $schema))) as $statement) {
    $pdo->exec($statement);
}

$hasUsers = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();

if ($hasUsers === 0) {
    $password = password_hash('password', PASSWORD_DEFAULT);

    $pdo->exec("
        INSERT INTO users (
            service_number, email, phone, password_hash, first_name, last_name, role, rank_title,
            province, station, nrc, supervisor_name, account_status, created_at, updated_at
        ) VALUES
        ('RTZ-20240001', 'mwale.kabwe@rtsa.local', '+260977123456', '{$password}', 'Mwale', 'Kabwe', 'officer', 'Sergeant', 'Lusaka Province', 'Great East Rd', '124578/90/1', 'Commander Phiri', 'ACTIVE', NOW(), NOW()),
        ('RTZ-20240002', 'banda.james@rtsa.local', '+260966234567', '{$password}', 'Banda', 'James', 'officer', 'Constable', 'Lusaka Province', 'Cairo Rd', '234890/10/2', 'Commander Phiri', 'ACTIVE', NOW(), NOW()),
        ('ADM-20240001', 'admin@rtsa.local', '+260966000001', '{$password}', 'System', 'Admin', 'admin', 'Director', 'Lusaka Province', 'HQ', '000000/00/0', 'Board', 'ACTIVE', NOW(), NOW()),
        ('CTZ-20240001', 'citizen@rtsa.local', '+260955000001', '{$password}', 'Citizen', 'Portal', 'citizen', 'Driver', 'Lusaka Province', 'Online', '567123/13/5', '', 'ACTIVE', NOW(), NOW())
    ");

    $pdo->exec("
        INSERT INTO citizens (
            user_id, nrc, first_name, last_name, phone, email, license_number, license_class, province, status, created_at, updated_at
        ) VALUES
        (NULL, '124578/90/1', 'John', 'Mwale', '+260977123456', 'john.mwale@example.com', 'ZR-2019-00821', 'Class C - Private', 'Lusaka Province', 'Active', NOW(), NOW()),
        (NULL, '234890/10/2', 'Grace', 'Phiri', '+260966234567', 'grace.phiri@example.com', 'ZR-2020-01234', 'Class C - Private', 'Lusaka Province', 'Clear', NOW(), NOW()),
        (NULL, '345901/11/3', 'Peter', 'Tembo', '+260955345678', 'peter.tembo@example.com', 'ZR-2018-00512', 'Class B - Commercial', 'Copperbelt Province', 'Pending', NOW(), NOW()),
        (4, '567123/13/5', 'Citizen', 'Portal', '+260955000001', 'citizen@rtsa.local', 'ZR-2024-04001', 'Class C - Private', 'Lusaka Province', 'Active', NOW(), NOW())
    ");

    $pdo->exec("
        INSERT INTO vehicles (
            owner_citizen_id, plate_number, make, model, vehicle_year, colour, chassis_number,
            roadworthy_expiry, insurance_status, status, created_at, updated_at
        ) VALUES
        (1, 'ABJ 4521 ZM', 'Toyota', 'Corolla', 2019, 'Silver', 'VIN-ABJ4521', DATE_ADD(CURDATE(), INTERVAL 90 DAY), 'Valid', 'Flagged', NOW(), NOW()),
        (2, 'GHK 9873 ZM', 'Honda', 'Fit', 2020, 'White', 'VIN-GHK9873', DATE_ADD(CURDATE(), INTERVAL 180 DAY), 'Valid', 'Clear', NOW(), NOW()),
        (3, 'LKZ 2210 ZM', 'Nissan', 'Navara', 2018, 'Blue', 'VIN-LKZ2210', DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'Valid', 'Active', NOW(), NOW()),
        (4, 'XYZ 1190 ZM', 'Isuzu', 'Truck', 2017, 'Red', 'VIN-XYZ1190', DATE_ADD(CURDATE(), INTERVAL 120 DAY), 'Valid', 'Active', NOW(), NOW())
    ");

    $pdo->exec("
        INSERT INTO officer_locations (
            officer_user_id, checkpoint, latitude, longitude, duty_status, last_seen_at, created_at, updated_at
        ) VALUES
        (1, 'Great East Rd', -15.3875000, 28.3228000, 'On Duty', NOW(), NOW(), NOW()),
        (2, 'Cairo Rd', -15.4167000, 28.2833000, 'On Duty', NOW(), NOW(), NOW()),
        (3, 'HQ', -15.4000000, 28.3000000, 'Off Duty', NOW(), NOW(), NOW())
    ");

    $pdo->exec("
        INSERT INTO offense_types (name, category, amount, demerit_points, description, created_at, updated_at)
        VALUES
        ('Speeding', 'High', 500, 3, 'Exceeded the posted speed limit.', NOW(), NOW()),
        ('DUI / Drunk Driving', 'Critical', 2000, 10, 'Driving under the influence of alcohol.', NOW(), NOW()),
        ('Red Light', 'Medium', 300, 4, 'Crossed a red traffic signal.', NOW(), NOW()),
        ('No Seatbelt', 'Low', 150, 1, 'Driver or passenger not wearing a seatbelt.', NOW(), NOW()),
        ('Using Phone', 'Medium', 400, 3, 'Using a mobile phone while driving.', NOW(), NOW()),
        ('Overloading', 'Medium', 800, 2, 'Vehicle over permissible loading limits.', NOW(), NOW()),
        ('No License', 'High', 1500, 8, 'Operating without a valid license.', NOW(), NOW())
    ");

    $pdo->exec("
        INSERT INTO offenses (
            offense_code, citizen_id, vehicle_id, vehicle_plate, driver_name, offense_type_id, location, speed_recorded,
            occurred_at, fine_amount, status, notes, officer_user_id, created_at, updated_at
        ) VALUES
        ('OFF-2026-1001', 1, 1, 'ABJ 4521 ZM', 'John Mwale', 1, 'Great East Rd', 82, NOW() - INTERVAL 2 HOUR, 500, 'Unpaid', 'Radar capture confirmed.', 1, NOW(), NOW()),
        ('OFF-2026-1002', 2, 2, 'GHK 9873 ZM', 'Grace Phiri', 3, 'Cairo Rd', NULL, NOW() - INTERVAL 3 HOUR, 300, 'Paid', 'Signal camera evidence available.', 2, NOW(), NOW()),
        ('OFF-2026-1003', 3, 3, 'LKZ 2210 ZM', 'Peter Tembo', 4, 'Kafue Rd', NULL, NOW() - INTERVAL 5 HOUR, 150, 'Pending', 'Stopped at checkpoint.', 1, NOW(), NOW()),
        ('OFF-2026-1004', 4, 4, 'XYZ 1190 ZM', 'Citizen Portal', 5, 'Mumbwa Rd', NULL, NOW() - INTERVAL 8 HOUR, 400, 'Disputed', 'Driver requested review.', 1, NOW(), NOW())
    ");

    $pdo->exec("
        INSERT INTO transactions (
            transaction_code, offense_id, method, account_reference, amount, status, processed_by, processed_at, created_at
        ) VALUES
        ('TXN-2026-7001', 2, 'MTN Mobile Money', '+260966234567', 300, 'Success', 1, NOW() - INTERVAL 2 HOUR, NOW()),
        ('TXN-2026-7002', 3, 'Airtel Money', '+260955345678', 100, 'Pending', 2, NOW() - INTERVAL 1 HOUR, NOW())
    ");

    $pdo->exec("
        INSERT INTO notifications (
            recipient_type, recipient_reference, channel, message, delivery_status, sent_by, sent_at, created_at
        ) VALUES
        ('Driver (by NRC / Plate)', 'ABJ 4521 ZM', 'SMS', 'Fine due reminder for offense OFF-2026-1001.', 'Sent', 1, NOW() - INTERVAL 30 MINUTE, NOW()),
        ('All Officers - Lusaka', 'Lusaka Province', 'In-App', 'Checkpoint briefing at 07:00 for all active officers.', 'Sent', 3, NOW() - INTERVAL 2 HOUR, NOW())
    ");

    $pdo->exec("
        INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at)
        VALUES
        ('organization_name', 'Road Transport & Safety Agency (RTSA)', 3, NOW()),
        ('default_province', 'Lusaka Province', 3, NOW()),
        ('currency', 'ZMW - Zambian Kwacha', 3, NOW()),
        ('date_format', 'DD/MM/YYYY', 3, NOW())
    ");
}

header('Content-Type: text/plain; charset=utf-8');
echo "Installation complete.\n";
echo "Default active logins:\n";
echo "Officer: RTZ-20240001 / password\n";
echo "Admin: ADM-20240001 / password\n";
echo "Citizen: CTZ-20240001 / password\n";
