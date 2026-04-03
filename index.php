<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/config/bootstrap.php';

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function require_admin_role(): array
{
    $user = require_auth();
    if (($user['role'] ?? '') !== 'admin') {
        json_response(['ok' => false, 'message' => 'Administrator access required.'], 403);
    }
    return $user;
}

try {
    switch ($action) {
        case 'me':
            json_response(['ok' => true, 'user' => current_user()]);

        case 'my_profile':
            $user = require_auth();
            $profile = fetch_user_profile((int) $user['id']);
            if (!$profile) {
                json_response(['ok' => false, 'message' => 'Profile not found.'], 404);
            }
            json_response(['ok' => true, 'data' => $profile]);

        case 'login':
            if ($method !== 'POST') {
                json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
            }

            $payload = request_payload();
            $identifier = trim((string) ($payload['identifier'] ?? ''));
            $password = (string) ($payload['password'] ?? '');

            if ($identifier === '' || $password === '') {
                json_response(['ok' => false, 'message' => 'Service number, email, or phone plus password are required.'], 422);
            }

            $stmt = db()->prepare(
                'SELECT * FROM users
                 WHERE service_number = :identifier OR email = :identifier OR phone = :identifier
                 LIMIT 1'
            );
            $stmt->execute(['identifier' => $identifier]);
            $user = $stmt->fetch();

            if (!$user) {
                json_response(['ok' => false, 'message' => 'Account not found. Please register first or contact the administrator.'], 404);
            }

            if (!password_verify($password, $user['password_hash'])) {
                json_response(['ok' => false, 'message' => 'Wrong login details. Please check your password and try again.'], 401);
            }

            if ($user['account_status'] !== 'ACTIVE') {
    $registeredAt = strtotime((string) $user['created_at']);
    $activationTime = $registeredAt + (5 * 60);

    if ($registeredAt && time() >= $activationTime) {
        db()->prepare("
            UPDATE users
            SET account_status = 'ACTIVE', updated_at = NOW()
            WHERE id = :id
        ")->execute(['id' => $user['id']]);

        $user['account_status'] = 'ACTIVE';
    } else {
        $remainingSeconds = max(0, $activationTime - time());
        $remainingMinutes = ceil($remainingSeconds / 60);

        json_response([
            'ok' => false,
            'message' => "Your account is not active yet. It will activate automatically in about {$remainingMinutes} minute(s).",
        ], 403);
    }
}


            db()->prepare('UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = :id')
                ->execute(['id' => $user['id']]);

            if (in_array($user['role'], ['officer', 'admin'], true)) {
                $locationStmt = db()->prepare(
                    'INSERT INTO officer_locations (
                        officer_user_id, checkpoint, province, latitude, longitude, duty_status, recorded_at
                     ) VALUES (
                        :officer_user_id, :checkpoint, :province, NULL, NULL, :duty_status, NOW()
                     )
                     ON DUPLICATE KEY UPDATE
                        checkpoint = VALUES(checkpoint),
                        province = VALUES(province),
                        duty_status = VALUES(duty_status),
                        recorded_at = NOW()'
                );
                $locationStmt->execute([
                    'officer_user_id' => $user['id'],
                    'checkpoint' => trim((string) ($user['station'] ?? '')) ?: 'Active Session',
                    'province' => trim((string) ($user['province'] ?? '')) ?: 'Unassigned',
                    'duty_status' => 'On Duty',
                ]);
            }

            log_audit_event($user, 'login', 'session', (string) ($user['service_number'] ?? $user['email'] ?? $user['id']), 'User authenticated successfully.');

            $_SESSION['user_id'] = (int) $user['id'];
            json_response(['ok' => true, 'user' => current_user()]);

        case 'logout':
            $activeUser = current_user();
            if ($activeUser && in_array($activeUser['role'], ['officer', 'admin'], true)) {
                db()->prepare(
                    'UPDATE officer_locations
                     SET duty_status = :duty_status, recorded_at = NOW()
                     WHERE officer_user_id = :officer_user_id'
                )->execute([
                    'duty_status' => 'Off Duty',
                    'officer_user_id' => $activeUser['id'],
                ]);
            }

            if ($activeUser) {
                log_audit_event($activeUser, 'logout', 'session', (string) ($activeUser['service_number'] ?? $activeUser['email'] ?? $activeUser['id']), 'User signed out.');
            }

            $_SESSION = [];
            session_destroy();
            json_response(['ok' => true]);

        case 'citizen_lookup':
            if ($method !== 'POST') {
                json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
            }

            $payload = request_payload();
            $nrc = trim((string) ($payload['nrc'] ?? ''));
            $plate = trim((string) ($payload['plate'] ?? ''));

            if ($nrc === '' || $plate === '') {
                json_response(['ok' => false, 'message' => 'Enter both NRC and vehicle plate number.'], 422);
            }

            $lookup = citizen_portal_lookup($nrc, $plate);
            if (!$lookup) {
                json_response(['ok' => false, 'message' => 'No citizen vehicle record was found for that NRC and plate number.'], 404);
            }

            json_response(['ok' => true, 'data' => $lookup]);

        case 'citizen_pay':
            if ($method !== 'POST') {
                json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
            }

            $payload = request_payload();
            $nrc = trim((string) ($payload['nrc'] ?? ''));
            $plate = trim((string) ($payload['plate'] ?? ''));
            $offenseCode = trim((string) ($payload['offense_code'] ?? ''));
            $methodName = trim((string) ($payload['method'] ?? ''));
            $account = trim((string) ($payload['account_reference'] ?? ''));
            $amount = (float) ($payload['amount'] ?? 0);

            if ($nrc === '' || $plate === '' || $offenseCode === '' || $methodName === '' || $account === '' || $amount <= 0) {
                json_response(['ok' => false, 'message' => 'Complete the payment form with valid values.'], 422);
            }

            $lookup = citizen_portal_lookup($nrc, $plate);
            if (!$lookup) {
                json_response(['ok' => false, 'message' => 'The citizen vehicle details could not be verified.'], 404);
            }

            $matchedOffense = null;
            foreach ($lookup['offenses'] as $row) {
                if ($row['offense_code'] === $offenseCode) {
                    $matchedOffense = $row;
                    break;
                }
            }

            if (!$matchedOffense) {
                json_response(['ok' => false, 'message' => 'That offense does not belong to the supplied NRC and plate.'], 403);
            }

            $pdo = db();
            $transactionCode = generate_code('TXN');
            $status = $amount >= (float) $matchedOffense['balance_due'] ? 'Success' : 'Pending';
            $insert = $pdo->prepare(
                'INSERT INTO transactions (
                    transaction_code, offense_id, method, account_reference, amount, status, processed_by, processed_at, created_at
                 ) VALUES (
                    :transaction_code, :offense_id, :method, :account_reference, :amount, :status, :processed_by, NOW(), NOW()
                 )'
            );
            $insert->execute([
                'transaction_code' => $transactionCode,
                'offense_id' => $matchedOffense['id'],
                'method' => $methodName,
                'account_reference' => $account,
                'amount' => $amount,
                'status' => $status,
                'processed_by' => null,
            ]);

            $pdo->prepare('UPDATE offenses SET status = :status, updated_at = NOW() WHERE id = :id')
                ->execute([
                    'status' => $status === 'Success' ? 'Paid' : 'Pending',
                    'id' => $matchedOffense['id'],
                ]);

            log_audit_event(null, 'citizen_payment', 'offense', $matchedOffense['offense_code'], 'Citizen portal payment recorded: ' . $transactionCode);
            json_response([
                'ok' => true,
                'message' => 'Payment recorded successfully.',
                'transaction_code' => $transactionCode,
                'receipt' => [
                    'transaction_code' => $transactionCode,
                    'status' => $status,
                    'processed_at' => date('Y-m-d H:i:s'),
                    'method' => $methodName,
                    'account_reference' => $account,
                    'amount' => $amount,
                    'citizen_name' => $lookup['citizen']['full_name'],
                    'nrc' => $lookup['citizen']['nrc'],
                    'plate_number' => $lookup['vehicle']['plate_number'],
                    'offense_code' => $matchedOffense['offense_code'],
                    'offense_type' => $matchedOffense['offense_type'],
                    'fine_amount' => $matchedOffense['fine_amount'],
                    'balance_due' => max(0, (float) $matchedOffense['balance_due'] - $amount),
                ],
            ]);

        case 'register':
            if ($method !== 'POST') {
                json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
            }

            $payload = request_payload();
            $required = ['first_name', 'last_name', 'phone', 'email', 'service_number', 'password'];

            foreach ($required as $field) {
                if (trim((string) ($payload[$field] ?? '')) === '') {
                    json_response(['ok' => false, 'message' => 'Please complete all required registration fields.'], 422);
                }
            }

            $pdo = db();
            $check = $pdo->prepare(
                'SELECT COUNT(*)
                 FROM users
                 WHERE service_number = :service OR email = :email OR phone = :phone'
            );
            $check->execute([
                'service' => trim((string) $payload['service_number']),
                'email' => trim((string) $payload['email']),
                'phone' => trim((string) $payload['phone']),
            ]);

            if ((int) $check->fetchColumn() > 0) {
                json_response(['ok' => false, 'message' => 'An account with that service number, email, or phone already exists.'], 409);
            }

            $insert = $pdo->prepare(
                'INSERT INTO users (
                    service_number, email, phone, password_hash, first_name, last_name, role, rank_title,
                    province, station, nrc, dob, supervisor_name, account_status, created_at, updated_at
                 ) VALUES (
                    :service_number, :email, :phone, :password_hash, :first_name, :last_name, :role, :rank_title,
                    :province, :station, :nrc, :dob, :supervisor_name, :account_status, NOW(), NOW()
                 )'
            );

            $role = normalize_role((string) ($payload['role'] ?? 'officer'));
            $insert->execute([
                'service_number' => trim((string) $payload['service_number']),
                'email' => trim((string) $payload['email']),
                'phone' => trim((string) $payload['phone']),
                'password_hash' => password_hash((string) $payload['password'], PASSWORD_DEFAULT),
                'first_name' => trim((string) $payload['first_name']),
                'last_name' => trim((string) $payload['last_name']),
                'role' => $role,
                'rank_title' => $role === 'officer' ? 'Officer' : ucfirst($role),
                'province' => trim((string) ($payload['province'] ?? '')),
                'station' => trim((string) ($payload['station'] ?? '')),
                'nrc' => trim((string) ($payload['nrc'] ?? '')),
                'dob' => !empty($payload['dob']) ? $payload['dob'] : null,
                'supervisor_name' => trim((string) ($payload['supervisor'] ?? '')),
                'account_status' => 'PENDING',
            ]);

            log_audit_event(null, 'register', 'user', (string) $payload['service_number'], 'New account registration submitted.');
            json_response(['ok' => true, 'message' => 'Registration submitted successfully.']);

        case 'dashboard':
            require_auth();
            json_response(['ok' => true, 'data' => dashboard_snapshot()]);

        case 'analytics':
            require_auth();
            json_response(['ok' => true, 'data' => analytics_snapshot()]);

        case 'admin_overview':
            require_admin_role();
            json_response(['ok' => true, 'data' => fetch_admin_overview()]);

        case 'admin_accounts':
            require_admin_role();
            json_response(['ok' => true, 'data' => fetch_admin_accounts()]);

        case 'admin_audit':
            require_admin_role();
            json_response(['ok' => true, 'data' => fetch_audit_trails()]);

        case 'admin_set_user_status':
            $admin = require_admin_role();
            if ($method !== 'POST') {
                json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
            }

            $payload = request_payload();
            $userId = (int) ($payload['user_id'] ?? 0);
            $status = strtoupper(trim((string) ($payload['account_status'] ?? '')));
            $allowedStatuses = ['ACTIVE', 'PENDING', 'DISABLED'];

            if ($userId <= 0 || !in_array($status, $allowedStatuses, true)) {
                json_response(['ok' => false, 'message' => 'Provide a valid user account and status.'], 422);
            }

            db()->prepare(
                'UPDATE users
                 SET account_status = :account_status, updated_at = NOW()
                 WHERE id = :id'
            )->execute([
                'account_status' => $status,
                'id' => $userId,
            ]);

            $userStmt = db()->prepare('SELECT service_number, email FROM users WHERE id = :id LIMIT 1');
            $userStmt->execute(['id' => $userId]);
            $updatedUser = $userStmt->fetch() ?: ['service_number' => 'Unknown', 'email' => ''];

            log_audit_event(
                $admin,
                'account_status_changed',
                'user',
                (string) ($updatedUser['service_number'] ?: $updatedUser['email'] ?: $userId),
                'Administrator changed account status to ' . $status . '.'
            );

            json_response(['ok' => true, 'message' => 'User account status updated.']);

        case 'offenses':
            require_auth();
            json_response(['ok' => true, 'data' => fetch_offenses($_GET)]);

        case 'offense_detail':
            require_auth();
            $code = trim((string) ($_GET['id'] ?? ''));
            $detail = $code !== '' ? fetch_offense_detail($code) : null;
            if (!$detail) {
                json_response(['ok' => false, 'message' => 'Offense not found.'], 404);
            }

            json_response(['ok' => true, 'data' => $detail]);

        case 'save_offense':
            $user = require_auth();
            if ($method !== 'POST') {
                json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
            }

            $payload = $_POST;
            $plate = trim((string) ($payload['vehicle_plate'] ?? ''));
            $driver = trim((string) ($payload['driver_name'] ?? ''));
            $typeName = trim((string) ($payload['offense_type'] ?? ''));
            $location = trim((string) ($payload['location'] ?? ''));
            $status = trim((string) ($payload['status'] ?? 'Pending'));
            $occurredAt = trim((string) ($payload['occurred_at'] ?? ''));

            if ($plate === '' || $driver === '' || $typeName === '' || $location === '' || $occurredAt === '') {
                json_response(['ok' => false, 'message' => 'Please complete the offense form before saving.'], 422);
            }

            $fineAmount = (float) ($payload['fine_amount'] ?? 0);
            $speed = ($payload['speed_recorded'] ?? '') !== '' ? (int) $payload['speed_recorded'] : null;
            $notes = trim((string) ($payload['notes'] ?? ''));

            $pdo = db();
            $typeId = find_or_create_offense_type($typeName, null, $fineAmount ?: null, null);
            $citizen = find_citizen_by_identifier($payload['citizen_identifier'] ?? $driver);
            $vehicle = find_vehicle_by_plate($plate);
            $offenseCode = trim((string) ($payload['offense_code'] ?? ''));
            $existingId = null;

            if ($offenseCode !== '') {
                $existingStmt = $pdo->prepare('SELECT id FROM offenses WHERE offense_code = :code LIMIT 1');
                $existingStmt->execute(['code' => $offenseCode]);
                $existingId = $existingStmt->fetchColumn() ?: null;
            }

            $params = [
                'citizen_id' => $citizen['id'] ?? null,
                'vehicle_id' => $vehicle['id'] ?? null,
                'vehicle_plate' => $plate,
                'driver_name' => $driver,
                'offense_type_id' => $typeId,
                'location' => $location,
                'speed_recorded' => $speed,
                'occurred_at' => date('Y-m-d H:i:s', strtotime($occurredAt)),
                'fine_amount' => $fineAmount,
                'status' => $status,
                'notes' => $notes,
            ];

            if ($existingId) {
                $stmt = $pdo->prepare(
                    'UPDATE offenses
                     SET citizen_id = :citizen_id, vehicle_id = :vehicle_id, vehicle_plate = :vehicle_plate,
                         driver_name = :driver_name, offense_type_id = :offense_type_id, location = :location,
                         speed_recorded = :speed_recorded, occurred_at = :occurred_at, fine_amount = :fine_amount,
                         status = :status, notes = :notes, updated_at = NOW()
                     WHERE id = :id'
                );
                $params['id'] = $existingId;
                $stmt->execute($params);
                $offenseId = (int) $existingId;
            } else {
                $offenseCode = generate_code('OFF');
                $stmt = $pdo->prepare(
                    'INSERT INTO offenses (
                        offense_code, citizen_id, vehicle_id, vehicle_plate, driver_name, offense_type_id,
                        location, speed_recorded, occurred_at, fine_amount, status, notes, officer_user_id, created_at, updated_at
                     ) VALUES (
                        :offense_code, :citizen_id, :vehicle_id, :vehicle_plate, :driver_name, :offense_type_id,
                        :location, :speed_recorded, :occurred_at, :fine_amount, :status, :notes, :officer_user_id, NOW(), NOW()
                     )'
                );
                $stmt->execute($params + [
                    'offense_code' => $offenseCode,
                    'officer_user_id' => $user['id'],
                ]);
                $offenseId = (int) $pdo->lastInsertId();
            }

            if (!empty($_FILES['evidence']['name'])) {
                $uploadDir = ensure_upload_dir();
                $names = $_FILES['evidence']['name'];
                $tmpNames = $_FILES['evidence']['tmp_name'];
                $types = $_FILES['evidence']['type'];
                $sizes = $_FILES['evidence']['size'];

                foreach ($names as $index => $originalName) {
                    if (!$tmpNames[$index]) {
                        continue;
                    }

                    $extension = pathinfo((string) $originalName, PATHINFO_EXTENSION);
                    $stored = slugify($offenseCode) . '-' . bin2hex(random_bytes(6)) . ($extension ? '.' . $extension : '');
                    $destination = $uploadDir . DIRECTORY_SEPARATOR . $stored;
                    move_uploaded_file($tmpNames[$index], $destination);

                    $insertEvidence = $pdo->prepare(
                        'INSERT INTO evidence_files (
                            offense_id, original_name, stored_name, mime_type, file_size, uploaded_by, uploaded_at
                         ) VALUES (
                            :offense_id, :original_name, :stored_name, :mime_type, :file_size, :uploaded_by, NOW()
                         )'
                    );
                    $insertEvidence->execute([
                        'offense_id' => $offenseId,
                        'original_name' => $originalName,
                        'stored_name' => $stored,
                        'mime_type' => $types[$index] ?: 'application/octet-stream',
                        'file_size' => (int) $sizes[$index],
                        'uploaded_by' => $user['id'],
                    ]);
                }
            }

            log_audit_event($user, 'save_offense', 'offense', $offenseCode, 'Offense record saved or updated.');
            json_response(['ok' => true, 'message' => 'Offense saved successfully.', 'offense_code' => $offenseCode]);

        case 'fine_types':
            require_auth();
            json_response(['ok' => true, 'data' => fetch_fine_types()]);

        case 'save_fine_type':
            require_auth();
            if ($method !== 'POST') {
                json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
            }

            $payload = request_payload();
            $name = trim((string) ($payload['name'] ?? ''));
            if ($name === '') {
                json_response(['ok' => false, 'message' => 'Offense name is required.'], 422);
            }

            $params = [
                'name' => $name,
                'category' => trim((string) ($payload['category'] ?? 'Medium')),
                'amount' => (float) ($payload['amount'] ?? 0),
                'points' => (int) ($payload['demerit_points'] ?? 0),
                'description' => trim((string) ($payload['description'] ?? '')),
            ];

            if (!empty($payload['id'])) {
                $stmt = db()->prepare(
                    'UPDATE offense_types
                     SET name = :name, category = :category, amount = :amount, demerit_points = :points, description = :description, updated_at = NOW()
                     WHERE id = :id'
                );
                $params['id'] = (int) $payload['id'];
                $stmt->execute($params);
            } else {
                $stmt = db()->prepare(
                    'INSERT INTO offense_types (name, category, amount, demerit_points, description, created_at, updated_at)
                     VALUES (:name, :category, :amount, :points, :description, NOW(), NOW())'
                );
                $stmt->execute($params);
            }

            log_audit_event(require_auth(), 'save_fine_type', 'fine_type', $name, 'Fine schedule saved or updated.');
            json_response(['ok' => true, 'message' => 'Fine schedule saved.']);

        case 'transactions':
            require_auth();
            json_response([
                'ok' => true,
                'data' => fetch_transactions(),
                'summary' => payment_summary(),
            ]);

        case 'save_transaction':
            $user = require_auth();
            if ($method !== 'POST') {
                json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
            }

            $payload = request_payload();
            $offenseCode = trim((string) ($payload['offense_code'] ?? ''));
            $methodName = trim((string) ($payload['method'] ?? ''));
            $account = trim((string) ($payload['account_reference'] ?? ''));
            $amount = (float) ($payload['amount'] ?? 0);

            if ($offenseCode === '' || $methodName === '' || $account === '' || $amount <= 0) {
                json_response(['ok' => false, 'message' => 'Please complete the transaction form with valid values.'], 422);
            }

            $pdo = db();
            $offenseStmt = $pdo->prepare('SELECT id, fine_amount FROM offenses WHERE offense_code = :code LIMIT 1');
            $offenseStmt->execute(['code' => $offenseCode]);
            $offense = $offenseStmt->fetch();

            if (!$offense) {
                json_response(['ok' => false, 'message' => 'The selected offense was not found.'], 404);
            }

            $transactionCode = generate_code('TXN');
            $status = $amount >= (float) $offense['fine_amount'] ? 'Success' : 'Pending';
            $insert = $pdo->prepare(
                'INSERT INTO transactions (
                    transaction_code, offense_id, method, account_reference, amount, status, processed_by, processed_at, created_at
                 ) VALUES (
                    :transaction_code, :offense_id, :method, :account_reference, :amount, :status, :processed_by, NOW(), NOW()
                 )'
            );
            $insert->execute([
                'transaction_code' => $transactionCode,
                'offense_id' => $offense['id'],
                'method' => $methodName,
                'account_reference' => $account,
                'amount' => $amount,
                'status' => $status,
                'processed_by' => $user['id'],
            ]);

            $pdo->prepare('UPDATE offenses SET status = :status, updated_at = NOW() WHERE id = :id')
                ->execute([
                    'status' => $status === 'Success' ? 'Paid' : 'Pending',
                    'id' => $offense['id'],
                ]);

            log_audit_event($user, 'save_transaction', 'transaction', $transactionCode, 'Manual/admin transaction stored.');
            json_response(['ok' => true, 'message' => 'Transaction stored successfully.', 'transaction_code' => $transactionCode]);

               case 'evidence':
            require_auth();
            json_response(['ok' => true, 'data' => fetch_evidence()]);

        case 'evidence_file':
            require_auth();

            $stored = trim((string) ($_GET['file'] ?? ''));
            if ($stored === '') {
                json_response(['ok' => false, 'message' => 'Missing file name.'], 422);
            }

            $safeName = basename($stored);
            $fullPath = app_config()['upload_dir'] . DIRECTORY_SEPARATOR . $safeName;

            if (!is_file($fullPath)) {
                http_response_code(404);
                exit('File not found.');
            }

            $mime = mime_content_type($fullPath) ?: 'application/octet-stream';
            header('Content-Type: ' . $mime);
            header('Content-Length: ' . filesize($fullPath));
            header('Content-Disposition: inline; filename="' . $safeName . '"');
            readfile($fullPath);
            exit;

        case 'citizen_evidence_file':
            $stored = trim((string) ($_GET['file'] ?? ''));
            if ($stored === '') {
                json_response(['ok' => false, 'message' => 'Missing file name.'], 422);
            }

            $safeName = basename($stored);
            $fullPath = app_config()['upload_dir'] . DIRECTORY_SEPARATOR . $safeName;
            if (!is_file($fullPath)) {
                http_response_code(404);
                exit('File not found.');
            }

            $mime = mime_content_type($fullPath) ?: 'application/octet-stream';
            header('Content-Type: ' . $mime);
            header('Content-Length: ' . filesize($fullPath));
            header('Content-Disposition: inline; filename="' . $safeName . '"');
            readfile($fullPath);
            exit;


        case 'citizens':
            require_auth();
            json_response(['ok' => true, 'data' => fetch_citizens()]);

        case 'save_citizen':
            require_auth();
            if ($method !== 'POST') {
                json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
            }

            $payload = request_payload();
            $required = ['first_name', 'last_name', 'nrc', 'phone', 'license_number'];
            foreach ($required as $field) {
                if (trim((string) ($payload[$field] ?? '')) === '') {
                    json_response(['ok' => false, 'message' => 'Please complete the citizen form before saving.'], 422);
                }
            }

            $stmt = db()->prepare(
                'INSERT INTO citizens (
                    nrc, first_name, last_name, phone, email, license_number, license_class, province, status, created_at, updated_at
                 ) VALUES (
                    :nrc, :first_name, :last_name, :phone, :email, :license_number, :license_class, :province, :status, NOW(), NOW()
                 )'
            );
            $stmt->execute([
                'nrc' => trim((string) $payload['nrc']),
                'first_name' => trim((string) $payload['first_name']),
                'last_name' => trim((string) $payload['last_name']),
                'phone' => trim((string) $payload['phone']),
                'email' => trim((string) ($payload['email'] ?? '')),
                'license_number' => trim((string) $payload['license_number']),
                'license_class' => trim((string) ($payload['license_class'] ?? '')),
                'province' => trim((string) ($payload['province'] ?? '')),
                'status' => 'Active',
            ]);

            json_response(['ok' => true, 'message' => 'Citizen record saved successfully.']);

                case 'vehicles':
            require_auth();
            json_response(['ok' => true, 'data' => fetch_vehicles()]);

        case 'vehicle_lookup':
            require_auth();

            $plate = strtoupper(trim((string) ($_GET['plate'] ?? '')));
            if ($plate === '') {
                json_response(['ok' => false, 'message' => 'Plate number is required.'], 422);
            }

            $plate = preg_replace('/[^A-Z0-9 ]+/', '', $plate) ?: '';
            $profile = vehicle_profile_by_plate($plate);

            json_response([
                'ok' => true,
                'plate_number' => $plate,
                'data' => $profile,
            ]);

        case 'detect_vehicle_by_plate_image':
            require_auth();

            if ($method !== 'POST') {
                json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
            }

            if (empty($_FILES['plate_image']['tmp_name'])) {
                json_response(['ok' => false, 'message' => 'Plate image is required.'], 422);
            }

            $apiKey = getenv('OPENROUTER_API_KEY') ?: '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';
            $model = getenv('OPENROUTER_MODEL') ?: 'openai/gpt-4.1-mini';

            if ($apiKey === '') {
                json_response(['ok' => false, 'message' => 'OpenRouter API key is missing.'], 500);
            }

            $tmp = $_FILES['plate_image']['tmp_name'];
            $mime = mime_content_type($tmp) ?: 'image/jpeg';
            $base64 = base64_encode((string) file_get_contents($tmp));

            $payload = [
                'model' => $model,
                'messages' => [[
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => 'text',
                            'text' => 'Extract the vehicle registration plate from this image. Return only the final plate number in uppercase. Preserve letters and digits. If spacing is unclear, still return the most likely full plate.',
                        ],
                        [
                            'type' => 'image_url',
                            'image_url' => [
                                'url' => 'data:' . $mime . ';base64,' . $base64,
                            ],
                        ],
                    ],
                ]],
            ];

            $ch = curl_init('https://openrouter.ai/api/v1/chat/completions');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => [
                    'Authorization: Bearer ' . $apiKey,
                    'Content-Type: application/json',
                    'HTTP-Referer: http://localhost',
                    'X-Title: RTSA TOMS',
                ],
                CURLOPT_POSTFIELDS => json_encode($payload),
            ]);

            $raw = curl_exec($ch);
            $httpCode = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($raw === false || $curlError) {
                json_response(['ok' => false, 'message' => 'OpenRouter request failed: ' . $curlError], 500);
            }

            $result = json_decode($raw, true);
            $plate = trim((string) ($result['choices'][0]['message']['content'] ?? ''));

            if ($httpCode >= 400 || $plate === '') {
                json_response(['ok' => false, 'message' => 'Unable to detect number plate from image.'], 422);
            }

            $plate = strtoupper(preg_replace('/[^A-Z0-9 ]+/', '', $plate) ?: '');
            $profile = vehicle_profile_by_plate($plate);

            if (!$profile && $plate !== '') {
                $retryPayload = [
                    'model' => $model,
                    'messages' => [[
                        'role' => 'user',
                        'content' => [
                            [
                                'type' => 'text',
                                'text' => 'Look carefully at this image and extract only the registration plate. Return uppercase letters and digits only, with no explanation and no punctuation.',
                            ],
                            [
                                'type' => 'image_url',
                                'image_url' => [
                                    'url' => 'data:' . $mime . ';base64,' . $base64,
                                ],
                            ],
                        ],
                    ]],
                ];

                $retry = curl_init('https://openrouter.ai/api/v1/chat/completions');
                curl_setopt_array($retry, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_POST => true,
                    CURLOPT_HTTPHEADER => [
                        'Authorization: Bearer ' . $apiKey,
                        'Content-Type: application/json',
                        'HTTP-Referer: http://localhost',
                        'X-Title: RTSA TOMS',
                    ],
                    CURLOPT_POSTFIELDS => json_encode($retryPayload),
                ]);

                $retryRaw = curl_exec($retry);
                $retryHttpCode = (int) curl_getinfo($retry, CURLINFO_RESPONSE_CODE);
                curl_close($retry);

                if ($retryRaw !== false && $retryHttpCode < 400) {
                    $retryResult = json_decode($retryRaw, true);
                    $retryPlate = trim((string) ($retryResult['choices'][0]['message']['content'] ?? ''));
                    $retryPlate = strtoupper(preg_replace('/[^A-Z0-9 ]+/', '', $retryPlate) ?: '');

                    if ($retryPlate !== '') {
                        $plate = $retryPlate;
                        $profile = vehicle_profile_by_plate($plate);
                    }
                }
            }

            json_response([
                'ok' => true,
                'plate_number' => $plate,
                'data' => $profile,
            ]);

        case 'save_vehicle':
            require_auth();
            if ($method !== 'POST') {
                json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
            }


            $payload = request_payload();
            $required = ['plate_number', 'make', 'model'];
            foreach ($required as $field) {
                if (trim((string) ($payload[$field] ?? '')) === '') {
                    json_response(['ok' => false, 'message' => 'Please complete the vehicle form before saving.'], 422);
                }
            }

            $owner = find_citizen_by_identifier((string) ($payload['owner_identifier'] ?? ''));
            $stmt = db()->prepare(
                'INSERT INTO vehicles (
                    owner_citizen_id, plate_number, make, model, vehicle_year, colour, chassis_number,
                    roadworthy_expiry, insurance_status, status, created_at, updated_at
                 ) VALUES (
                    :owner_citizen_id, :plate_number, :make, :model, :vehicle_year, :colour, :chassis_number,
                    :roadworthy_expiry, :insurance_status, :status, NOW(), NOW()
                 )'
            );
            $stmt->execute([
                'owner_citizen_id' => $owner['id'] ?? null,
                'plate_number' => trim((string) $payload['plate_number']),
                'make' => trim((string) $payload['make']),
                'model' => trim((string) $payload['model']),
                'vehicle_year' => ($payload['vehicle_year'] ?? '') !== '' ? (int) $payload['vehicle_year'] : null,
                'colour' => trim((string) ($payload['colour'] ?? '')),
                'chassis_number' => trim((string) ($payload['chassis_number'] ?? '')),
                'roadworthy_expiry' => !empty($payload['roadworthy_expiry']) ? $payload['roadworthy_expiry'] : null,
                'insurance_status' => trim((string) ($payload['insurance_status'] ?? 'Valid')),
                'status' => trim((string) ($payload['status'] ?? 'Active')),
            ]);

            json_response(['ok' => true, 'message' => 'Vehicle saved successfully.']);

        case 'officers':
            require_auth();
            json_response(['ok' => true, 'data' => fetch_officers()]);

        case 'notifications':
            require_auth();
            json_response(['ok' => true, 'data' => fetch_notifications()]);

        case 'save_notification':
            $user = require_auth();
            if ($method !== 'POST') {
                json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
            }

            $payload = request_payload();
            $recipientType = trim((string) ($payload['recipient_type'] ?? ''));
            $channel = trim((string) ($payload['channel'] ?? 'SMS'));
            $message = trim((string) ($payload['message'] ?? ''));

            if ($recipientType === '' || $message === '') {
                json_response(['ok' => false, 'message' => 'Recipient type and message are required.'], 422);
            }

            $stmt = db()->prepare(
                'INSERT INTO notifications (
                    recipient_type, recipient_reference, channel, message, delivery_status, sent_by, sent_at, created_at
                 ) VALUES (
                    :recipient_type, :recipient_reference, :channel, :message, :delivery_status, :sent_by, NOW(), NOW()
                 )'
            );
            $stmt->execute([
                'recipient_type' => $recipientType,
                'recipient_reference' => trim((string) ($payload['recipient_reference'] ?? '')),
                'channel' => $channel,
                'message' => $message,
                'delivery_status' => 'Sent',
                'sent_by' => $user['id'],
            ]);

            json_response(['ok' => true, 'message' => 'Notification saved successfully.']);

        case 'settings':
            require_auth();
            json_response(['ok' => true, 'data' => fetch_system_settings()]);

        case 'save_settings':
            $user = require_auth();
            if ($method !== 'POST') {
                json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
            }

            $payload = request_payload();
            $allowed = ['organization_name', 'default_province', 'currency', 'date_format'];
            $stmt = db()->prepare(
                'INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at)
                 VALUES (:setting_key, :setting_value, :updated_by, NOW())
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = NOW()'
            );

            foreach ($allowed as $key) {
                $stmt->execute([
                    'setting_key' => $key,
                    'setting_value' => trim((string) ($payload[$key] ?? '')),
                    'updated_by' => $user['id'],
                ]);
            }

            json_response(['ok' => true, 'message' => 'Settings saved successfully.']);

        default:
            json_response(['ok' => false, 'message' => 'Unknown API action.'], 404);
    }
} catch (Throwable $exception) {
    json_response([
        'ok' => false,
        'message' => $exception->getMessage(),
    ], 500);
}
