-- docs/sql/appdb.sql — ตารางของแอป IPD Discharge Summary (สร้างจาก lib/appdb/schema.ts ห้ามแก้มือ)
-- รันอัตโนมัติใน Docker (service appdb ของ docker-compose.yml) ตอนสร้างฐานครั้งแรก — ไม่ต้องรันบน server HOSxP / ppchos
-- ตาราง users: ใช้เฉพาะเมื่อไม่ได้ตั้ง AUTH_DB_* (login ด้วย ppchos.users แบบอ่านอย่างเดียว)

CREATE TABLE IF NOT EXISTS users (
  `user`  VARCHAR(50)  NOT NULL PRIMARY KEY,
  passweb VARCHAR(100) NOT NULL COMMENT 'bcrypt (หรือ md5 เก่า ระบบอัปเกรดให้ตอน login)',
  name    VARCHAR(150) NULL,
  role    VARCHAR(30)  NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ipdsum_code_decisions (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  an          VARCHAR(15)  NOT NULL,
  code        VARCHAR(10)  NOT NULL,
  code_system ENUM('ICD10','ICD9CM') NOT NULL,
  source      ENUM('ai','rules','manual') NOT NULL,
  action      ENUM('accept','reject','undo','add','remove') NOT NULL,
  diagtype    CHAR(1) NULL,
  or_type     ENUM('OR','NonOR') NULL,
  op_date     DATE NULL,
  provider    VARCHAR(30)  NULL,
  model       VARCHAR(100) NULL,
  ai_run_id   BIGINT NULL,
  decided_by  VARCHAR(50)  NOT NULL,
  decided_at  DATETIME     NOT NULL,
  INDEX idx_ipdsum_dec_an (an),
  INDEX idx_ipdsum_dec_at (decided_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ipdsum_ai_runs (
  id                     BIGINT AUTO_INCREMENT PRIMARY KEY,
  an                     VARCHAR(15)  NOT NULL,
  kind                   ENUM('suggest','course') NOT NULL,
  provider               VARCHAR(30)  NOT NULL,
  model                  VARCHAR(100) NULL,
  fallback_reason        VARCHAR(500) NULL,
  n_suggestions          INT NOT NULL DEFAULT 0,
  n_dropped_no_evidence  INT NOT NULL DEFAULT 0,
  n_not_in_codebook      INT NOT NULL DEFAULT 0,
  result_json            MEDIUMTEXT NOT NULL COMMENT 'ผลลัพธ์ที่ไม่มีข้อมูลระบุตัวตนเท่านั้น',
  created_by             VARCHAR(50)  NOT NULL,
  created_at             DATETIME     NOT NULL,
  INDEX idx_ipdsum_ai_an (an, kind),
  INDEX idx_ipdsum_ai_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ipdsum_course_texts (
  an          VARCHAR(15) NOT NULL PRIMARY KEY,
  text        MEDIUMTEXT  NOT NULL,
  source      ENUM('ai','rules','manual') NOT NULL,
  updated_by  VARCHAR(50) NOT NULL,
  updated_at  DATETIME    NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ipdsum_audit_log (
  id        BIGINT AUTO_INCREMENT PRIMARY KEY,
  at        DATETIME     NOT NULL,
  username  VARCHAR(50)  NOT NULL,
  action    VARCHAR(50)  NOT NULL,
  an        VARCHAR(15)  NULL,
  detail    VARCHAR(500) NULL,
  INDEX idx_ipdsum_audit_at (at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
