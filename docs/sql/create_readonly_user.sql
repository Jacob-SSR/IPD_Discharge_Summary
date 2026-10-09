-- docs/sql/create_readonly_user.sql
-- user อ่านอย่างเดียวสำหรับโปรแกรมนี้ — ให้ DBA รันบน server HOSxP (แนะนำ Slave/Replica)
-- รพ.พลับพลาชัย: ฐาน HOSxP ชื่อ ppchos (ตาราง users ของ ppc-hos อยู่ในฐานเดียวกัน)
-- เปลี่ยน '192.168.%' เป็นช่วง IP ของเครื่องที่รันโปรแกรม และตั้งรหัสผ่านใหม่
-- ใช้ user นี้ได้ทั้ง HOSXP_DB_USER และ AUTH_DB_USER (อ่าน ppchos.users สำหรับ login)
-- ⚠️ อย่าใช้ DB_USER ของ ppc-hos เพราะมีสิทธิ์เขียน (หน้า /system จะขึ้นสีแดง)

CREATE USER 'ipd_summary_ro'@'192.168.%' IDENTIFIED BY 'เปลี่ยนรหัสผ่านนี้';

-- สิทธิ์ SELECT เฉพาะตารางที่ใช้ (ตรงกับ lib/hosxp/schema.ts + users สำหรับ login — มี test ตรวจ)
GRANT SELECT ON ppchos.ipt          TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.patient      TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.thaiaddress  TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.an_stat      TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.ward         TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.doctor       TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.pttype       TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.dchstts      TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.dchtype      TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.iptdiag      TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.icd101       TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.iptoprt      TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.icd9cm1      TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.lab_head     TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.lab_order    TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.lab_items    TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.opitemrece   TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.drugitems    TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.opdscreen    TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.ovstdiag     TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON ppchos.users        TO 'ipd_summary_ro'@'192.168.%';

-- ตรวจผล: ต้องเห็นแค่ GRANT USAGE / GRANT SELECT
SHOW GRANTS FOR 'ipd_summary_ro'@'192.168.%';
