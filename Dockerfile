# ==========================================
# KaraRoom - Multi-Stage Production Dockerfile
# Chạy đồng thời Next.js và Socket.IO trên cùng port 3000
# ==========================================

# 1. Base stage: Cài đặt dependencies
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Cài đặt pnpm trực tiếp qua npm (tránh lỗi cache /nonexistent của Corepack khi chạy non-root)
RUN npm install -g pnpm@latest

# Copy lockfile và cấu hình build package
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

# 2. Builder stage: Biên dịch Next.js production
FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN npm install -g pnpm@latest

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# 3. Runner stage: Container chạy ứng dụng
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOME=/home/kararoom
ENV PATH=/app/node_modules/.bin:$PATH

RUN npm install -g pnpm@latest

# Tạo user bảo mật không dùng quyền root và cấp quyền thư mục home, app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs --home /home/kararoom kararoom && \
    mkdir -p /home/kararoom /app/.data && \
    chown -R kararoom:nodejs /home/kararoom /app

# Copy dependencies và mã nguồn cần thiết để chạy custom server.ts
COPY --from=builder --chown=kararoom:nodejs /app/package.json ./package.json
COPY --from=builder --chown=kararoom:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=kararoom:nodejs /app/.next ./.next
COPY --from=builder --chown=kararoom:nodejs /app/public ./public
COPY --from=builder --chown=kararoom:nodejs /app/server ./server
COPY --from=builder --chown=kararoom:nodejs /app/shared ./shared
COPY --from=builder --chown=kararoom:nodejs /app/config.ts ./config.ts
COPY --from=builder --chown=kararoom:nodejs /app/server.ts ./server.ts
COPY --from=builder --chown=kararoom:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=kararoom:nodejs /app/next.config.ts ./next.config.ts

USER kararoom

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (res) => process.exit(res.statusCode < 500 ? 0 : 1))"

CMD ["pnpm", "start"]

