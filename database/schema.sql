-- Security Incident Portal Database Schema
-- Production-ready schema for MySQL 8.0+
-- Database: SecurityIncidentPortal
-- Database schema for Company Security Portal

-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS SecurityIncidentPortal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE SecurityIncidentPortal;

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS request_audit_log;
DROP TABLE IF EXISTS request_comments;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS requests;
DROP VIEW IF EXISTS request_stats;

-- Main requests table for both security incidents and access requests
CREATE TABLE requests (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    user_info JSON NOT NULL,
    form_data JSON,
    request_type VARCHAR(50) NOT NULL,
    details JSON,
    reason TEXT,
    request_status VARCHAR(20) DEFAULT 'pending',
    priority_level VARCHAR(20) DEFAULT 'normal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    assigned_to VARCHAR(100),
    assigned_by VARCHAR(100),
    
    -- Indexes for performance
    INDEX idx_user_id (user_id),
    INDEX idx_request_type (request_type),
    INDEX idx_request_status (request_status),
    INDEX idx_priority_level (priority_level),
    INDEX idx_created_at (created_at),
    INDEX idx_assigned_to (assigned_to),
    
    -- Constraints for security incidents and access requests
    CONSTRAINT chk_request_status 
    CHECK (request_status IN (
        -- Security incident statuses (matches frontend expectations)
        'open', 'in-progress', 'resolved', 'closed'
    )),
    
    CONSTRAINT chk_priority_level 
    CHECK (priority_level IN (
        -- Security incident priorities
        'low', 'medium', 'high', 'critical'
    )),
    
    CONSTRAINT chk_request_type
    CHECK (request_type IN (
        -- Security incident types (matches PhishingReportForm.jsx)
        'phishing-email', 'suspicious-website', 'social-engineering', 
        'malware', 'data-breach', 'identity-theft', 'other',
        -- Special type for phishing reports from frontend
        'phishing-report'
    ))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comments table for request discussions
CREATE TABLE request_comments (
    id VARCHAR(50) PRIMARY KEY,
    request_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    user_name VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key and indexes
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    INDEX idx_request_id (request_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User roles table - For caching user roles and permissions
CREATE TABLE user_roles (
    user_id VARCHAR(100) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    user_name VARCHAR(200),
    user_role VARCHAR(20) DEFAULT 'user',
    permissions JSON,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_email (email),
    INDEX idx_user_role (user_role),
    
    -- Constraints
    CHECK (user_role IN ('user', 'it-support', 'admin'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Request audit log table - For tracking changes
CREATE TABLE request_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    old_values JSON,
    new_values JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_request_id (request_id),
    INDEX idx_user_id (user_id),
    INDEX idx_action_type (action_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default IT team members
INSERT INTO user_roles (user_id, email, user_name, user_role, permissions) VALUES
('john-smith', 'john.smith@company.net', 'John Smith', 'admin', 
 JSON_ARRAY('request:create', 'request:view-own', 'request:view-all', 'request:approve', 'request:assign', 'request:delete', 'notification:send', 'user:manage', 'analytics:view')),
('admin-user', 'admin@company.net', 'Admin User', 'admin', 
 JSON_ARRAY('request:create', 'request:view-own', 'request:view-all', 'request:approve', 'request:assign', 'request:delete', 'notification:send', 'user:manage', 'analytics:view')),
ON DUPLICATE KEY UPDATE 
    user_name = VALUES(user_name),
    user_role = VALUES(user_role),
    permissions = VALUES(permissions);

-- Comprehensive statistics view (matches getRequestStats.js expectations)
CREATE VIEW request_stats AS
SELECT 
    COUNT(*) as total_requests,
    
    -- Security incident statuses
    SUM(CASE WHEN request_status = 'open' THEN 1 ELSE 0 END) as open_count,
    SUM(CASE WHEN request_status = 'in-progress' THEN 1 ELSE 0 END) as in_progress_count,
    SUM(CASE WHEN request_status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
    SUM(CASE WHEN request_status = 'closed' THEN 1 ELSE 0 END) as closed_count,
    

    
    -- Time-based counts
    SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_count,
    SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as week_count,
    SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as month_count,
    
    -- Security incident types
    SUM(CASE WHEN request_type = 'phishing-email' THEN 1 ELSE 0 END) as phishing_email_count,
    SUM(CASE WHEN request_type = 'suspicious-website' THEN 1 ELSE 0 END) as suspicious_website_count,
    SUM(CASE WHEN request_type = 'social-engineering' THEN 1 ELSE 0 END) as social_engineering_count,
    SUM(CASE WHEN request_type = 'malware' THEN 1 ELSE 0 END) as malware_count,
    SUM(CASE WHEN request_type = 'data-breach' THEN 1 ELSE 0 END) as data_breach_count,
    SUM(CASE WHEN request_type = 'identity-theft' THEN 1 ELSE 0 END) as identity_theft_count,
    
    -- Other security incident types
    SUM(CASE WHEN request_type = 'other' THEN 1 ELSE 0 END) as other_count,
    SUM(CASE WHEN request_type = 'phishing-report' THEN 1 ELSE 0 END) as phishing_report_count,
    
    -- Priority levels
    SUM(CASE WHEN priority_level = 'low' THEN 1 ELSE 0 END) as priority_low_count,
    SUM(CASE WHEN priority_level = 'medium' THEN 1 ELSE 0 END) as priority_medium_count,
    SUM(CASE WHEN priority_level = 'high' THEN 1 ELSE 0 END) as priority_high_count,
    SUM(CASE WHEN priority_level = 'critical' THEN 1 ELSE 0 END) as priority_critical_count,

    
    -- All reports are security incidents now
    SUM(CASE WHEN request_type IN (
        'phishing-email', 'suspicious-website', 'social-engineering', 
        'malware', 'data-breach', 'identity-theft', 'phishing-report', 'other'
    ) THEN 1 ELSE 0 END) as security_incidents_count,
    
    -- Average processing time in hours
    ROUND(AVG(CASE 
        WHEN request_status IN ('completed', 'resolved', 'closed') AND 
             (completed_at IS NOT NULL OR updated_at IS NOT NULL)
        THEN TIMESTAMPDIFF(HOUR, created_at, COALESCE(completed_at, updated_at))
        ELSE NULL 
    END), 2) as avg_processing_time_hours
    
FROM requests;

-- Insert sample data for testing (optional - remove for production)
-- Security incident sample
INSERT INTO requests (
    id, user_id, user_info, form_data, request_type, details, reason, 
    request_status, priority_level, created_at
) VALUES (
    'SEC-SAMPLE-001',
    'test-user-123',
    JSON_OBJECT('name', 'Test User', 'email', 'test@company.net', 'department', 'IT'),
    JSON_OBJECT('severity', 'high', 'affectedSystems', 'Email', 'incidentTime', '2024-01-15T10:30:00Z'),
    'phishing-email',
    JSON_OBJECT('description', 'Suspicious email received with malicious attachment', 'reportType', 'security-incident'),
    'Received suspicious email claiming to be from bank requesting login credentials',
    'open',
    'high',
    NOW()
);

-- Phishing report sample (matches frontend PhishingReportForm.jsx)
INSERT INTO requests (
    id, user_id, user_info, form_data, request_type, details, reason, 
    request_status, priority_level, created_at
) VALUES (
    'PHI-SAMPLE-001',
    'test-user-456',
    JSON_OBJECT('name', 'Jane Doe', 'email', 'jane@company.net', 'department', 'Development'),
    JSON_OBJECT(
        'department', 'Development',
        'incidentType', 'phishing-email',
        'severity', 'medium',
        'subject', 'Suspicious bank email',
        'description', 'Received email asking for login credentials',
        'senderEmail', 'fake-bank@suspicious.com',
        'dateOccurred', '2024-01-15',
        'timeOccurred', '14:30'
    ),
    'phishing-report',
    JSON_OBJECT('reportType', 'security-incident', 'submittedAt', NOW()),
    'phishing-email - Suspicious bank email',
    'open',
    'medium',
    NOW()
);

-- Additional security incident sample
INSERT INTO requests (
    id, user_id, user_info, form_data, request_type, details, reason, 
    request_status, priority_level, created_at
) VALUES (
    'SEC-SAMPLE-002',
    'test-user-789',
    JSON_OBJECT('name', 'John Smith', 'email', 'john.smith@company.net', 'department', 'Development'),
    JSON_OBJECT('severity', 'critical', 'affectedSystems', 'Network', 'incidentTime', '2024-01-16T09:15:00Z'),
    'malware',
    JSON_OBJECT('description', 'Suspicious file detected on workstation', 'reportType', 'security-incident'),
    'Antivirus detected potential malware on employee workstation',
    'open',
    'critical',
    NOW()
);

-- Verify the setup
SELECT 'Database schema created successfully!' as status;
SELECT 'Sample data inserted' as info;
SELECT * FROM request_stats;

-- Show table structure
DESCRIBE requests;
DESCRIBE request_comments;
DESCRIBE user_roles;