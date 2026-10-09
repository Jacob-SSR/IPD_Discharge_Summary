-- docs/sql/create_app_user.sql
-- user สำหรับ APP_DB_URL — เขียนได้เฉพาะตารางใหม่ของโปรแกรม (ipdsum_*) ในฐาน ppchos
-- ไม่มีสิทธิ์กับตารางเดิมของ HOSxP เลย (อ่านข้อมูลผู้ป่วยใช้ user อ่านอย่างเดียวใน create_readonly_user.sql)
--
-- ขั้นตอนสำหรับ DBA (รันด้วย user admin):
--   1) สร้างตาราง:  mysql -h <server> -u <admin> -p ppchos < docs/sql/appdb.sql
--   2) รันไฟล์นี้ (เปลี่ยน '192.168.%' เป็นช่วง IP ของเครื่องที่รันโปรแกรม และตั้งรหัสผ่านใหม่)

CREATE USER 'ipd_summary_app'@'192.168.%' IDENTIFIED BY 'เปลี่ยนรหัสผ่านนี้';

GRANT SELECT, INSERT, UPDATE ON ppchos.ipdsum_code_decisions TO 'ipd_summary_app'@'192.168.%';
GRANT SELECT, INSERT, UPDATE ON ppchos.ipdsum_ai_runs        TO 'ipd_summary_app'@'192.168.%';
GRANT SELECT, INSERT, UPDATE ON ppchos.ipdsum_course_texts   TO 'ipd_summary_app'@'192.168.%';
GRANT SELECT, INSERT, UPDATE ON ppchos.ipdsum_audit_log      TO 'ipd_summary_app'@'192.168.%';

-- ตรวจผล: ต้องเห็นแค่ ppchos.ipdsum_* 4 ตาราง
SHOW GRANTS FOR 'ipd_summary_app'@'192.168.%';
