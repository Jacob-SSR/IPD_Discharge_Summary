import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    // ค่า env สำหรับ test เท่านั้น (ข้อมูลสมมติ ไม่มี key จริง)
    env: {
      APP_MODE: "demo",
      AI_PROVIDER: "rules",
      AI_TIMEOUT_MS: "5000",
      GEMINI_PAID_TIER: "false",
      NHSO_RATE_PER_ADJRW: "8350",
      HOSPITAL_NAME: "โรงพยาบาลทดสอบ",
      HOSPITAL_CODE: "99999",
      HOSPITAL_PROVINCE: "ทดสอบ",
      JWT_SECRET: "test-secret-test-secret-test-secret-0000",
      APP_DB_FILE: ".data/test-appdb.json",
      APP_USERS_TABLE: "users",
      APP_ALLOWED_ROLES: "DOCTOR,ADMIN,FINANCE",
      APP_DECIDER_ROLES: "DOCTOR",
    },
  },
});
