# HƯỚNG DẪN DEPLOY SMM PANEL LÊN CPANEL

> **File backup SQL:** `snuynbkn_smm_backup_20260314.sql`
> **Kích thước:** 25MB | **Số bảng:** 57 | **Database engine:** MariaDB 10.11 / InnoDB / utf8mb4

---

## YÊU CẦU HOSTING CPANEL

Trước khi bắt đầu, hosting cần có:

- **PHP 8.1 hoặc 8.2** (khuyến nghị 8.2)
- **MySQL 8.0** hoặc **MariaDB 10.6+**
- **PHP Extensions:** PDO, PDO_MySQL, cURL, GD, mbstring, zip, openssl, fileinfo, intl
- **RAM tối thiểu:** 512MB (khuyến nghị 1GB+)
- **Disk:** Tối thiểu 500MB trống
- **SSL Certificate** (Let's Encrypt miễn phí qua cPanel)

---

## BƯỚC 1 — TẠO DATABASE MYSQL TRÊN CPANEL

### 1.1 Tạo Database mới

1. Đăng nhập cPanel → **MySQL Databases**
2. Trong mục **Create New Database**, nhập tên:
   ```
   snuynbkn_smm
   ```
   *(Lưu ý: cPanel tự thêm prefix username, ví dụ: `tenban_snuynbkn_smm`)*
3. Nhấn **Create Database**

### 1.2 Tạo MySQL User

1. Trong mục **MySQL Users → Add New User**:
   - **Username:** `smm_user` *(hoặc tên tùy chọn)*
   - **Password:** Tạo mật khẩu mạnh, **lưu lại ngay**
2. Nhấn **Create User**

### 1.3 Gán quyền User vào Database

1. Mục **Add User to Database**:
   - Chọn user vừa tạo + database vừa tạo
2. Nhấn **Add**
3. Màn hình tiếp theo → chọn **ALL PRIVILEGES** → **Make Changes**

---

## BƯỚC 2 — IMPORT SQL BACKUP

### Cách 1: phpMyAdmin (file < 50MB — Khuyến nghị)

1. cPanel → **phpMyAdmin**
2. Click vào database vừa tạo (cột trái)
3. Click tab **Import** (thanh menu trên)
4. Nhấn **Choose File** → chọn file `snuynbkn_smm_backup_20260314.sql`
5. Kiểm tra các tùy chọn:
   - **Format:** SQL
   - **Character set:** utf8mb4
   - **Partial import:** Bỏ chọn
6. Cuộn xuống cuối → nhấn **Go**
7. Chờ vài phút, báo thành công **"Import has been successfully finished"**

### Cách 2: SSH Command Line (file lớn, nhanh hơn)

```bash
# SSH vào server
ssh username@yourdomain.com

# Import SQL
mysql -u tenban_smm_user -p tenban_snuynbkn_smm < /path/to/snuynbkn_smm_backup_20260314.sql

# Nhập password khi được hỏi
```

### Cách 3: Chia nhỏ file nếu bị giới hạn dung lượng

```bash
# Trên máy local, chia file
split -l 5000 snuynbkn_smm_backup_20260314.sql part_
# Tạo ra: part_aa, part_ab, part_ac...

# Import từng phần qua SSH
for f in part_*; do mysql -u user -p database < "$f"; done
```

---

## BƯỚC 3 — UPLOAD SOURCE CODE

### 3.1 Qua File Manager (cPanel)

1. cPanel → **File Manager**
2. Điều hướng đến **public_html** (hoặc thư mục subdomain)
3. Nhấn **Upload** → tải lên file ZIP source code
4. Sau khi upload → **Extract** file ZIP

### 3.2 Qua FTP (Filezilla — Khuyến nghị cho file lớn)

1. Mở FileZilla
2. Thông tin kết nối:
   ```
   Host: ftp.yourdomain.com
   Username: your-cpanel-username
   Password: your-cpanel-password
   Port: 21
   ```
3. Kéo thả toàn bộ folder source code vào `/public_html/`

### 3.3 Cấu trúc thư mục sau khi upload

```
public_html/
├── index.php              ← File chính
├── .htaccess              ← URL rewrite rules
├── config/
│   └── database.php       ← Cấu hình DB ở đây
├── uploads/               ← Thư mục upload (cần chmod 755)
├── assets/
├── admin/
└── ...
```

---

## BƯỚC 4 — CẤU HÌNH DATABASE

Tìm file config database trong source code (thường là `config/database.php`, `config.php`, hoặc `.env`):

### Nếu dùng file `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=tenban_snuynbkn_smm
DB_USERNAME=tenban_smm_user
DB_PASSWORD=MatKhauDaTao
DB_CHARSET=utf8mb4

# URL Website
APP_URL=https://yourdomain.com
APP_ENV=production
APP_DEBUG=false

# Secret key (tạo ngẫu nhiên 32+ ký tự)
APP_KEY=base64:XXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### Nếu dùng file `config/database.php`:

```php
<?php
return [
    'host'     => 'localhost',
    'database' => 'tenban_snuynbkn_smm',
    'username' => 'tenban_smm_user',
    'password' => 'MatKhauDaTao',
    'charset'  => 'utf8mb4',
    'port'     => 3306,
];
```

> **Lưu ý quan trọng:** Tên database và username trên cPanel luôn có **prefix** là tên tài khoản cPanel. Ví dụ nếu tài khoản cPanel là `snuynbkn`, thì:
> - Database: `snuynbkn_smm` (không phải chỉ `smm`)
> - User: `snuynbkn_user` (không phải chỉ `user`)

---

## BƯỚC 5 — CẤU HÌNH FILE .HTACCESS

Tạo hoặc kiểm tra file `.htaccess` trong `public_html/`:

```apache
Options -Indexes
Options +FollowSymLinks

RewriteEngine On

# Chuyển hướng HTTP → HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# URL rewrite (cho Laravel/CodeIgniter/v.v.)
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php/$1 [L]

# Bảo vệ file nhạy cảm
<FilesMatch "(^\.env|config\.php|database\.php)">
    Order Allow,Deny
    Deny from all
</FilesMatch>

# Cache tĩnh
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
</IfModule>

# Giới hạn upload
php_value upload_max_filesize 64M
php_value post_max_size 64M
php_value max_execution_time 300
php_value memory_limit 256M
```

---

## BƯỚC 6 — CÀI ĐẶT QUYỀN FILE (CHMOD)

### Qua File Manager cPanel:

1. Chọn thư mục `uploads/` → **Permissions** → `755`
2. Chọn thư mục `storage/` (nếu có) → `755`
3. Chọn file `.env` → `600` (chỉ owner đọc được)
4. Chọn file `config/database.php` → `600`

### Qua SSH:

```bash
# Cấp quyền thư mục
find /home/tenban/public_html -type d -exec chmod 755 {} \;

# Cấp quyền file
find /home/tenban/public_html -type f -exec chmod 644 {} \;

# Thư mục cần ghi
chmod 755 /home/tenban/public_html/uploads
chmod 755 /home/tenban/public_html/storage
chmod 755 /home/tenban/public_html/cache

# Bảo mật file config
chmod 600 /home/tenban/public_html/.env
chmod 600 /home/tenban/public_html/config/database.php
```

---

## BƯỚC 7 — CẤU HÌNH SSL (HTTPS)

1. cPanel → **SSL/TLS** → **Let's Encrypt SSL**
2. Chọn domain muốn cài SSL → **Issue**
3. Chờ 2-3 phút → SSL được cài tự động
4. Kiểm tra tại `https://yourdomain.com`

---

## BƯỚC 8 — CẤU HÌNH SUBDOMAIN (Nếu cần)

Nếu muốn chạy trên subdomain (ví dụ: `smm.yourdomain.com`):

1. cPanel → **Subdomains**
2. **Subdomain:** `smm`
3. **Domain:** chọn domain chính
4. **Document Root:** `/public_html/smm` (tự động điền)
5. Nhấn **Create**
6. Upload source code vào `/public_html/smm/`
7. Cài SSL cho subdomain tương tự Bước 7

---

## BƯỚC 9 — CẤU HÌNH CRON JOB

SMM Panel thường cần cron job để xử lý đơn hàng tự động:

1. cPanel → **Cron Jobs**
2. Thêm các cron job sau:

```bash
# Sync đơn hàng mỗi 5 phút
*/5 * * * * php /home/tenban/public_html/cron/sync_orders.php

# Xử lý thanh toán mỗi phút
* * * * * php /home/tenban/public_html/cron/process_payments.php

# Dọn dẹp session cũ mỗi ngày
0 0 * * * php /home/tenban/public_html/cron/cleanup_sessions.php

# Kiểm tra balance đơn hàng mỗi 10 phút
*/10 * * * * php /home/tenban/public_html/cron/check_orders.php
```

> **Lưu ý:** Đường dẫn thực tế tùy theo cấu trúc source code, kiểm tra thư mục `cron/` hoặc `jobs/` trong source.

---

## BƯỚC 10 — CẬP NHẬT CÀI ĐẶT TRONG DATABASE

Sau khi import SQL xong, cập nhật URL và cài đặt chính:

```sql
-- Cập nhật URL website trong bảng settings
UPDATE settings SET value = 'https://yourdomain.com' WHERE name = 'site_url';
UPDATE settings SET value = 'https://yourdomain.com' WHERE name = 'app_url';

-- Kiểm tra các cài đặt thanh toán
SELECT name, value FROM settings WHERE name LIKE '%url%' OR name LIKE '%domain%';
```

Thực hiện qua **phpMyAdmin → database → SQL tab**.

---

## KIỂM TRA SAU KHI DEPLOY

Truy cập các URL sau để kiểm tra:

| URL | Mục đích |
|-----|----------|
| `https://yourdomain.com` | Trang chủ user |
| `https://yourdomain.com/admin` | Trang quản trị |
| `https://yourdomain.com/login` | Đăng nhập |
| `https://yourdomain.com/register` | Đăng ký |

### Checklist sau deploy:

- [ ] Trang chủ hiển thị bình thường
- [ ] Đăng nhập admin được
- [ ] Thanh toán test hoạt động
- [ ] Cron job chạy (kiểm tra logs)
- [ ] SSL hiển thị ổ khóa xanh
- [ ] File `.env` không thể truy cập từ browser

---

## XỬ LÝ LỖI THƯỜNG GẶP

### Lỗi 500 Internal Server Error
```
→ Kiểm tra error log: cPanel → Error Logs
→ Kiểm tra quyền file chmod
→ Kiểm tra cú pháp .htaccess
→ Tắt tạm thời APP_DEBUG=true để xem lỗi chi tiết
```

### Lỗi "Access denied for user"
```
→ Kiểm tra lại tên database/user (có prefix cPanel không?)
→ Kiểm tra password trong config
→ Đảm bảo user đã được gán vào database
```

### Lỗi "Class not found" / Autoload
```
→ Chạy: composer install (nếu có SSH)
→ Hoặc upload thêm thư mục vendor/
```

### Import SQL bị timeout
```
→ Tăng max_execution_time trong .htaccess
→ Dùng phương pháp SSH (Bước 2, Cách 2)
→ Liên hệ hosting tăng giới hạn import
```

### Website hiển thị thư mục thay vì trang web
```
→ Kiểm tra file index.php có tồn tại không
→ Kiểm tra .htaccess
→ Bật mod_rewrite: cPanel → Apache Handlers
```

---

## THÔNG TIN CẦN GHI LẠI

Sau khi deploy xong, lưu lại các thông tin sau:

```
Domain:        https://_______________
Admin URL:     https://_______________/admin
Admin Email:   _______________
Admin Pass:    _______________

cPanel User:   _______________
cPanel Pass:   _______________
cPanel URL:    https://_______________:2083

DB Name:       _______________
DB User:       _______________
DB Pass:       _______________
DB Host:       localhost

FTP Host:      _______________
FTP User:      _______________
FTP Pass:      _______________
```

---

*Tạo ngày: 14/03/2026 | Database: snuynbkn_smm | MariaDB 10.11 | 57 tables | 25MB*
