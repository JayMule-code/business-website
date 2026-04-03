<?php

declare(strict_types=1);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

function app_config(): array
{
    static $config;

    if ($config !== null) {
        return $config;
    }

    $config = [
        'db_host' => getenv('RTSA_DB_HOST') ?: '127.0.0.1',
        'db_name' => getenv('RTSA_DB_NAME') ?: 'rtsa_toms',
        'db_port' => getenv('RTSA_DB_PORT') ?: '3306',
        'db_user' => getenv('RTSA_DB_USER') ?: 'root',
        'db_pass' => getenv('RTSA_DB_PASS') ?: '',
        'upload_dir' => dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'uploads',
    ];

    return $config;
}

function db(): PDO
{
    static $pdo;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = app_config();
    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        $config['db_host'],
        $config['db_port'],
        $config['db_name']
    );

    try {
        $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (PDOException $exception) {
        if (stripos($exception->getMessage(), 'could not find driver') !== false) {
            throw new RuntimeException(
                'PHP MySQL driver missing. Enable the pdo_mysql extension in php.ini, then restart Apache/XAMPP/WAMP and try again.'
            );
        }

        throw $exception;
    }

    return $pdo;
}

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function request_payload(): array
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    if (stripos($contentType, 'application/json') !== false) {
        $raw = file_get_contents('php://input') ?: '';
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    return $_POST;
}

function current_user(): ?array
{
    if (empty($_SESSION['user_id'])) {
        return null;
    }

    $stmt = db()->prepare(
        'SELECT id, service_number, email, phone, first_name, last_name, role, rank_title, province, station, nrc, account_status
         FROM users
         WHERE id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => (int) $_SESSION['user_id']]);
    $user = $stmt->fetch();

    return $user ?: null;
}

function require_auth(): array
{
    $user = current_user();

    if (!$user) {
        json_response([
            'ok' => false,
            'message' => 'Your session has expired. Please sign in again.',
        ], 401);
    }

    return $user;
}

function ensure_audit_trail_table(): void
{
    db()->exec(
        "CREATE TABLE IF NOT EXISTS audit_trails (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            actor_user_id INT NULL,
            actor_name VARCHAR(180) NOT NULL,
            actor_role VARCHAR(40) NOT NULL,
            action_key VARCHAR(120) NOT NULL,
            entity_type VARCHAR(80) NOT NULL,
            entity_reference VARCHAR(160) NOT NULL,
            details TEXT NULL,
            ip_address VARCHAR(64) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_actor_user_id (actor_user_id),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

function log_audit_event(?array $actor, string $actionKey, string $entityType, string $entityReference, ?string $details = null): void
{
    ensure_audit_trail_table();

    $name = $actor
        ? trim(($actor['first_name'] ?? '') . ' ' . ($actor['last_name'] ?? ''))
        : 'System';
    $role = (string) ($actor['role'] ?? 'system');

    $stmt = db()->prepare(
        'INSERT INTO audit_trails (
            actor_user_id, actor_name, actor_role, action_key, entity_type, entity_reference, details, ip_address, created_at
         ) VALUES (
            :actor_user_id, :actor_name, :actor_role, :action_key, :entity_type, :entity_reference, :details, :ip_address, NOW()
         )'
    );
    $stmt->execute([
        'actor_user_id' => $actor['id'] ?? null,
        'actor_name' => $name !== '' ? $name : 'Unknown User',
        'actor_role' => $role,
        'action_key' => $actionKey,
        'entity_type' => $entityType,
        'entity_reference' => $entityReference,
        'details' => $details,
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
    ]);
}

function ensure_upload_dir(): string
{
    $dir = app_config()['upload_dir'];
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }

    return $dir;
}

function slugify(string $value): string
{
    $value = strtolower(trim($value));
    $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?: 'item';

    return trim($value, '-') ?: 'item';
}

function generate_code(string $prefix): string
{
    return sprintf('%s-%s-%04d', strtoupper($prefix), date('Y'), random_int(1000, 9999));
}

function normalize_role(string $label): string
{
    $value = strtolower(trim($label));

    if (str_contains($value, 'admin')) {
        return 'admin';
    }

    if (str_contains($value, 'citizen') || str_contains($value, 'driver')) {
        return 'citizen';
    }

    return 'officer';
}

function find_citizen_by_identifier(string $identifier): ?array
{
    $value = trim($identifier);
    if ($value === '') {
        return null;
    }

    $stmt = db()->prepare(
        'SELECT id, first_name, last_name, nrc, license_number
         FROM citizens
         WHERE nrc = :value OR license_number = :value OR CONCAT(first_name, " ", last_name) = :value
         LIMIT 1'
    );
    $stmt->execute(['value' => $value]);
    $citizen = $stmt->fetch();

    return $citizen ?: null;
}

function find_vehicle_by_plate(string $plate): ?array
{
    $plate = trim($plate);
    if ($plate === '') {
        return null;
    }

    $stmt = db()->prepare('SELECT id, plate_number FROM vehicles WHERE plate_number = :plate LIMIT 1');
    $stmt->execute(['plate' => $plate]);
    $vehicle = $stmt->fetch();

    return $vehicle ?: null;
}

function find_or_create_offense_type(string $name, ?string $category = null, ?float $amount = null, ?int $points = null): int
{
    $pdo = db();
    $stmt = $pdo->prepare('SELECT id FROM offense_types WHERE name = :name LIMIT 1');
    $stmt->execute(['name' => $name]);
    $existing = $stmt->fetchColumn();

    if ($existing) {
        return (int) $existing;
    }

    $insert = $pdo->prepare(
        'INSERT INTO offense_types (name, category, amount, demerit_points, description, created_at, updated_at)
         VALUES (:name, :category, :amount, :points, :description, NOW(), NOW())'
    );
    $insert->execute([
        'name' => $name,
        'category' => $category ?: 'Medium',
        'amount' => $amount ?? 0,
        'points' => $points ?? 0,
        'description' => $name . ' offense',
    ]);

    return (int) $pdo->lastInsertId();
}

function offense_filters(array $query): array
{
    $conditions = [];
    $params = [];

    if (!empty($query['search'])) {
        $conditions[] = '(o.offense_code LIKE :search OR o.vehicle_plate LIKE :search OR o.driver_name LIKE :search OR ot.name LIKE :search)';
        $params['search'] = '%' . trim((string) $query['search']) . '%';
    }

    if (!empty($query['offense']) && $query['offense'] !== 'All Types') {
        $conditions[] = 'ot.name = :offense_name';
        $params['offense_name'] = trim((string) $query['offense']);
    }

    if (!empty($query['status']) && $query['status'] !== 'All Status') {
        $conditions[] = 'o.status = :status';
        $params['status'] = trim((string) $query['status']);
    }

    $where = $conditions ? ' WHERE ' . implode(' AND ', $conditions) : '';

    return [$where, $params];
}

function fetch_offenses(array $query = []): array
{
    [$where, $params] = offense_filters($query);
    $sql = "
        SELECT
            o.id,
            o.offense_code,
            o.vehicle_plate,
            o.driver_name,
            ot.name AS offense_type,
            o.location,
            o.speed_recorded,
            o.occurred_at,
            o.fine_amount,
            o.status,
            o.notes,
            CONCAT(u.first_name, ' ', u.last_name) AS officer_name,
            COALESCE(COUNT(ef.id), 0) AS evidence_count
        FROM offenses o
        INNER JOIN offense_types ot ON ot.id = o.offense_type_id
        LEFT JOIN users u ON u.id = o.officer_user_id
        LEFT JOIN evidence_files ef ON ef.offense_id = o.id
        {$where}
        GROUP BY
            o.id, o.offense_code, o.vehicle_plate, o.driver_name, ot.name, o.location,
            o.speed_recorded, o.occurred_at, o.fine_amount, o.status, o.notes,
            u.first_name, u.last_name
        ORDER BY o.occurred_at DESC, o.id DESC
    ";

    $stmt = db()->prepare($sql);
    $stmt->execute($params);

    return $stmt->fetchAll();
}

function fetch_offense_detail(string $offenseCode): ?array
{
    $pdo = db();
    $stmt = $pdo->prepare(
        "SELECT
            o.id,
            o.offense_code,
            o.vehicle_plate,
            o.driver_name,
            ot.id AS offense_type_id,
            ot.name AS offense_type,
            ot.category,
            ot.demerit_points,
            o.location,
            o.speed_recorded,
            o.occurred_at,
            o.fine_amount,
            o.status,
            o.notes,
            CONCAT(u.first_name, ' ', u.last_name) AS officer_name,
            u.service_number
        FROM offenses o
        INNER JOIN offense_types ot ON ot.id = o.offense_type_id
        LEFT JOIN users u ON u.id = o.officer_user_id
        WHERE o.offense_code = :code
        LIMIT 1"
    );
    $stmt->execute(['code' => $offenseCode]);
    $offense = $stmt->fetch();

    if (!$offense) {
        return null;
    }

    $evidence = $pdo->prepare(
        'SELECT original_name, stored_name, mime_type, file_size, uploaded_at
         FROM evidence_files
         WHERE offense_id = :id
         ORDER BY uploaded_at DESC'
    );
    $evidence->execute(['id' => $offense['id']]);

    $transactions = $pdo->prepare(
        'SELECT transaction_code, method, account_reference, amount, status, processed_at
         FROM transactions
         WHERE offense_id = :id
         ORDER BY id DESC'
    );
    $transactions->execute(['id' => $offense['id']]);

    $offense['evidence'] = $evidence->fetchAll();
    $offense['transactions'] = $transactions->fetchAll();

    return $offense;
}

function normalize_plate_value(string $plate): string
{
    return strtoupper(str_replace([' ', '-'], '', trim($plate)));
}

function citizen_portal_lookup(string $nrc, string $plate): ?array
{
    $nrc = trim($nrc);
    $plate = trim($plate);
    $normalizedPlate = normalize_plate_value($plate);

    if ($nrc === '' || $normalizedPlate === '') {
        return null;
    }

    $pdo = db();
    $citizenStmt = $pdo->prepare(
        "SELECT
            id,
            nrc,
            CONCAT(first_name, ' ', last_name) AS full_name,
            phone,
            email,
            license_number,
            license_class,
            province,
            status
         FROM citizens
         WHERE nrc = :nrc
         LIMIT 1"
    );
    $citizenStmt->execute(['nrc' => $nrc]);
    $citizen = $citizenStmt->fetch();

    if (!$citizen) {
        return null;
    }

    $vehicleStmt = $pdo->prepare(
        "SELECT
            v.id AS vehicle_id,
            v.plate_number,
            v.make,
            v.model,
            v.vehicle_year,
            v.colour,
            v.chassis_number,
            v.roadworthy_expiry,
            v.insurance_status,
            v.status AS vehicle_status,
            CASE WHEN v.owner_citizen_id = :citizen_id THEN 0 ELSE 1 END AS sort_priority
         FROM vehicles v
         WHERE REPLACE(REPLACE(UPPER(v.plate_number), ' ', ''), '-', '') = :plate
         ORDER BY sort_priority ASC, v.id DESC
         LIMIT 1"
    );
    $vehicleStmt->execute([
        'citizen_id' => $citizen['id'],
        'plate' => $normalizedPlate,
    ]);
    $vehicle = $vehicleStmt->fetch() ?: null;

    $offenses = $pdo->prepare(
        "SELECT
            o.id,
            o.offense_code,
            o.vehicle_plate,
            o.driver_name,
            ot.name AS offense_type,
            o.location,
            o.occurred_at,
            o.fine_amount,
            o.status,
            o.notes,
            CONCAT(u.first_name, ' ', u.last_name) AS officer_name,
            u.service_number,
            COALESCE(SUM(CASE WHEN t.status = 'Success' THEN t.amount ELSE 0 END), 0) AS paid_amount
         FROM offenses o
         INNER JOIN offense_types ot ON ot.id = o.offense_type_id
         LEFT JOIN users u ON u.id = o.officer_user_id
         LEFT JOIN transactions t ON t.offense_id = o.id
         WHERE REPLACE(REPLACE(UPPER(o.vehicle_plate), ' ', ''), '-', '') = :plate
           AND (
                o.citizen_id = :citizen_id
                OR REPLACE(REPLACE(UPPER(o.driver_name), ' ', ''), '-', '') = :driver_name
           )
         GROUP BY
            o.id, o.offense_code, o.vehicle_plate, o.driver_name, ot.name, o.location,
            o.occurred_at, o.fine_amount, o.status, o.notes, u.first_name, u.last_name, u.service_number
         ORDER BY o.occurred_at DESC, o.id DESC"
    );
    $offenses->execute([
        'plate' => $normalizedPlate,
        'citizen_id' => $citizen['id'],
        'driver_name' => normalize_plate_value((string) $citizen['full_name']),
    ]);
    $records = $offenses->fetchAll();

    if (!$vehicle && !$records) {
        return null;
    }

    $evidenceStmt = $pdo->prepare(
        'SELECT original_name, stored_name, mime_type, file_size, uploaded_at
         FROM evidence_files
         WHERE offense_id = :id
         ORDER BY uploaded_at DESC'
    );
    $transactionsStmt = $pdo->prepare(
        'SELECT transaction_code, method, account_reference, amount, status, processed_at
         FROM transactions
         WHERE offense_id = :id
         ORDER BY id DESC'
    );

    $totalDue = 0.0;
    foreach ($records as &$record) {
        $evidenceStmt->execute(['id' => $record['id']]);
        $transactionsStmt->execute(['id' => $record['id']]);
        $record['evidence'] = $evidenceStmt->fetchAll();
        $record['transactions'] = $transactionsStmt->fetchAll();
        $record['balance_due'] = max(0, (float) $record['fine_amount'] - (float) $record['paid_amount']);
        if ($record['status'] !== 'Paid') {
            $totalDue += (float) $record['balance_due'];
        }
    }
    unset($record);

    return [
        'citizen' => [
            'id' => $citizen['id'],
            'full_name' => $citizen['full_name'],
            'nrc' => $citizen['nrc'],
            'phone' => $citizen['phone'],
            'email' => $citizen['email'],
            'license_number' => $citizen['license_number'],
            'license_class' => $citizen['license_class'],
            'province' => $citizen['province'],
            'status' => $citizen['status'],
        ],
        'vehicle' => [
            'id' => $vehicle['vehicle_id'] ?? null,
            'plate_number' => $vehicle['plate_number'] ?? $plate,
            'make' => $vehicle['make'] ?? '-',
            'model' => $vehicle['model'] ?? '-',
            'vehicle_year' => $vehicle['vehicle_year'] ?? '-',
            'colour' => $vehicle['colour'] ?? '-',
            'chassis_number' => $vehicle['chassis_number'] ?? '-',
            'roadworthy_expiry' => $vehicle['roadworthy_expiry'] ?? '-',
            'insurance_status' => $vehicle['insurance_status'] ?? '-',
            'status' => $vehicle['vehicle_status'] ?? 'Linked via offense history',
        ],
        'offenses' => $records,
        'total_due' => $totalDue,
    ];
}

function fetch_fine_types(): array
{
    $stmt = db()->query(
        'SELECT id, name, category, amount, demerit_points, description
         FROM offense_types
         ORDER BY name ASC'
    );

    return $stmt->fetchAll();
}

function fetch_transactions(): array
{
    $stmt = db()->query(
        "SELECT
            t.transaction_code,
            t.method,
            t.account_reference,
            t.amount,
            t.status,
            t.processed_at,
            o.offense_code
         FROM transactions t
         INNER JOIN offenses o ON o.id = t.offense_id
         ORDER BY t.id DESC
         LIMIT 30"
    );

    return $stmt->fetchAll();
}

function payment_summary(): array
{
    $pdo = db();

    $todayCollected = (float) $pdo->query(
        "SELECT COALESCE(SUM(amount), 0)
         FROM transactions
         WHERE status = 'Success'
           AND DATE(processed_at) = CURDATE()"
    )->fetchColumn();

    $monthlyTotal = (float) $pdo->query(
        "SELECT COALESCE(SUM(amount), 0)
         FROM transactions
         WHERE status = 'Success'
           AND YEAR(processed_at) = YEAR(CURDATE())
           AND MONTH(processed_at) = MONTH(CURDATE())"
    )->fetchColumn();

    $pendingAmount = (float) $pdo->query(
        "SELECT COALESCE(SUM(GREATEST(o.fine_amount - COALESCE(tp.paid_total, 0), 0)), 0)
         FROM offenses o
         LEFT JOIN (
             SELECT offense_id, SUM(amount) AS paid_total
             FROM transactions
             WHERE status = 'Success'
             GROUP BY offense_id
         ) tp ON tp.offense_id = o.id
         WHERE o.status <> 'Paid'"
    )->fetchColumn();

    $counts = $pdo->query(
        "SELECT
            COUNT(*) AS total_count,
            SUM(CASE WHEN status = 'Success' THEN 1 ELSE 0 END) AS success_count
         FROM transactions"
    )->fetch();

    $totalCount = (int) ($counts['total_count'] ?? 0);
    $successCount = (int) ($counts['success_count'] ?? 0);
    $successRate = $totalCount > 0 ? ($successCount / $totalCount) * 100 : 0.0;

    return [
        'today_collected' => $todayCollected,
        'pending_amount' => $pendingAmount,
        'monthly_total' => $monthlyTotal,
        'success_rate' => $successRate,
        'transaction_count' => $totalCount,
    ];
}

function fetch_evidence(): array
{
    $stmt = db()->query(
        "SELECT
            o.offense_code,
            ot.name AS offense_type,
            ef.original_name,
            ef.mime_type,
            ef.file_size,
            ef.uploaded_at,
            CONCAT(u.first_name, ' ', u.last_name) AS uploaded_by
         FROM evidence_files ef
         INNER JOIN offenses o ON o.id = ef.offense_id
         INNER JOIN offense_types ot ON ot.id = o.offense_type_id
         LEFT JOIN users u ON u.id = ef.uploaded_by
         ORDER BY ef.id DESC
         LIMIT 30"
    );

    return $stmt->fetchAll();
}

function fetch_citizens(): array
{
    $stmt = db()->query(
        "SELECT
            c.id,
            c.nrc,
            CONCAT(c.first_name, ' ', c.last_name) AS full_name,
            c.phone,
            c.email,
            c.license_number,
            c.license_class,
            c.status,
            COALESCE(GROUP_CONCAT(DISTINCT v.plate_number ORDER BY v.plate_number SEPARATOR ', '), 'None') AS plates,
            COALESCE(SUM(CASE WHEN o.status <> 'Paid' THEN o.fine_amount ELSE 0 END), 0) AS total_fines
         FROM citizens c
         LEFT JOIN vehicles v ON v.owner_citizen_id = c.id
         LEFT JOIN offenses o ON o.citizen_id = c.id
         GROUP BY
            c.id, c.nrc, c.first_name, c.last_name, c.phone, c.email,
            c.license_number, c.license_class, c.status
         ORDER BY c.created_at DESC, c.id DESC"
    );

    return $stmt->fetchAll();
}

function fetch_vehicles(): array
{
    $stmt = db()->query(
        "SELECT
            v.id,
            v.plate_number,
            v.make,
            v.model,
            v.vehicle_year,
            v.colour,
            COALESCE(CONCAT(c.first_name, ' ', c.last_name), 'Unassigned') AS owner_name,
            v.roadworthy_expiry,
            v.insurance_status,
            v.status,
            COUNT(o.id) AS offense_count
         FROM vehicles v
         LEFT JOIN citizens c ON c.id = v.owner_citizen_id
         LEFT JOIN offenses o ON o.vehicle_id = v.id
         GROUP BY
            v.id, v.plate_number, v.make, v.model, v.vehicle_year, v.colour,
            c.first_name, c.last_name, v.roadworthy_expiry, v.insurance_status, v.status
         ORDER BY v.created_at DESC, v.id DESC"
    );

    return $stmt->fetchAll();
}

function vehicle_profile_by_plate(string $plate): ?array
{
    $stmt = db()->prepare("
        SELECT
            v.id,
            v.plate_number,
            v.make,
            v.model,
            v.vehicle_year,
            v.colour,
            v.chassis_number,
            v.roadworthy_expiry,
            v.insurance_status,
            v.status,
            c.id AS citizen_id,
            c.nrc,
            CONCAT(c.first_name, ' ', c.last_name) AS owner_name,
            c.phone AS owner_phone,
            c.email AS owner_email,
            c.license_number,
            c.license_class,
            c.province
        FROM vehicles v
        LEFT JOIN citizens c ON c.id = v.owner_citizen_id
        WHERE REPLACE(REPLACE(UPPER(v.plate_number), ' ', ''), '-', '') = REPLACE(REPLACE(UPPER(:plate), ' ', ''), '-', '')
        LIMIT 1
    ");
    $stmt->execute(['plate' => $plate]);
    $vehicle = $stmt->fetch();

    if (!$vehicle) {
        return null;
    }

    $history = db()->prepare("
        SELECT
            o.offense_code,
            o.driver_name,
            ot.name AS offense_type,
            o.location,
            o.occurred_at,
            o.fine_amount,
            o.status
        FROM offenses o
        INNER JOIN offense_types ot ON ot.id = o.offense_type_id
        WHERE REPLACE(REPLACE(UPPER(o.vehicle_plate), ' ', ''), '-', '') = REPLACE(REPLACE(UPPER(:plate), ' ', ''), '-', '')
        ORDER BY o.occurred_at DESC, o.id DESC
    ");
    $history->execute(['plate' => $plate]);
    $vehicle['offense_history'] = $history->fetchAll();

    return $vehicle;
}


function fetch_officers(): array
{
    $stmt = db()->query(
        "SELECT
            u.id,
            u.service_number,
            CONCAT(u.first_name, ' ', u.last_name) AS full_name,
            COALESCE(u.rank_title, 'Officer') AS rank_title,
            COALESCE(u.province, 'Unassigned') AS province,
            COALESCE(ol.checkpoint, u.station, 'HQ') AS checkpoint,
            COALESCE(ol.duty_status, 'Off Duty') AS duty_status,
            COUNT(CASE WHEN DATE(o.occurred_at) = CURDATE() THEN o.id END) AS offenses_today
         FROM users u
         LEFT JOIN officer_locations ol ON ol.officer_user_id = u.id
         LEFT JOIN offenses o ON o.officer_user_id = u.id
         WHERE u.role IN ('officer', 'admin')
         GROUP BY
            u.id, u.service_number, u.first_name, u.last_name, u.rank_title,
            u.province, ol.checkpoint, u.station, ol.duty_status
         ORDER BY u.role DESC, u.first_name ASC, u.last_name ASC"
    );

    return $stmt->fetchAll();
}

function fetch_user_profile(int $userId): ?array
{
    $pdo = db();
    $stmt = $pdo->prepare(
        "SELECT
            u.id,
            u.service_number,
            u.email,
            u.phone,
            u.first_name,
            u.last_name,
            u.role,
            COALESCE(u.rank_title, 'Officer') AS rank_title,
            COALESCE(u.province, 'Unassigned') AS province,
            COALESCE(u.station, 'HQ') AS station,
            u.nrc,
            u.account_status,
            u.last_login_at,
            COALESCE(ol.checkpoint, u.station, 'HQ') AS checkpoint,
            COALESCE(ol.duty_status, 'Off Duty') AS duty_status,
            COALESCE(COUNT(o.id), 0) AS total_offenses,
            COALESCE(SUM(CASE WHEN DATE(o.occurred_at) = CURDATE() THEN 1 ELSE 0 END), 0) AS offenses_today,
            COALESCE(SUM(CASE WHEN YEAR(o.occurred_at) = YEAR(CURDATE()) AND MONTH(o.occurred_at) = MONTH(CURDATE()) THEN 1 ELSE 0 END), 0) AS offenses_this_month,
            COALESCE(SUM(CASE WHEN o.status = 'Paid' THEN o.fine_amount ELSE 0 END), 0) AS collected_amount
         FROM users u
         LEFT JOIN officer_locations ol ON ol.officer_user_id = u.id
         LEFT JOIN offenses o ON o.officer_user_id = u.id
         WHERE u.id = :id
         GROUP BY
            u.id, u.service_number, u.email, u.phone, u.first_name, u.last_name,
            u.role, u.rank_title, u.province, u.station, u.nrc, u.account_status,
            u.last_login_at, ol.checkpoint, ol.duty_status
         LIMIT 1"
    );
    $stmt->execute(['id' => $userId]);
    $profile = $stmt->fetch();

    if (!$profile) {
        return null;
    }

    $profile['full_name'] = trim($profile['first_name'] . ' ' . $profile['last_name']);
    $offenseTotal = (int) ($profile['total_offenses'] ?? 0);
    $profile['performance_rating'] = $offenseTotal >= 20
        ? 'Excellent'
        : ($offenseTotal >= 10
            ? 'Good'
            : ($offenseTotal >= 1 ? 'Average' : 'Starter'));

    return $profile;
}

function fetch_admin_overview(): array
{
    $pdo = db();

    $totals = [
        'total_officers' => (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'officer'")->fetchColumn(),
        'active_officers' => (int) $pdo->query("SELECT COUNT(*) FROM officer_locations WHERE duty_status = 'On Duty'")->fetchColumn(),
        'citizens' => (int) $pdo->query("SELECT COUNT(*) FROM citizens")->fetchColumn(),
        'vehicles' => (int) $pdo->query("SELECT COUNT(*) FROM vehicles")->fetchColumn(),
        'offenses' => (int) $pdo->query("SELECT COUNT(*) FROM offenses")->fetchColumn(),
        'unpaid_fines' => (float) $pdo->query("SELECT COALESCE(SUM(fine_amount), 0) FROM offenses WHERE status <> 'Paid'")->fetchColumn(),
        'revenue' => (float) $pdo->query("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'Success'")->fetchColumn(),
        'pending_accounts' => (int) $pdo->query("SELECT COUNT(*) FROM users WHERE account_status <> 'ACTIVE'")->fetchColumn(),
    ];

    $officerActivity = $pdo->query(
        "SELECT
            u.id,
            u.service_number,
            CONCAT(u.first_name, ' ', u.last_name) AS full_name,
            COALESCE(u.rank_title, 'Officer') AS rank_title,
            COALESCE(u.province, 'Unassigned') AS province,
            COALESCE(ol.checkpoint, u.station, 'HQ') AS checkpoint,
            COALESCE(ol.duty_status, 'Off Duty') AS duty_status,
            u.last_login_at,
            COUNT(CASE WHEN DATE(o.occurred_at) = CURDATE() THEN o.id END) AS offenses_today
         FROM users u
         LEFT JOIN officer_locations ol ON ol.officer_user_id = u.id
         LEFT JOIN offenses o ON o.officer_user_id = u.id
         WHERE u.role = 'officer'
         GROUP BY
            u.id, u.service_number, u.first_name, u.last_name, u.rank_title,
            u.province, ol.checkpoint, u.station, ol.duty_status, u.last_login_at
         ORDER BY COALESCE(ol.duty_status, 'Off Duty') DESC, offenses_today DESC, full_name ASC
         LIMIT 12"
    )->fetchAll();

    $citizenSummary = $pdo->query(
        "SELECT
            COUNT(*) AS total_citizens,
            COALESCE(SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END), 0) AS active_citizens,
            COALESCE(SUM(CASE WHEN status <> 'Active' THEN 1 ELSE 0 END), 0) AS flagged_citizens
         FROM citizens"
    )->fetch() ?: [];

    return [
        'totals' => $totals,
        'officer_activity' => $officerActivity,
        'citizen_summary' => $citizenSummary,
    ];
}

function fetch_admin_accounts(): array
{
    $stmt = db()->query(
        "SELECT
            u.id,
            u.service_number,
            CONCAT(u.first_name, ' ', u.last_name) AS full_name,
            u.email,
            u.phone,
            u.role,
            COALESCE(u.rank_title, '-') AS rank_title,
            COALESCE(u.province, 'Unassigned') AS province,
            u.account_status,
            u.last_login_at
         FROM users u
         ORDER BY
            CASE WHEN u.role = 'admin' THEN 0 WHEN u.role = 'officer' THEN 1 ELSE 2 END,
            u.first_name ASC, u.last_name ASC"
    );

    return $stmt->fetchAll();
}

function fetch_audit_trails(): array
{
    ensure_audit_trail_table();

    $stmt = db()->query(
        "SELECT
            actor_name,
            actor_role,
            action_key,
            entity_type,
            entity_reference,
            details,
            ip_address,
            created_at
         FROM audit_trails
         ORDER BY id DESC
         LIMIT 40"
    );

    return $stmt->fetchAll();
}

function fetch_notifications(): array
{
    $stmt = db()->query(
        "SELECT
            n.id,
            n.recipient_type,
            n.recipient_reference,
            n.channel,
            n.message,
            n.delivery_status,
            n.sent_at,
            CONCAT(u.first_name, ' ', u.last_name) AS sent_by_name
         FROM notifications n
         LEFT JOIN users u ON u.id = n.sent_by
         ORDER BY n.id DESC
         LIMIT 20"
    );

    return $stmt->fetchAll();
}

function fetch_system_settings(): array
{
    $defaults = [
        'organization_name' => 'Road Transport & Safety Agency (RTSA)',
        'default_province' => 'Lusaka Province',
        'currency' => 'ZMW - Zambian Kwacha',
        'date_format' => 'DD/MM/YYYY',
    ];

    $stmt = db()->query('SELECT setting_key, setting_value FROM system_settings');
    foreach ($stmt->fetchAll() as $row) {
        $defaults[$row['setting_key']] = $row['setting_value'];
    }

    return $defaults;
}

function analytics_snapshot(): array
{
    $pdo = db();

    $ytdOffenses = (int) $pdo->query(
        "SELECT COUNT(*)
         FROM offenses
         WHERE YEAR(occurred_at) = YEAR(CURDATE())"
    )->fetchColumn();

    $ytdRevenue = (float) $pdo->query(
        "SELECT COALESCE(SUM(amount), 0)
         FROM transactions
         WHERE status = 'Success'
           AND YEAR(processed_at) = YEAR(CURDATE())"
    )->fetchColumn();

    $avgResolutionHours = (float) $pdo->query(
        "SELECT COALESCE(AVG(TIMESTAMPDIFF(HOUR, o.occurred_at, paid.first_paid_at)), 0)
         FROM offenses o
         INNER JOIN (
             SELECT offense_id, MIN(processed_at) AS first_paid_at
             FROM transactions
             WHERE status = 'Success'
             GROUP BY offense_id
         ) paid ON paid.offense_id = o.id"
    )->fetchColumn();

    $totalOffenses = (int) $pdo->query("SELECT COUNT(*) FROM offenses")->fetchColumn();
    $paidOffenses = (int) $pdo->query("SELECT COUNT(*) FROM offenses WHERE status = 'Paid'")->fetchColumn();
    $complianceRate = $totalOffenses > 0 ? ($paidOffenses / $totalOffenses) * 100 : 0.0;

    $monthly = $pdo->query(
        "SELECT DATE_FORMAT(occurred_at, '%b') AS label, COUNT(*) AS total
         FROM offenses
         WHERE occurred_at >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
         GROUP BY YEAR(occurred_at), MONTH(occurred_at)
         ORDER BY YEAR(occurred_at), MONTH(occurred_at)"
    )->fetchAll();

    $provinceRevenue = $pdo->query(
        "SELECT
            COALESCE(u.province, 'Unassigned') AS province,
            COALESCE(SUM(t.amount), 0) AS total
         FROM transactions t
         INNER JOIN offenses o ON o.id = t.offense_id
         LEFT JOIN users u ON u.id = o.officer_user_id
         WHERE t.status = 'Success'
         GROUP BY COALESCE(u.province, 'Unassigned')
         ORDER BY total DESC, province ASC
         LIMIT 6"
    )->fetchAll();

    $hourly = $pdo->query(
        "SELECT
            CASE
                WHEN HOUR(occurred_at) BETWEEN 6 AND 8 THEN '06-09'
                WHEN HOUR(occurred_at) BETWEEN 9 AND 11 THEN '09-12'
                WHEN HOUR(occurred_at) BETWEEN 12 AND 14 THEN '12-15'
                WHEN HOUR(occurred_at) BETWEEN 15 AND 17 THEN '15-18'
                WHEN HOUR(occurred_at) BETWEEN 18 AND 20 THEN '18-21'
                ELSE '21-06'
            END AS label,
            COUNT(*) AS total
         FROM offenses
         GROUP BY label
         ORDER BY FIELD(label, '06-09', '09-12', '12-15', '15-18', '18-21', '21-06')"
    )->fetchAll();

    $topLocations = $pdo->query(
        "SELECT location, COUNT(*) AS total
         FROM offenses
         GROUP BY location
         ORDER BY total DESC, location ASC
         LIMIT 5"
    )->fetchAll();

    $performance = $pdo->query(
        "SELECT
            CONCAT(u.first_name, ' ', u.last_name) AS officer_name,
            COUNT(o.id) AS offenses,
            CASE
                WHEN COUNT(o.id) >= 10 THEN 'Excellent'
                WHEN COUNT(o.id) >= 5 THEN 'Good'
                WHEN COUNT(o.id) >= 1 THEN 'Average'
                ELSE 'Idle'
            END AS rating
         FROM users u
         LEFT JOIN offenses o ON o.officer_user_id = u.id
            AND YEAR(o.occurred_at) = YEAR(CURDATE())
            AND MONTH(o.occurred_at) = MONTH(CURDATE())
         WHERE u.role = 'officer'
         GROUP BY u.id, u.first_name, u.last_name
         ORDER BY offenses DESC, officer_name ASC
         LIMIT 5"
    )->fetchAll();

    return [
        'summary' => [
            'ytd_offenses' => $ytdOffenses,
            'ytd_revenue' => $ytdRevenue,
            'avg_resolution_days' => round($avgResolutionHours / 24, 1),
            'compliance_rate' => round($complianceRate, 1),
            'total_offenses' => $totalOffenses,
            'paid_offenses' => $paidOffenses,
        ],
        'monthly' => $monthly,
        'province_revenue' => $provinceRevenue,
        'hours' => $hourly,
        'locations' => $topLocations,
        'performance' => $performance,
    ];
}

function dashboard_snapshot(): array
{
    $pdo = db();

    $totalToday = (int) $pdo->query("SELECT COUNT(*) FROM offenses WHERE DATE(occurred_at) = CURDATE()")->fetchColumn();
    $pending = (int) $pdo->query("SELECT COUNT(*) FROM offenses WHERE status IN ('Pending', 'Unpaid', 'Disputed')")->fetchColumn();
    $revenue = (float) $pdo->query("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'Success'")->fetchColumn();
    $activeOfficers = (int) $pdo->query("SELECT COUNT(*) FROM officer_locations WHERE duty_status = 'On Duty'")->fetchColumn();

    $provinceStmt = $pdo->query(
        "SELECT
            COALESCE(u.province, 'Unassigned') AS province,
            COUNT(o.id) AS offense_count,
            COALESCE(SUM(CASE WHEN o.status = 'Paid' THEN o.fine_amount ELSE 0 END), 0) AS collected
         FROM offenses o
         LEFT JOIN users u ON u.id = o.officer_user_id
         GROUP BY COALESCE(u.province, 'Unassigned')
         ORDER BY offense_count DESC
         LIMIT 5"
    );

    return [
        'totals' => [
            'offenses_today' => $totalToday,
            'pending_fines' => $pending,
            'revenue' => $revenue,
            'active_officers' => $activeOfficers,
        ],
        'recent_offenses' => array_slice(fetch_offenses(), 0, 5),
        'province_summary' => $provinceStmt->fetchAll(),
    ];
}
