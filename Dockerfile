# syntax=docker/dockerfile:1
# OnlyPhoto (Python) — 单实例镜像。数据持久化在 /data 卷（SQLite + 上传文件）。

FROM python:3.12-slim-bookworm

# uv 是本项目的依赖管理器；使用官方静态二进制。
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0 \
    UV_PROJECT_ENVIRONMENT=/app/.venv

WORKDIR /app

# 1) 先装依赖，让这一层只随锁文件变化而失效。
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# 2) 应用源码与迁移脚本（非 package 项目，无需安装 project 本身）。
COPY app ./app
COPY migrations ./migrations
COPY scripts ./scripts

# 3) 运行时数据目录：SQLite 数据库与私有上传文件。
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /data/uploads \
    && chown -R appuser:appuser /data

ENV PATH="/app/.venv/bin:${PATH}" \
    DATABASE_URL="file:/data/onlyphoto.db" \
    UPLOAD_DIR="/data/uploads" \
    PORT=8000

USER appuser

EXPOSE 8000

# 数据库与上传文件必须持久化；命名卷首次挂载会继承该目录属主。
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3).status == 200 else 1)"]

# SQLite 为单实例共享文件，固定单 worker；反向代理下信任转发头。
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers"]