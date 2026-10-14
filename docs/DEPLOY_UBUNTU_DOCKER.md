# Ubuntu 与 Docker 部署指南（OnlyPhoto / Python 版）

本指南说明如何把 **OnlyPhoto（Python 分支）** 部署到 Ubuntu，以及在 Docker 中运行。

- 目标形态：**单实例 + 持久磁盘**（SQLite 文件 + 上传目录），这是本项目实际验证并交付的形态。
- 不等同于公开生产上线：上线前仍需人工处理地图授权、内容治理、备份与监控等边界，见文末「边界与安全」及 `docs/DEPLOYMENT.md`。
- 应用启动时会自动应用 `migrations/*.sql`（幂等），无需额外迁移服务。

## 0. 部署形态一览

| 形态 | 适用 | 数据位置 | 启动方式 |
|---|---|---|---|
| Ubuntu 原生（uv + uvicorn + systemd） | 单台 VPS、内网演示机 | `<项目目录>/data/` | `uvicorn app.main:app` |
| Docker / Docker Compose | 需要环境隔离、可复制交付 | 命名卷 `onlyphoto-data`（容器 `/data`） | 容器入口 `uvicorn` |

两种形态配置项完全一致（见 `.env.example`），且都可与 Node 版共用同一份 SQLite 数据库文件。

---

## 1. Ubuntu 原生部署

以 **Ubuntu 22.04 / 24.04 LTS x86_64** 为例。命令以普通用户执行，`sudo` 仅用于系统级操作。

### 1.1 系统依赖

```bash
sudo apt update
sudo apt install -y curl git ca-certificates
```

> Python 无需手动安装：本项目用 **uv** 管理 Python 版本与依赖，uv 会按 `pyproject.toml` 自动准备 Python 3.12（Ubuntu 22.04 自带 3.10，也不影响）。

### 1.2 安装 uv

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source "$HOME/.local/bin/env"     # 或：export PATH="$HOME/.local/bin:$PATH"
uv --version
```

### 1.3 获取代码

```bash
sudo mkdir -p /opt/onlyphoto
sudo chown "$USER":"$USER" /opt/onlyphoto
# 将本分支代码克隆或拷贝到 /opt/onlyphoto（示例为 git 克隆）
git clone <仓库地址> /opt/onlyphoto
cd /opt/onlyphoto
```

### 1.4 安装依赖

```bash
uv sync --frozen
```

- 依据 `uv.lock` 精确复原依赖，安装到项目内 `./.venv`。
- 生产环境可加 `--no-dev` 跳过测试依赖（`pytest` / `playwright`）。

### 1.5 配置环境

```bash
cp .env.example .env.local
chmod 600 .env.local
```

生成并写入 `SESSION_SECRET`（**生产必须设置**，不要复用示例值）：

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

在 `.env.local` 中至少确认：

```dotenv
APP_NAME=OnlyPhoto
APP_URL=https://photo.example.com   # 使用 https 时据此启用 Secure Cookie
APP_DEMO_MODE=false                 # 正式环境关闭演示数据
SESSION_SECRET=<上一步生成的值>
DATABASE_URL=file:./data/onlyphoto.db
UPLOAD_DIR=./data/uploads
```

接入真实 AI（可选，密钥仅服务端使用，切勿提交）：

```dotenv
AI_MODE=live
AI_BASE_URL=https://<host>/compatible-mode/v1
AI_API_KEY=<你的密钥>
AI_VISION_MODEL=<支持图片输入的模型 ID>
AI_DISABLE_THINKING=true            # 推理型模型（如 Qwen3）建议开启
```

### 1.6 初始化数据库与演示数据

```bash
uv run python scripts/migrate.py    # 幂等；可在已有数据库上运行
uv run python scripts/seed.py       # 幂等演示数据；APP_DEMO_MODE=false 时自动跳过
```

> 也可以在已有数据库上直接启动，应用会自动迁移；`migrate.py` 便于先验证再启动。

### 1.7 启动

```bash
# 前台试运行
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000

# 健康检查
curl -fsS http://127.0.0.1:8000/api/health
```

- SQLite 为单实例共享文件，**固定单 worker**，不要用多进程/多副本共享同一数据库。
- 经反向代理时保留 `--proxy-headers`（uvicorn 默认已启用），并通过 `--forwarded-allow-ips` 指定可信代理地址。

### 1.8 用 systemd 常驻（推荐）

创建 `/etc/systemd/system/onlyphoto.service`：

```ini
[Unit]
Description=OnlyPhoto (FastAPI)
After=network.target

[Service]
Type=simple
User=onlyphoto
WorkingDirectory=/opt/onlyphoto
ExecStart=/opt/onlyphoto/.venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 --port 8000 --workers 1 --proxy-headers \
    --forwarded-allow-ips=127.0.0.1
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
# 建议为服务创建专用用户，并确保其可写数据目录
sudo useradd --system --home /opt/onlyphoto --shell /usr/sbin/nologin onlyphoto
sudo chown -R onlyphoto:onlyphoto /opt/onlyphoto
sudo chmod 600 /opt/onlyphoto/.env.local

sudo systemctl daemon-reload
sudo systemctl enable --now onlyphoto
sudo systemctl status onlyphoto
```

应用会自动读取 `WorkingDirectory` 下的 `.env.local` / `.env`。

### 1.9 Nginx 反向代理与 HTTPS

```nginx
server {
    listen 80;
    server_name photo.example.com;

    client_max_body_size 20m;   # 单图上限 15MB，留出余量

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- 启用 HTTPS 后把 `APP_URL` 改为 `https://...`；修改类请求会校验 Origin，跨域来源必须与 `APP_URL` 同源。
- 使用 `certbot`（`sudo apt install certbot python3-certbot-nginx`）签发证书即可。

### 1.10 备份与恢复

```bash
# 备份（建议先停服务，保证 SQLite WAL 一致）
sudo systemctl stop onlyphoto
tar czf onlyphoto-data-$(date +%F).tgz -C /opt/onlyphoto data
sudo systemctl start onlyphoto
```

恢复即把 `data/` 还原回项目目录。

---

## 2. Docker 部署

仓库已提供 `Dockerfile`、`docker-compose.yml`、`.dockerignore`，无需自行编写。

镜像要点：

- 基于 `python:3.12-slim`，用官方 uv 二进制 `uv sync --frozen --no-dev` 安装依赖。
- 以非 root 用户（uid `10001`）运行；数据库与上传目录固定在容器内 `/data`（声明的 `VOLUME`）。
- 内置 `HEALTHCHECK`，检查 `GET /api/health`。

### 2.1 安装 Docker（Ubuntu）

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"    # 重新登录后生效，之后无需 sudo
docker --version && docker compose version
```

### 2.2 构建镜像

```bash
cd /opt/onlyphoto
docker build -t onlyphoto:local .
```

### 2.3 用 docker run 运行

```bash
docker run -d --name onlyphoto \
  --restart unless-stopped \
  -p 8000:8000 \
  -e APP_URL=http://localhost:8000 \
  -e APP_DEMO_MODE=true \
  -e SESSION_SECRET="$(openssl rand -base64 48)" \
  -v onlyphoto-data:/data \
  onlyphoto:local

docker logs -f onlyphoto
curl -fsS http://localhost:8000/api/health
```

- `-v onlyphoto-data:/data` 为命名卷，保存 SQLite 与上传文件；**没有该卷就不会持久化**。
- 用 **bind mount** 时需匹配容器内属主：`sudo chown -R 10001:10001 /srv/onlyphoto && -v /srv/onlyphoto:/data`。

### 2.4 用 Docker Compose 运行（推荐）

Compose 会自动读取与 `docker-compose.yml` 同目录的 `.env` 文件用于变量插值（该文件已被 `.gitignore` 忽略，不要提交）：

```bash
cat > .env <<'EOF'
SESSION_SECRET=<用 openssl rand -base64 48 生成>
APP_URL=http://localhost:8000
APP_DEMO_MODE=true
# 需要真实 AI 时再填：
# AI_MODE=live
# AI_BASE_URL=https://<host>/compatible-mode/v1
# AI_API_KEY=<你的密钥>
# AI_VISION_MODEL=<模型 ID>
EOF
chmod 600 .env

docker compose up -d --build
docker compose ps
docker compose logs -f onlyphoto
```

常用操作：

```bash
docker compose restart onlyphoto    # 改配置后重启生效
docker compose down                 # 停止并删除容器（命名卷保留数据）
docker compose down -v              # 连同数据卷一起删除（会丢失数据）
```

### 2.5 更新版本

```bash
git pull
docker compose up -d --build        # 重新构建并替换容器；应用启动时会自动应用 migrations/*.sql
```

### 2.6 备份 Docker 数据卷

```bash
# 备份
docker run --rm -v onlyphoto-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/onlyphoto-data-$(date +%F).tgz -C /data .

# 恢复（先停容器）
docker compose stop onlyphoto
docker run --rm -v onlyphoto-data:/data -v "$PWD":/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/<备份文件>.tgz -C /data"
docker compose start onlyphoto
```

### 2.7 代理在其他容器时

若用独立的 Nginx/Traefik 容器反代，需让应用信任代理来源，可在 `docker-compose.yml` 的 `CMD` 追加 `--forwarded-allow-ips=*`（仅当代理链路可信时），并将 `APP_URL` 设为对外的 `https` 地址。

---

## 3. 边界与安全

本指南交付的是**可运行、可演示、可本地/单机部署的 MVP**，请如实表述，不要称其为「已公开上线」或「已承载大规模用户」。

- **必须持久磁盘**：SQLite 与上传文件在 `data/`（或 Docker 卷）；部署到无持久盘的 serverless 环境不会保存数据。
- **单实例**：SQLite 为单文件数据库，不要多副本/多 worker 共享同一文件。
- **密钥不落地镜像**：`.env` / `.env.local` 已在 `.gitignore` 与 `.dockerignore` 中排除，切勿写入镜像或提交仓库。
- **演示数据须标注**：`APP_DEMO_MODE=true` 时会种入演示机位与演示用户；正式环境应关闭。
- **地图**：默认 OSM 标准瓦片仅适合本地/低流量演示，须保留署名并遵守其使用政策；高流量上线前应选择有许可与配额的商业地图服务。
- **AI**：`AI_MODE=live` 才调用真实接口，密钥仅服务端使用；`live_budget` 是应用侧请求预算，不是金额上限。
- **公开上线前仍需人工处理**：地图授权、图片与隐私政策、内容治理流程、正式备份策略、监控告警与并发容量评估。
- 本项目**未公开部署**，本指南不代替上线审批。

## 4. 常见问题

| 现象 | 处理 |
|---|---|
| 启动报端口占用 | 改 `PORT` 或 `HOST_PORT`（Compose），或释放 `8000` 端口 |
| Docker 内 `/data` 不可写 | 使用命名卷；bind mount 时执行 `sudo chown -R 10001:10001 <宿主机目录>` |
| 登录状态异常/会话丢失 | 检查 `SESSION_SECRET` 是否已设置为固定随机值（不要每次重启重新生成） |
| 桌面地图空白 | 未配置 `AMAP_JS_KEY` 时回退 OSM；检查出网与瓦片地址 |
| 上传失败 | 确认反代 `client_max_body_size` 不小于 20m，且数据目录可写 |
| 页面仍是旧样式 | 服务对静态资源强制再校验，普通刷新即可；必要时清浏览器缓存 |
| 健康检查不通过 | 查看容器/服务日志；`GET /api/health` 应返回 200 |