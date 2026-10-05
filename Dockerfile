# ==========================================
# KaraRoom - Multi-Stage Production Dockerfile
# Chạy đồng thời Next.js và Socket.IO trên cùng port 3000
# ==========================================

# 1. Base stage: Cài đặt dependencies
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Bật corepack để sử dụng pnpm chuẩn
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy lockfile và cấu hình build package
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

# 2. Builder stage: Biên dịch Next.js production
FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

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

RUN corepack enable && corepack prepare pnpm@latest --activate

# Tạo user bảo mật không dùng quyền root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 kararoom

# Copy dependencies và mã nguồn cần thiết để chạy custom server.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/config.ts ./config.ts
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# Tạo thư mục dữ liệu snapshot và cấp quyền cho user kararoom
RUN mkdir -p /app/.data && chown -R kararoom:nodejs /app/.data

USER kararoom

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/youtube/search?q=test', (res) => process.exit(res.statusCode < 500 ? 0 : 1))"

CMD ["pnpm", "start"]
