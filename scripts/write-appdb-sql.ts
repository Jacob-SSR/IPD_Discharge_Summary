// scripts/write-appdb-sql.ts — สร้าง docs/sql/appdb.sql ใหม่หลังแก้ lib/appdb/schema.ts
import { writeFileSync } from "node:fs";
import { appdbSqlFile } from "@/lib/appdb/sqlFile";

writeFileSync("docs/sql/appdb.sql", appdbSqlFile());
console.log("เขียน docs/sql/appdb.sql แล้ว");
