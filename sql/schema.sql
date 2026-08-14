-- RealtyCompass database schema.
-- Import via phpMyAdmin (or `mysql -u USER -p DB_NAME < schema.sql`).

CREATE TABLE IF NOT EXISTS leads (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(160) NOT NULL,
  ip_address VARCHAR(45) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_leads_email (email),
  KEY idx_leads_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS submissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  lead_id INT UNSIGNED NOT NULL,
  categories_selected VARCHAR(255) NOT NULL DEFAULT '',
  budget VARCHAR(20) NOT NULL,
  goal VARCHAR(30) NOT NULL,
  risk VARCHAR(20) NOT NULL,
  timeline VARCHAR(20) NOT NULL,
  market_type VARCHAR(20) NOT NULL,
  region VARCHAR(120) NOT NULL DEFAULT '',
  top_result_1 VARCHAR(30) DEFAULT NULL,
  top_result_2 VARCHAR(30) DEFAULT NULL,
  top_result_3 VARCHAR(30) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_submissions_lead_id (lead_id),
  CONSTRAINT fk_submissions_lead
    FOREIGN KEY (lead_id) REFERENCES leads (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
