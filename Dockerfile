FROM node:20-alpine AS web-build

WORKDIR /workspace/mobile
COPY mobile/package.json mobile/package-lock.json ./
RUN npm ci

COPY mobile/ ./
ENV EXPO_PUBLIC_API_URL=""
ENV NODE_ENV=production
RUN npx expo export --platform web

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY backend/requirements-deploy.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=web-build /workspace/mobile/dist ./web-dist

EXPOSE 8000
CMD ["sh", "-c", "python scripts/bootstrap_demo_admin.py && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
