# syntax=docker/dockerfile:1
# Docker multi-stage แบบเดียวกับ ppc-hos-10667 — next build แบบ standalone บน node 22
# ไม่ต้องมี .env ตอน build (ค่า env อ่านตอน runtime ทั้งหมด) → secret ไม่ติดไปใน image

FROM node:22-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- deps ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder ----------
FROM base AS builder
# หมายเหตุ: เครื่องที่ build ต้องต่อเน็ตได้ เพราะ next/font/google โหลดฟอนต์ Prompt/Sarabun ตอน build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- runner (production) ----------
FROM base AS runner
ENV NODE_ENV=production
ENV TZ=Asia/Bangkok
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs \
    && mkdir -p /app/.data && chown nextjs:nodejs /app/.data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# codebook + ตาราง TDRG อ่านจากไฟล์ตอน runtime
COPY --from=builder --chown=nextjs:nodejs /app/data ./data

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
