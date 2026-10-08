// lib/appdb/schema.ts
// ตารางของฐานข้อมูลแอป (MySQL/MariaDB) — แยกจาก HOSxP โดยสิ้นเชิง
// อยู่ในฐาน MariaDB ของโปรแกรมเองใน Docker (service appdb) — ไม่สร้างตารางบน server HOSxP / ppchos
//   ตารางของแอปขึ้นต้นด้วย ipdsum_ · บัญชีผู้ใช้อ่านจาก ppchos.users แบบอ่านอย่างเดียว (AUTH_DB_*)
//   หรือตาราง users ในฐานนี้ถ้าไม่ได้ตั้ง AUTH_DB_*
// Docker รัน docs/sql/appdb.sql ให้ตอนสร้างฐานครั้งแรก และโปรแกรมสร้างซ้ำแบบ IF NOT EXISTS ตอนเริ่ม (ต้องตรงกับไฟล์นี้ — มี test ตรวจ)

export const T = {
  decisions: "ipdsum_code_decisions",
  aiRuns: "ipdsum_ai_runs",
  courses: "ipdsum_course_texts",
  audit: "ipdsum_audit_log",
} as const;

/** ตารางผู้ใช้แบบเดียวกับ ppchos.users ของ ppc-hos-10667 (user/passweb/name/role) */
export function usersTableSql(table: string): string {
  return `CREATE TABLE IF NOT EXISTS ${table} (
    \`user\`  VARCHAR(50)  NOT NULL PRIMARY KEY,
    passweb VARCHAR(100) NOT NULL COMMENT 'bcrypt (หรือ md5 เก่า ระบบอัปเกรดให้ตอน login)',
    name    VARCHAR(150) NULL,
    role    VARCHAR(30)  NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
}

export const APPDB_SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS ipdsum_code_decisions (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS ipdsum_ai_runs (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS ipdsum_course_texts (
    an          VARCHAR(15) NOT NULL PRIMARY KEY,
    text        MEDIUMTEXT  NOT NULL,
    source      ENUM('ai','rules','manual') NOT NULL,
    updated_by  VARCHAR(50) NOT NULL,
    updated_at  DATETIME    NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS ipdsum_audit_log (
    id        BIGINT AUTO_INCREMENT PRIMARY KEY,
    at        DATETIME     NOT NULL,
    username  VARCHAR(50)  NOT NULL,
    action    VARCHAR(50)  NOT NULL,
    an        VARCHAR(15)  NULL,
    detail    VARCHAR(500) NULL,
    INDEX idx_ipdsum_audit_at (at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];
