CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_number VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    phone VARCHAR(40) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL,
    role VARCHAR(40) NOT NULL DEFAULT 'officer',
    rank_title VARCHAR(80) NULL,
    province VARCHAR(80) NULL,
    station VARCHAR(120) NULL,
    nrc VARCHAR(60) NULL,
    dob DATE NULL,
    supervisor_name VARCHAR(160) NULL,
    account_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS citizens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    nrc VARCHAR(60) NOT NULL UNIQUE,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    email VARCHAR(120) NULL,
    license_number VARCHAR(80) NOT NULL UNIQUE,
    license_class VARCHAR(80) NULL,
    address_line VARCHAR(160) NULL,
    province VARCHAR(80) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_citizens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_citizen_id INT NULL,
    plate_number VARCHAR(40) NOT NULL UNIQUE,
    make VARCHAR(80) NOT NULL,
    model VARCHAR(80) NOT NULL,
    vehicle_year INT NULL,
    colour VARCHAR(40) NULL,
    chassis_number VARCHAR(120) NULL UNIQUE,
    roadworthy_expiry DATE NULL,
    insurance_status VARCHAR(30) NOT NULL DEFAULT 'Valid',
    status VARCHAR(30) NOT NULL DEFAULT 'Active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vehicles_citizen FOREIGN KEY (owner_citizen_id) REFERENCES citizens(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS officer_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    officer_user_id INT NOT NULL,
    checkpoint VARCHAR(120) NOT NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    duty_status VARCHAR(20) NOT NULL DEFAULT 'On Duty',
    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_officer_locations_user FOREIGN KEY (officer_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS offense_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    category VARCHAR(20) NOT NULL DEFAULT 'Medium',
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    demerit_points INT NOT NULL DEFAULT 0,
    description TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS offenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    offense_code VARCHAR(30) NOT NULL UNIQUE,
    citizen_id INT NULL,
    vehicle_id INT NULL,
    vehicle_plate VARCHAR(40) NOT NULL,
    driver_name VARCHAR(120) NOT NULL,
    offense_type_id INT NOT NULL,
    location VARCHAR(160) NOT NULL,
    speed_recorded INT NULL,
    occurred_at DATETIME NOT NULL,
    fine_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    notes TEXT NULL,
    officer_user_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_offenses_citizen FOREIGN KEY (citizen_id) REFERENCES citizens(id) ON DELETE SET NULL,
    CONSTRAINT fk_offenses_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    CONSTRAINT fk_offenses_type FOREIGN KEY (offense_type_id) REFERENCES offense_types(id),
    CONSTRAINT fk_offenses_officer FOREIGN KEY (officer_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS evidence_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    offense_id INT NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    uploaded_by INT NULL,
    uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_evidence_offense FOREIGN KEY (offense_id) REFERENCES offenses(id) ON DELETE CASCADE,
    CONSTRAINT fk_evidence_user FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_code VARCHAR(30) NOT NULL UNIQUE,
    offense_id INT NOT NULL,
    method VARCHAR(80) NOT NULL,
    account_reference VARCHAR(120) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    processed_by INT NULL,
    processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transactions_offense FOREIGN KEY (offense_id) REFERENCES offenses(id) ON DELETE CASCADE,
    CONSTRAINT fk_transactions_user FOREIGN KEY (processed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipient_type VARCHAR(80) NOT NULL,
    recipient_reference VARCHAR(160) NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'SMS',
    message TEXT NOT NULL,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'Sent',
    sent_by INT NULL,
    sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(80) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    updated_by INT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
