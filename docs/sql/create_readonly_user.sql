-- docs/sql/create_readonly_user.sql
-- สร้าง user อ่านอย่างเดียวสำหรับแอปนี้ — ให้ DBA รันบน HOSxP (แนะนำ Slave/Replica)
-- เปลี่ยน 'hosxp' เป็นชื่อฐาน, '192.168.%' เป็นช่วง IP ของเครื่องที่รันแอป และตั้งรหัสผ่านใหม่

CREATE USER 'ipd_summary_ro'@'192.168.%' IDENTIFIED BY 'เปลี่ยนรหัสผ่านนี้';

-- สิทธิ์ SELECT เฉพาะตารางที่ใช้ (ตรงกับ lib/hosxp/schema.ts)
GRANT SELECT ON hosxp.ipt          TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON hosxp.patient      TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON hosxp.thaiaddress  TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON hosxp.an_stat      TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON hosxp.ward         TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON hosxp.doctor       TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON hosxp.pttype       TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON hosxp.dchstts      TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON hosxp.dchtype      TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON hosxp.iptdiag      TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON hosxp.icd101       TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON hosxp.iptoprt      TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON hosxp.icd9cm1      TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON hosxp.lab_head     TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON hosxp.lab_order    TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON hosxp.lab_items    TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON hosxp.opitemrece   TO 'ipd_summary_ro'@'192.168.%';
GRANT SELECT ON hosxp.drugitems    TO 'ipd_summary_ro'@'192.168.%';

-- ตรวจผล: ต้องเห็นแค่ GRANT SELECT / GRANT USAGE
SHOW GRANTS FOR 'ipd_summary_ro'@'192.168.%';
