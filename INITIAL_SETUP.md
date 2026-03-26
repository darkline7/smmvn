# 🔐 INITIAL SETUP GUIDE

## Step 1: Database Setup
Hệ thống sẽ tự động tạo database tables khi khởi động lần đầu.

```bash
# Tạo database
createdb smm_panel

# Chạy migrations
cd artifacts/api-server
pnpm run dev
```

## Step 2: Create Admin Account
Khi API khởi động, hệ thống **KHÔNG THỂ** tự động tạo admin account.

**Bạn PHẢI tạo admin thủ công bằng đây:**

### Option A: Sử dụng SQL trực tiếp
```bash
psql -U postgres -d smm_panel
```

```sql
-- Tạo hash password (generated on first signup)
-- Sử dụng bcrypt tool hoặc:
-- $ node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YourSecurePassword', 12))"

INSERT INTO users (email, username, password_hash, role, currency, api_key, referral_code, email_verified)
VALUES (
  'admin@yourdomain.com',
  'admin_username',
  '$2b$12$...',  -- Replace with bcrypt hash
  'admin',
  'USD',
  'your_api_key_here',
  'ADMIN',
  true
);
```

### Option B: API Endpoint (sau này)
Thêm POST /api/admin/setup endpoint nếu muốn UI setup wizard.

## Step 3: Update Security Settings
Sau khi login vào admin panel:

1. **Đổi mật khẩu admin** (/admin/settings)
2. **Set JWT_SECRET** trong .env (phải 64 chars)
3. **Set CRON_SECRET** để kiểm soát cron jobs
4. **Cấu hình payment providers**
5. **Cấu hình SMTP/Telegram cho notifications**

## ⚠️ IMPORTANT: Never commit .env files!

```bash
# Verify these are in .gitignore:
.env
.env.local
.env.*.local
artifacts/**/.env
.replit
```

## Production Checklist
- [ ] Generate new JWT_SECRET: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- [ ] Set strong database password
- [ ] Enable HTTPS/SSL
- [ ] Set CSP headers properly
- [ ] Configure rate limiting
- [ ] Enable audit logging
- [ ] Set up backups
- [ ] Monitor error logs
