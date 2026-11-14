# LabWala web app (Next.js, production build)
FROM node:22-bookworm-slim AS build
WORKDIR /app
# Build tools only for native modules (better-sqlite3) if no prebuilt binary matches
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm rebuild better-sqlite3
COPY . .
RUN cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs \
 && npx next build \
 && rm -rf data

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/app/data NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
RUN mkdir -p /app/data && chmod 700 /app/data
EXPOSE 3100
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3100"]
