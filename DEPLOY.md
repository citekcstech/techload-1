# 🚀 Hướng dẫn Deploy TechLoad lên Vercel

## Yêu cầu
- Node.js 18+
- Tài khoản [Supabase](https://supabase.com) (miễn phí)
- Tài khoản [Vercel](https://vercel.com) (miễn phí)
- Tài khoản [GitHub](https://github.com)

---

## Bước 1: Cài đặt Supabase

### 1.1 Tạo project Supabase
1. Vào https://supabase.com → **New Project**
2. Đặt tên project, chọn region **Southeast Asia (Singapore)**
3. Đặt database password (lưu lại!) fE8&lD$f8zieKB%6
4. Chờ ~2 phút để project khởi tạo

### 1.2 Chạy Schema SQL
1. Vào **SQL Editor** trong Supabase dashboard
2. Tạo **New Query**
3. Copy toàn bộ nội dung file `supabase/schema.sql` và paste vào
4. Nhấn **Run** (Ctrl+Enter)
5. Kiểm tra không có lỗi


### 1.3 Lấy API Keys
Vào **Settings → API**:
- Copy **Project URL** → đây là `NEXT_PUBLIC_SUPABASE_URL` sb_secret_0-pZLxp8ftVCr5rsDZb8mA_DG8AKs43
- Copy **anon/public key** → đây là `NEXT_PUBLIC_SUPABASE_ANON_KEY` sb_publishable_LoQ9yDhWdsgnFf0H_ekeSA_qIQkV9GO

### 1.4 Cấu hình Auth (quan trọng!)
Vào **Authentication → URL Configuration**:
- **Site URL**: `https://your-app.vercel.app` (điền sau khi có URL Vercel)
- **Redirect URLs**: thêm các URL sau:
  - `https://your-app.vercel.app/**`
  - `https://your-app.vercel.app/reset-password` ← bắt buộc để tính năng **đặt lại mật khẩu** hoạt động

> **Lưu ý:** Nếu thiếu URL `/reset-password` trong Redirect URLs, link đặt lại mật khẩu gửi qua email sẽ bị Supabase chặn và người dùng không thể đổi mật khẩu.

---

## Bước 2: Đưa code lên GitHub

```bash
# Trong thư mục techload/
git init
git add .
git commit -m "Initial commit: TechLoad app"

# Tạo repo mới trên GitHub rồi:
git remote add origin https://github.com/your-username/techload.git
git branch -M main
git push -u origin main
```

---

## Bước 3: Deploy lên Vercel

### 3.1 Import project
1. Vào https://vercel.com → **Add New Project**
2. Chọn **Import Git Repository** → chọn repo `techload`
3. Framework: **Next.js** (tự detect)

### 3.2 Thêm Environment Variables
Trong bước Configure Project, thêm:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` |

### 3.3 Deploy
Nhấn **Deploy** và chờ ~2 phút

### 3.4 Cập nhật Supabase URL
Sau khi có URL Vercel (VD: `https://techload-abc123.vercel.app`):
- Quay lại Supabase → **Authentication → URL Configuration**
- Cập nhật **Site URL**: `https://techload-abc123.vercel.app`
- Cập nhật **Redirect URLs**, thêm:
  - `https://techload-abc123.vercel.app/**`
  - `https://techload-abc123.vercel.app/reset-password`

---

## Bước 4: Sử dụng lần đầu

### 4.1 Tạo tài khoản đầu tiên
1. Vào URL app của bạn
2. Click **Đăng ký**
3. Nhập thông tin, chọn role

### 4.2 Thiết lập ban đầu (khuyến nghị thứ tự)
1. **Tạo Team**: Vào Teams → Tạo team mới
2. **Thêm thành viên**: Invite các thành viên đăng ký tài khoản trước, rồi add vào team
3. **Tạo Dự án**: Vào Dự án → Thêm dự án gắn với team
4. **Khai báo Estimate Params**: Vào Estimate Params → Định nghĩa các loại task
5. **Tạo Tasks**: Vào Tasks → Tạo task, assign cho thành viên

---

## Cấu trúc phân quyền

| Role | Quyền |
|------|-------|
| **Tư vấn nghiệp vụ** | Tạo task, xem overload theo dự án, đề xuất deadline, chỉnh estimate |
| **Technical** | Xem task được assign, cập nhật trạng thái, re-estimate, re-open |
| **Lead Technical** | Tất cả quyền trên + xem toàn bộ tải trọng team, đề xuất assignee |

---

## Development local

```bash
# Cài dependencies
npm install

# Copy env
cp .env.example .env.local
# Điền NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY

# Chạy dev server
npm run dev
# → http://localhost:3000
```

---

## Troubleshooting

### Lỗi "Invalid JWT" hoặc không login được
- Kiểm tra lại Supabase URL và Anon Key trong Vercel env vars
- Redeploy sau khi thay đổi env vars

### Lỗi không tạo được profile sau khi đăng ký
- Kiểm tra trigger `on_auth_user_created` đã được tạo chưa trong Supabase
- Chạy lại SQL: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`

### Redirect loop (loop login)
- Kiểm tra Supabase Auth Redirect URLs đã thêm domain Vercel chưa

### Lỗi RLS "new row violates row-level security"
- Đảm bảo đã chạy đầy đủ phần `RLS Policies` trong schema.sql

---

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Database + Auth**: Supabase (PostgreSQL)
- **Deploy**: Vercel
- **Icons**: Lucide React
- **Date**: date-fns
