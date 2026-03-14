# SMM Panel Pro — Hướng dẫn cài đặt cPanel

## Yêu cầu
- cPanel hosting với PHP 8.1+ và PDO_PGSQL extension
- PostgreSQL database (Neon.tech miễn phí hoặc elephant.tech)
- mod_rewrite Apache (bật sẵn trên hầu hết cPanel)

---

## Bước 1 — Tạo Database PostgreSQL

1. Đăng ký Neon.tech (miễn phí): https://neon.tech
2. Tạo project mới → lấy connection string (DATABASE_URL)
3. Trong Neon SQL Editor, chạy toàn bộ nội dung file **SETUP_DATABASE.sql**

---

## Bước 2 — Upload files lên cPanel

1. Giải nén `smm-panel-cpanel.zip`
2. Vào cPanel → File Manager → `public_html/`
3. Upload tất cả file & thư mục bên trong zip vào `public_html/`
4. Đảm bảo cấu trúc thư mục:
   ```
   public_html/
   ├── .htaccess          ← BẮT BUỘC
   ├── index.html         ← React SPA
   ├── assets/            ← JS/CSS build
   ├── api/
   │   ├── index.php      ← PHP Router
   │   ├── helpers/
   │   └── routes/
   └── .env               ← Tạo từ .env.example
   ```

---

## Bước 3 — Cấu hình .env

1. Rename `.env.example` thành `.env`
2. Điền thông tin:
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
   JWT_SECRET=chuoi-ngau-nhien-it-nhat-64-ky-tu
   SITE_URL=https://vietool.cc
   ```
3. **QUAN TRỌNG**: Đặt `.env` vào `public_html/` hoặc thư mục cha (`/home/username/.env`)

---

## Bước 4 — Kiểm tra

Mở trình duyệt → `https://vietool.cc/api/health`
Phải trả về: `{"status":"ok","version":"...","time":"..."}`

Nếu lỗi:
- Kiểm tra PHP version: `https://vietool.cc/api/health` → xem error
- Kiểm tra `.htaccess` đã upload chưa (chú ý file ẩn)
- Kiểm tra mod_rewrite: cPanel → Software → MultiPHP INI Editor

---

## Bước 5 — Tạo tài khoản Admin

```bash
# Gọi API tạo admin đầu tiên (thay bằng domain và SETUP_KEY của bạn)
curl -X POST https://vietool.cc/api/auth/make-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vietool.cc","setupKey":"KEY_TRONG_ENV"}'
```

Hoặc trực tiếp trong database:
```sql
UPDATE users SET role = 'admin' WHERE email = 'email@cua-ban.com';
```

---

## Bước 6 — Cấu hình trong Admin Panel

Đăng nhập → `/admin/settings`:
- **SePay**: Webhook URL = `https://vietool.cc/api/webhook/sepay`
- **Thẻ cào**: URL Callback = `https://vietool.cc/api/wallet/cards/callback`
- **Telegram**: Bot Token + Chat ID
- **Tỷ giá VND**: mặc định 24,000 VND/USD

---

## Cron Jobs (cPanel → Cron Jobs)

Thêm 2 cron jobs:
```
# Sync đơn hàng với provider — mỗi 5 phút
*/5 * * * * curl -s "https://vietool.cc/api/cron/update-orders?secret=CRON_SECRET" > /dev/null

# Đồng bộ dịch vụ — mỗi ngày lúc 3 giờ sáng
0 3 * * * curl -s "https://vietool.cc/api/cron/sync-all?secret=CRON_SECRET" > /dev/null
```

Thay `CRON_SECRET` bằng giá trị `CRON_SECRET` trong `.env`

---

## Tài khoản mặc định (sau khi chạy SETUP_DATABASE.sql)

| Role  | Email               | Mật khẩu |
|-------|---------------------|-----------|
| Admin | admin@smmpanel.com  | password  |
| User  | demo@smmpanel.com   | password  |

**⚠️ Đổi mật khẩu ngay sau khi đăng nhập!**
