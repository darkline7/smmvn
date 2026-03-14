# HƯỚNG DẪN DEPLOY SMM PANEL PRO (Node.js) LÊN VPS/SERVER

> **Stack:** Node.js 20+ · Express.js · React + Vite · PostgreSQL 16 · pnpm · Nginx · PM2

---

## YÊU CẦU MÁY CHỦ

| Yêu cầu | Tối thiểu | Khuyến nghị |
|---------|-----------|------------|
| **OS** | Ubuntu 20.04 | Ubuntu 22.04 LTS |
| **RAM** | 1 GB | 2 GB |
| **Disk** | 10 GB SSD | 20 GB SSD |
| **CPU** | 1 vCore | 2 vCore |
| **Node.js** | 20 LTS | 22 LTS |
| **PostgreSQL** | 14 | 16 |
| **Domain** | Bắt buộc | Có SSL (Let's Encrypt) |

> Panel này **không chạy được trên Hosting thường (shared hosting/cPanel PHP)** vì cần Node.js process chạy nền. Cần **VPS** hoặc **Cloud Server** (DigitalOcean, Vultr, Hetzner, AWS EC2, v.v.)

---

## BƯỚC 1 — CÀI ĐẶT MÔI TRƯỜNG

SSH vào VPS với tài khoản `root` hoặc user có quyền `sudo`:

```bash
ssh root@IP_VPS_CUA_BAN
```

### 1.1 Cập nhật hệ thống

```bash
apt update && apt upgrade -y
apt install -y curl git build-essential
```

### 1.2 Cài Node.js 22 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v   # Phải hiện v22.x.x
npm -v    # Phải hiện 10.x.x
```

### 1.3 Cài pnpm

```bash
npm install -g pnpm
pnpm -v   # Phải hiện 9.x.x hoặc 10.x.x
```

### 1.4 Cài PM2 (process manager)

```bash
npm install -g pm2
pm2 -v
```

### 1.5 Cài PostgreSQL 16

```bash
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# Kiểm tra đang chạy
systemctl status postgresql
```

### 1.6 Cài Nginx

```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

---

## BƯỚC 2 — TẠO DATABASE POSTGRESQL

```bash
# Chuyển sang user postgres
sudo -u postgres psql

# Trong postgres shell, chạy từng lệnh:
CREATE DATABASE smmpanel;
CREATE USER smmuser WITH ENCRYPTED PASSWORD 'MatKhauManh@2024';
GRANT ALL PRIVILEGES ON DATABASE smmpanel TO smmuser;
\c smmpanel
GRANT ALL ON SCHEMA public TO smmuser;
\q
```

> ⚠️ Thay `MatKhauManh@2024` bằng mật khẩu **mạnh và ngẫu nhiên** của bạn. Lưu lại!

---

## BƯỚC 3 — UPLOAD SOURCE CODE

### Cách 1: Dùng SCP từ máy tính của bạn

```bash
# Chạy lệnh này trên máy tính CỦA BẠN (không phải VPS)
scp smm-panel-pro-source.tar.gz root@IP_VPS:/home/smm/
```

### Cách 2: Dùng FileZilla / WinSCP (giao diện đồ họa)

1. Mở FileZilla
2. Kết nối: Host = IP VPS, User = root, Password = pass VPS, Port = 22
3. Kéo file `smm-panel-pro-source.tar.gz` vào thư mục `/home/smm/`

### Giải nén source code trên VPS

```bash
# Tạo thư mục chứa project
mkdir -p /home/smm/app
cd /home/smm/app

# Giải nén (điều chỉnh đường dẫn nếu cần)
tar -xzf /home/smm/smm-panel-pro-source.tar.gz

# Kiểm tra cấu trúc
ls -la
# Phải thấy: artifacts/  lib/  package.json  pnpm-workspace.yaml ...
```

---

## BƯỚC 4 — CẤU HÌNH BIẾN MÔI TRƯỜNG

### 4.1 Tạo file `.env` cho API Server

```bash
nano /home/smm/app/artifacts/api-server/.env
```

Dán nội dung sau vào (thay các giá trị `<...>` thực tế của bạn):

```env
# ── Môi trường ──────────────────────────────────────────────
NODE_ENV=production
PORT=8080

# ── Database ─────────────────────────────────────────────────
DATABASE_URL=postgresql://smmuser:MatKhauManh@2024@localhost:5432/smmpanel

# ── JWT & Session ────────────────────────────────────────────
# Tạo ngẫu nhiên: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<128_ky_tu_hex_ngau_nhien>
SESSION_SECRET=<64_ky_tu_ngau_nhien>

# ── Site URL ─────────────────────────────────────────────────
SITE_URL=https://yourdomain.com

# ── Admin setup (dùng 1 lần rồi xóa) ────────────────────────
# Sau khi tạo tài khoản admin xong, xóa dòng này
SETUP_KEY=<chuoi_ngau_nhien_de_tao_admin>

# ── Google OAuth (tùy chọn) ─────────────────────────────────
GOOGLE_CLIENT_ID=<google_client_id>
GOOGLE_CLIENT_SECRET=<google_client_secret>

# ── SMTP Email (tùy chọn) ───────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<email@gmail.com>
SMTP_PASS=<app_password>
SMTP_FROM=noreply@yourdomain.com

# ── SePay Webhook ────────────────────────────────────────────
SEPAY_WEBHOOK_SECRET=<sepay_secret_key>

# ── Cloudflare Turnstile (tùy chọn) ─────────────────────────
TURNSTILE_SECRET_KEY=<turnstile_secret>

# ── Telegram (tùy chọn) ─────────────────────────────────────
TELEGRAM_BOT_TOKEN=<bot_token>
TELEGRAM_ADMIN_CHAT_ID=<chat_id>

# ── Salt cho legacy password migration ─────────────────────
SECRET_SALT=<chuoi_ngau_nhien_32_ky_tu>
```

**Tạo các secret ngẫu nhiên:**

```bash
# JWT_SECRET (128 ký tự hex)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# SESSION_SECRET (64 ký tự hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# SETUP_KEY
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# SECRET_SALT
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 4.2 Bảo mật file .env

```bash
chmod 600 /home/smm/app/artifacts/api-server/.env
```

---

## BƯỚC 5 — CÀI ĐẶT DEPENDENCIES VÀ BUILD

```bash
cd /home/smm/app

# Cài tất cả packages
pnpm install

# Push database schema (tạo tất cả tables)
pnpm --filter @workspace/db run push

# Build API server
pnpm --filter @workspace/api-server run build

# Build Frontend React
pnpm --filter @workspace/smm-panel run build
```

> Bước này mất khoảng **2-5 phút** tùy tốc độ VPS.

---

## BƯỚC 6 — TẠO TÀI KHOẢN ADMIN

```bash
# Đảm bảo API server chưa chạy PM2, chạy thử trực tiếp
cd /home/smm/app/artifacts/api-server
node -e "
const dotenv = require('dotenv');
dotenv.config();
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'OK' : 'MISSING');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'OK (length:'+process.env.JWT_SECRET.length+')' : 'MISSING');
"
```

Sau khi server chạy (bước 7), tạo admin qua API:

```bash
# Thay SETUP_KEY bằng giá trị trong .env của bạn
curl -X POST https://yourdomain.com/api/auth/make-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourdomain.com",
    "password": "MatKhauAdmin@2024",
    "setupKey": "SETUP_KEY_CUA_BAN"
  }'
```

> Sau khi tạo admin thành công → xóa `SETUP_KEY` khỏi `.env` và restart server.

---

## BƯỚC 7 — KHỞI ĐỘNG VỚI PM2

### 7.1 Tạo file PM2 config

```bash
cat > /home/smm/app/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: "smm-api",
      script: "/home/smm/app/artifacts/api-server/dist/index.cjs",
      cwd: "/home/smm/app/artifacts/api-server",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env_file: "/home/smm/app/artifacts/api-server/.env",
      env: {
        NODE_ENV: "production",
        PORT: 8080
      },
      error_file: "/var/log/smm/api-error.log",
      out_file: "/var/log/smm/api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
};
EOF

# Tạo thư mục log
mkdir -p /var/log/smm
```

### 7.2 Khởi động

```bash
cd /home/smm/app
pm2 start ecosystem.config.cjs

# Kiểm tra đang chạy
pm2 status
pm2 logs smm-api --lines 50

# Tự khởi động lại sau khi VPS reboot
pm2 startup
pm2 save
```

### 7.3 Kiểm tra API hoạt động

```bash
curl http://localhost:8080/api/health
# Kết quả mong đợi: {"status":"ok","timestamp":"..."}
```

---

## BƯỚC 8 — CẤU HÌNH NGINX

### 8.1 Tạo config Nginx

```bash
nano /etc/nginx/sites-available/smmpanel
```

Dán nội dung sau (thay `yourdomain.com` bằng domain thực của bạn):

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

# HTTPS main server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL (sẽ được Let's Encrypt điền tự động)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Upload limit (cho thẻ cào, ảnh)
    client_max_body_size 10M;

    # API Backend (Express)
    location /api/ {
        proxy_pass http://localhost:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }

    # React Frontend (static files)
    location / {
        root /home/smm/app/artifacts/smm-panel/dist;
        index index.html;
        try_files $uri $uri/ /index.html;

        # Cache assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Logging
    access_log /var/log/nginx/smmpanel.access.log;
    error_log /var/log/nginx/smmpanel.error.log;
}
```

### 8.2 Kích hoạt config

```bash
ln -s /etc/nginx/sites-available/smmpanel /etc/nginx/sites-enabled/

# Test cú pháp
nginx -t

# Reload Nginx
systemctl reload nginx
```

---

## BƯỚC 9 — CÀI SSL MIỄN PHÍ (Let's Encrypt)

```bash
# Cài Certbot
apt install -y certbot python3-certbot-nginx

# Tạo SSL (thay yourdomain.com bằng domain thực)
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Điền email khi được hỏi, chọn Yes/Y
# Certbot tự động sửa Nginx config

# Kiểm tra auto-renew
certbot renew --dry-run
```

---

## BƯỚC 10 — CÀI ĐẶT CÀI ĐẶT TRONG DATABASE

Đăng nhập admin tại `https://yourdomain.com/admin` → **Settings** và điền:

| Cài đặt | Giá trị |
|---------|---------|
| **Site URL** | `https://yourdomain.com` |
| **SePay Partner Code** | *(lấy từ SePay dashboard)* |
| **SePay API Key** | *(lấy từ SePay dashboard)* |
| **Card Partner ID** | *(thesieure.com partner ID)* |
| **Card Partner Key** | *(thesieure.com partner key)* |
| **VND Exchange Rate** | `25000` *(tỷ giá VND/USD)* |
| **Cron Secret** | *(chuỗi ngẫu nhiên để bảo vệ cron API)* |
| **Telegram Bot Token** | *(tùy chọn)* |
| **Telegram Admin Chat ID** | *(tùy chọn)* |

---

## BƯỚC 11 — CẤU HÌNH CRON JOB (Tự Động Đồng Bộ Đơn Hàng)

```bash
crontab -e
```

Thêm các dòng sau:

```bash
# Cập nhật trạng thái đơn hàng từ provider mỗi 5 phút
*/5 * * * * curl -s "https://yourdomain.com/api/cron/update-orders?secret=CRON_SECRET_CUA_BAN" > /dev/null 2>&1

# Đồng bộ dịch vụ từ provider mỗi ngày lúc 3 giờ sáng
0 3 * * * curl -s "https://yourdomain.com/api/cron/sync-all?secret=CRON_SECRET_CUA_BAN" > /dev/null 2>&1
```

> Thay `CRON_SECRET_CUA_BAN` bằng giá trị `cron_secret` đã đặt trong Admin → Settings

---

## BƯỚC 12 — CẤU HÌNH SEPAY WEBHOOK

Trong SePay dashboard, cài đặt Webhook URL:

```
https://yourdomain.com/api/webhooks/sepay
```

- **Method:** POST
- **Secret:** giá trị `SEPAY_WEBHOOK_SECRET` trong file `.env`

---

## BƯỚC 13 — CẤU HÌNH THẺ CÀO (thesieure.com)

Trong tài khoản thesieure.com, đặt **Callback URL**:

```
https://yourdomain.com/api/wallet/cards/callback
```

---

## CẤU TRÚC THƯ MỤC SAU KHI DEPLOY

```
/home/smm/app/
├── artifacts/
│   ├── api-server/              ← Express.js backend
│   │   ├── src/                 ← Source TypeScript
│   │   ├── dist/                ← Build output (chạy từ đây)
│   │   │   └── index.cjs        ← Entry point production
│   │   └── .env                 ← Biến môi trường (QUAN TRỌNG)
│   └── smm-panel/
│       ├── src/                 ← React source
│       └── dist/                ← Static files (Nginx serve)
│           └── index.html
├── lib/
│   └── db/                      ← Drizzle ORM schema
├── ecosystem.config.cjs         ← PM2 config
├── package.json
└── pnpm-workspace.yaml
```

---

## LỆNH QUẢN LÝ HỮU ÍCH

```bash
# Xem log realtime
pm2 logs smm-api

# Restart API server
pm2 restart smm-api

# Xem trạng thái PM2
pm2 status

# Xem log lỗi gần đây
tail -100 /var/log/smm/api-error.log

# Xem log Nginx
tail -100 /var/log/nginx/smmpanel.error.log

# Reload Nginx sau khi thay đổi config
nginx -t && systemctl reload nginx

# Kiểm tra API health
curl http://localhost:8080/api/health

# Backup database
pg_dump -U smmuser -h localhost smmpanel > backup_$(date +%Y%m%d).sql

# Restore database
psql -U smmuser -h localhost smmpanel < backup_20240314.sql
```

---

## CẬP NHẬT SOURCE CODE

```bash
cd /home/smm/app

# 1. Upload file mã nguồn mới lên VPS
# 2. Giải nén đè lên
tar -xzf smm-panel-pro-source-moi.tar.gz

# 3. Cài packages mới (nếu có)
pnpm install

# 4. Push schema changes (nếu có)
pnpm --filter @workspace/db run push

# 5. Build lại
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/smm-panel run build

# 6. Restart PM2
pm2 restart smm-api
```

---

## XỬ LÝ LỖI THƯỜNG GẶP

### API trả về 500
```bash
pm2 logs smm-api --err --lines 50
```
→ Kiểm tra `DATABASE_URL` và `JWT_SECRET` trong `.env`

### Frontend hiển thị blank / 404
```bash
ls /home/smm/app/artifacts/smm-panel/dist/
```
→ Nếu trống: chạy lại `pnpm --filter @workspace/smm-panel run build`

### Không kết nối được DB
```bash
psql -U smmuser -h localhost smmpanel
```
→ Kiểm tra mật khẩu và tên DB

### PM2 không start
```bash
pm2 logs smm-api --lines 100
```
→ Thường do thiếu biến môi trường hoặc file build chưa có

### Nginx lỗi 502 Bad Gateway
```bash
curl http://localhost:8080/api/health
pm2 status
```
→ API server chưa chạy → `pm2 restart smm-api`

---

## CHECKLIST TRƯỚC KHI GO LIVE

- [ ] Domain đã trỏ A record về IP VPS
- [ ] SSL Let's Encrypt đã cài, hiển thị ổ khóa xanh
- [ ] `https://yourdomain.com` → hiển thị trang chủ React
- [ ] `https://yourdomain.com/api/health` → trả về `{"status":"ok"}`
- [ ] Đăng nhập admin hoạt động
- [ ] Tạo thử đơn hàng → trừ balance đúng
- [ ] SePay webhook nhận được (test từ SePay dashboard)
- [ ] Cron job đang chạy (kiểm tra order tự cập nhật sau 5 phút)
- [ ] File `.env` không thể truy cập qua browser (`https://yourdomain.com/.env` → 404)
- [ ] Đã xóa `SETUP_KEY` khỏi `.env` sau khi tạo admin

---

## THÔNG TIN LƯU LẠI SAU DEPLOY

```
Domain:           https://_______________
Admin URL:        https://_______________/admin
Admin Email:      _______________
Admin Password:   _______________

VPS IP:           _______________
VPS SSH User:     _______________
VPS SSH Port:     22

DB Name:          smmpanel
DB User:          smmuser
DB Password:      _______________
DB Host:          localhost:5432

JWT_SECRET:       (lưu riêng an toàn)
SESSION_SECRET:   (lưu riêng an toàn)
SETUP_KEY:        (xóa sau khi dùng)
CRON_SECRET:      _______________

SePay Partner:    _______________
SePay API Key:    _______________
thesieure.com ID: _______________
thesieure.com Key:_______________
```

---

*Tạo ngày: 14/03/2026 | Stack: Node.js 22 · Express · React · PostgreSQL · pnpm · Nginx · PM2*
