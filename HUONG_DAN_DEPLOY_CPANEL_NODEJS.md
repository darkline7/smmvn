# HƯỚNG DẪN DEPLOY SMM PANEL PRO TRÊN CPANEL NODE.JS

> **Phù hợp với:** cPanel có Node.js Selector (như trong ảnh của bạn)  
> **Node.js Version:** 22.18.0 (chọn trong cPanel)  
> **File cần upload:** `smm-panel-cpanel.tar.gz`

---

## ⚠️ QUAN TRỌNG: CẦN DATABASE POSTGRESQL

cPanel thường chỉ có MySQL. Panel này dùng **PostgreSQL** — bạn cần tạo database PostgreSQL **miễn phí** trên Neon.tech:

### Tạo PostgreSQL miễn phí trên Neon.tech (3 phút)

1. Truy cập: **https://neon.tech** → Đăng ký miễn phí (dùng Google/GitHub)
2. Click **Create Project** → Đặt tên: `smm-panel` → **Create**
3. Sao chép **Connection string** dạng:
   ```
   postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
4. **Lưu lại chuỗi này** — sẽ dùng ở bước cấu hình `.env`

> **Thay thế khác:** https://supabase.com (cũng miễn phí, tương tự)

---

## BƯỚC 1 — TẠO ỨNG DỤNG NODE.JS TRONG CPANEL

1. Đăng nhập **cPanel** → tìm **Node.js** (như trong ảnh)
2. Click **CREATE APPLICATION**
3. Điền thông tin:

   | Trường | Giá trị |
   |--------|---------|
   | **Node.js version** | `22.18.0` |
   | **Application mode** | `Production` |
   | **Application root** | `smm-panel` *(cPanel tự tạo thư mục)* |
   | **Application URL** | Chọn domain của bạn (ví dụ: `vietool.cc`) |
   | **Application startup file** | `app.js` |

4. Click **CREATE** → cPanel tạo thư mục tại `/home/user/smm-panel/`

---

## BƯỚC 2 — UPLOAD VÀ GIẢI NÉN FILE

### Qua File Manager cPanel:

1. cPanel → **File Manager**
2. Điều hướng đến thư mục vừa tạo: `/home/user/smm-panel/`
3. Click **Upload** → tải lên file `smm-panel-cpanel.tar.gz`
4. Sau khi upload xong → **Extract** file tại chỗ

### Hoặc qua FTP (FileZilla):
1. Kết nối FTP vào hosting
2. Điều hướng đến `/home/user/smm-panel/`
3. Upload file `.tar.gz` rồi Extract trong File Manager

### Cấu trúc sau khi giải nén:

```
/home/user/smm-panel/
├── app.js              ← Startup file (cPanel chạy file này)
├── package.json        ← Thông tin package
├── .env.example        ← Mẫu cấu hình
└── dist/
    ├── index.cjs       ← Server đã build (1.7MB, tự chứa)
    └── public/         ← Frontend React đã build
        ├── index.html
        └── assets/
```

---

## BƯỚC 3 — TẠO FILE `.ENV`

Trong **File Manager**, vào thư mục `/home/user/smm-panel/`:

1. Click **+ File** → tạo file tên `.env` (có dấu chấm ở đầu)
2. Click chuột phải `.env` → **Edit** → dán nội dung:

```env
# ═══════════════════════════════════════════
# SMM PANEL PRO — CẤU HÌNH (thay các giá trị)
# ═══════════════════════════════════════════

# Database PostgreSQL từ Neon.tech/Supabase
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require

# URL website của bạn
SITE_URL=https://vietool.cc

# JWT Secret — BẮT BUỘC (128 ký tự ngẫu nhiên)
# Tạo tại: https://generate-secret.vercel.app/128
JWT_SECRET=DAN_128_KY_TU_HEX_VAO_DAY

# Session Secret (64 ký tự ngẫu nhiên)
SESSION_SECRET=DAN_64_KY_TU_HEX_VAO_DAY

# Key tạo admin lần đầu (xóa sau khi dùng)
SETUP_KEY=MK_BI_MAT_CUA_BAN

# Salt cho password (32 ký tự bất kỳ)
SECRET_SALT=CHUOI_32_KY_TU_NGAU_NHIEN
```

> **Tạo JWT_SECRET nhanh:** Truy cập https://generate-secret.vercel.app/128

3. Click **Save**
4. Đặt quyền file `.env`: **chuột phải → Change Permissions → 600**

---

## BƯỚC 4 — CẤU HÌNH BIẾN MÔI TRƯỜNG TRONG CPANEL

Ngoài file `.env`, thêm biến trực tiếp vào cPanel để chắc chắn hơn:

1. cPanel → **Node.js** → Click vào app `smm-panel`
2. Kéo xuống phần **Environment variables**
3. Click **ADD VARIABLE** và thêm lần lượt:

   | Variable | Value |
   |----------|-------|
   | `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` |
   | `SITE_URL` | `https://vietool.cc` |
   | `JWT_SECRET` | *(128 ký tự hex)* |
   | `SESSION_SECRET` | *(64 ký tự hex)* |
   | `SETUP_KEY` | *(chuỗi bí mật của bạn)* |
   | `SECRET_SALT` | *(32 ký tự)* |

4. Click **SAVE** sau khi thêm hết

---

## BƯỚC 5 — CÀI NPM PACKAGES

1. cPanel → **Node.js** → Click vào app `smm-panel`
2. Click **Run NPM Install** (cPanel tự chạy `npm install`)
3. Chờ vài giây
4. Hoặc mở **Terminal** trong cPanel và chạy:
   ```bash
   cd ~/smm-panel
   npm install
   ```

---

## BƯỚC 6 — KHỞI ĐỘNG APP

1. cPanel → **Node.js** → Click vào app `smm-panel`
2. Click nút **START** (hoặc **RESTART** nếu đã chạy)
3. Trạng thái phải chuyển thành **Started / Running**

---

## BƯỚC 7 — KIỂM TRA HOẠT ĐỘNG

Mở trình duyệt và truy cập:

```
https://vietool.cc/api/health
```

Nếu thành công sẽ thấy:
```json
{"status": "ok"}
```

Nếu thành công, truy cập trang chủ:
```
https://vietool.cc
```

---

## BƯỚC 8 — TẠO TÀI KHOẢN ADMIN

Khi truy cập lần đầu, database còn trống. Tạo admin:

### Cách 1: Dùng Terminal cPanel

```bash
# Mở Terminal trong cPanel → chạy lệnh:
curl -X POST https://vietool.cc/api/auth/make-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vietool.cc","password":"MatKhauAdmin123@","setupKey":"MK_BI_MAT_CUA_BAN"}'
```

### Cách 2: Dùng máy tính của bạn (Windows/Mac)

Cài **Postman** hoặc dùng PowerShell:
```powershell
Invoke-RestMethod -Uri "https://vietool.cc/api/auth/make-admin" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"admin@vietool.cc","password":"MatKhauAdmin123@","setupKey":"MK_BI_MAT_CUA_BAN"}'
```

**Sau khi tạo admin xong:** Xóa dòng `SETUP_KEY` khỏi `.env` và biến môi trường trong cPanel, rồi **RESTART** app.

---

## BƯỚC 9 — CẤU HÌNH TRONG ADMIN PANEL

Đăng nhập tại: `https://vietool.cc/login`
- Email: `admin@vietool.cc`
- Password: `MatKhauAdmin123@`

Vào **Admin → Settings** và cấu hình:

| Mục | Cài đặt |
|-----|---------|
| **Site URL** | `https://vietool.cc` |
| **VND Exchange Rate** | `25000` |
| **SePay Webhook Secret** | *(lấy từ SePay dashboard)* |
| **Bank Name, Account** | *(thông tin ngân hàng của bạn)* |
| **Card Partner ID/Key** | *(từ thesieure.com)* |
| **Cron Secret** | *(chuỗi ngẫu nhiên để bảo vệ cron API)* |
| **Telegram Bot Token** | *(tùy chọn)* |

Vào **Admin → Providers** → Thêm provider smmgen.com:
- API URL: `https://smmgen.com/api/v2`
- API Key: *(key của bạn trên smmgen.com)*

---

## BƯỚC 10 — THÊM CRON JOB TỰ ĐỘNG

cPanel → **Cron Jobs** → Thêm:

```bash
# Cập nhật đơn hàng mỗi 5 phút
*/5 * * * * curl -s "https://vietool.cc/api/cron/update-orders?secret=CRON_SECRET_CUA_BAN" >/dev/null 2>&1

# Đồng bộ dịch vụ provider mỗi ngày 3 giờ sáng
0 3 * * * curl -s "https://vietool.cc/api/cron/sync-all?secret=CRON_SECRET_CUA_BAN" >/dev/null 2>&1
```

> Thay `CRON_SECRET_CUA_BAN` bằng giá trị đã đặt trong Admin → Settings → Cron Secret

---

## BƯỚC 11 — CẤU HÌNH SEPAY WEBHOOK

Trong SePay dashboard → Webhook URL:
```
https://vietool.cc/api/webhooks/sepay
```

---

## XỬ LÝ LỖI THƯỜNG GẶP

### App hiển thị "Application Error"
```
→ cPanel → Node.js → xem Error logs
→ Kiểm tra DATABASE_URL có đúng không
→ Kiểm tra JWT_SECRET đã đặt chưa
→ Thử RESTART app
```

### Trang trắng hoặc 404
```
→ Kiểm tra file dist/public/index.html có tồn tại không
→ Kiểm tra startup file là app.js
→ Xem log trong cPanel Node.js Manager
```

### Lỗi "Cannot connect to database"
```
→ Kiểm tra DATABASE_URL từ Neon.tech có đúng không
→ Thêm ?sslmode=require vào cuối URL
→ Ping database: psql "CONNECTION_STRING" (trong Terminal)
```

### Lỗi "JWT_SECRET is required"
```
→ Đảm bảo JWT_SECRET đã được set trong cả .env VÀ biến môi trường cPanel
→ JWT_SECRET phải có ít nhất 32 ký tự
```

---

## TỔNG KẾT CÁC BƯỚC CHÍNH

```
1. Tạo PostgreSQL tại neon.tech (miễn phí, 3 phút)
2. cPanel → Node.js → Create Application
   - Node: 22.18.0, Mode: Production, Root: smm-panel, Startup: app.js
3. File Manager → Upload smm-panel-cpanel.tar.gz → Extract
4. Tạo file .env với DATABASE_URL, JWT_SECRET, SITE_URL
5. cPanel Node.js → Add Environment Variables
6. Run NPM Install
7. Click START
8. Kiểm tra: https://vietool.cc/api/health → {"status":"ok"}
9. Tạo admin qua API với SETUP_KEY
10. Đăng nhập admin → cấu hình settings, providers
11. Thêm cron job
```

---

*Tạo ngày: 14/03/2026 | Stack: Node.js 22 · Express · React · PostgreSQL · cPanel Node.js Selector*
