# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ngôn ngữ

Luôn trả lời bằng **tiếng Việt**, bao gồm giải thích, hướng dẫn, nhận xét code và mọi nội dung giao tiếp với người dùng.

## Commands

```bash
npm run dev      # Start development server (port 3000)
npm run build    # Production build
npm run lint     # Run ESLint
npm start        # Start production server
```

There are no test commands configured.

## Environment Setup

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

## Architecture

**TechLoad** is a Next.js 14 (App Router) workload management system for technical teams. Users belong to Teams, manage Projects, and create Tasks with estimated hours. The core value is workload calculation — determining if team members are overloaded and auto-suggesting assignees/deadlines.

### Tech Stack

- **Frontend:** React 18 + TypeScript + Tailwind CSS + Lucide React
- **Backend/DB:** Supabase (PostgreSQL with RLS)
- **Charts:** Recharts
- **Path alias:** `@/*` → project root

### Route Groups

```
app/
  (auth)/        # Public: /login, /register
  (dashboard)/   # Protected: /dashboard, /teams, /projects, /tasks, /estimate-params, /settings
  tasks/[id]/    # Task detail page
```

`middleware.ts` redirects unauthenticated users to `/login` and authenticated users away from auth pages.

### Auth & Session

`hooks/useAuth.tsx` — `AuthProvider` context wraps the app and exposes:
- `user` — Supabase auth user
- `profile` — DB profile with `roles[]` and `active_role`
- `activeRole` — currently selected role (`consultant | technical | lead_technical`)
- `switchRole()`, `refreshProfile()`, `signOut()`

Role determines UI access: `technical` users only see their own assigned tasks; `consultant` and `lead_technical` see all tasks and can reassign.

### Supabase Clients

- `lib/supabase/client.ts` — browser client (use in client components)
- `lib/supabase/server.ts` — server-side client (use in middleware and server actions)

### Workload Engine

`lib/utils/workload.ts` is the core business logic:

| Function | Purpose |
|---|---|
| `getWorkingDays(start, end)` | Count Mon–Fri working days between dates |
| `getActiveHoursForUser(tasks)` | Sum estimated hours for `pending/in_progress/reopened` tasks |
| `buildWorkloadMembers(members, tasks)` | Build `WorkloadMember[]` with capacity calculations |
| `suggestDeadline(member, hours)` | Recommend deadline based on available capacity |
| `suggestAssignees(members, hours)` | Return members sorted by lowest overload ratio |
| `overloadColor/overloadBg(ratio)` | Green < 0.8, orange 0.8–1, red ≥ 1 |

### Core Types (`types/index.ts`)

Key entities and their relationships:

- `Team` → has many `TeamMember` (with `working_hours_per_day`) and `Project`
- `Project` → belongs to `Team`, has many `Task`
- `Task` → belongs to `Project`, assigned to `Profile`, has status/priority/estimated_hours/deadline
- `EstimateParam` — reusable hour templates (name → estimated_hours)
- `WorkloadMember` — computed view combining `TeamMember` + active tasks; has `availableHoursUntil(date)` and `overloadRatio()` methods

Enums: `Role`, `TaskStatus` (`pending|in_progress|completed|reopened`), `TaskPriority` (`low|medium|high|critical`), `ProjectStatus` (`active|completed|on_hold`)

### Database

Schema lives in `supabase/schema.sql`. Row-Level Security (RLS) policies enforce team-scoped access — users only see data belonging to their teams. The `profiles` table extends Supabase's `auth.users`.

### Phân quyền theo Role

| Role | Quyền |
|---|---|
| `consultant` (Tư vấn nghiệp vụ) | Xem task và báo cáo — **không** có quyền tạo task, chỉnh task, hoặc hủy task |
| `technical` | Xem task được assign, cập nhật trạng thái, re-estimate, re-open |
| `lead_technical` | Xem toàn bộ tải trọng team, đề xuất assignee tối ưu |
| Tất cả | Đăng ký, đăng nhập, đổi mật khẩu, switch role |

### UI Conventions

- Sidebar layout (collapsible on mobile) defined in the dashboard layout
- Global utility classes in `app/globals.css`: `.btn-primary`, `.input`, `.card`
- Loading states use inline spinner animations; errors use red-50 background divs
- Custom brand colors defined in `tailwind.config.js`

## Tiêu chuẩn code

### TypeScript
- Không dùng `any` — khai báo type rõ ràng (ngoại trừ `middleware.ts` đã có `@ts-nocheck`)
- Định nghĩa type/interface trong `types/index.ts`, không inline trong component
- Dùng `type` cho union/intersection, `interface` cho object shape

### Component & React
- Mọi component tương tác với DOM/state/hooks phải có `'use client'` ở đầu file
- Dùng `lib/supabase/client.ts` trong client component, `lib/supabase/server.ts` trong middleware/server
- Form: dùng `useState` cho loading/error, không dùng form library
- Phân quyền UI: lấy `activeRole` từ `useAuth()` để ẩn/hiện chức năng theo role

### Supabase queries
- Viết query trực tiếp trong component/page, không tạo repository layer riêng
- Luôn handle lỗi: `if (error) { setError(error.message); return; }`
- Sau insert/update: gọi lại fetch để refresh state (không dùng optimistic update)

### Naming
- File & folder: `kebab-case` (`estimate-params/page.tsx`)
- Component / Type / Interface: `PascalCase`
- Function / variable: `camelCase`

### Styling
- Dùng Tailwind utility class; không viết CSS thuần ngoài `app/globals.css`
- Tái sử dụng các class global: `.btn-primary`, `.input`, `.card`
- Màu overload: dùng helper `overloadColor()` / `overloadBg()` từ `lib/utils/workload.ts`

---

## Quy tắc phản hồi & tối ưu

### Tối ưu token
- Trả lời đúng trọng tâm, không giải thích thừa
- Dùng bullet point cho danh sách, code block cho code/command
- Khi sửa code: chỉ hiển thị phần thay đổi, không paste lại toàn bộ file
- Không lặp lại nội dung đã có trong CLAUDE.md

### Độ chính xác
- Đọc file thực tế trước khi nhận xét (không đoán cấu trúc)
- Kiểm tra `types/index.ts` trước khi thêm field mới vào entity
- Kiểm tra `supabase/schema.sql` trước khi viết query ảnh hưởng đến RLS

### Quản lý context window
- Khi context đạt **~75%**: chạy `/compact` để giữ summary thay vì mất nội dung
- Khi compact: ưu tiên giữ — task đang làm dở, file đang edit, lỗi chưa xử lý xong
- Sau compact: tóm tắt 1 dòng "Đã compact — đang tiếp tục: [tên task]"
- Không đọc lại file đã đọc trong cùng conversation trừ khi file đó đã bị chỉnh sửa

---

## Các lỗi đã gặp & cách xử lý

### Build fail: TypeScript implicit any

**File:** `lib/supabase/server.ts` và `middleware.ts`

```
Type error: Parameter 'cookiesToSet' implicitly has an 'any' type.
```

Fix cho `server.ts` — thêm type annotation:

```typescript
type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };
setAll(cookiesToSet: CookieToSet[]) { ... }
```

Fix cho `middleware.ts` — thêm `// @ts-nocheck` vào dòng đầu file.

### Login xong không redirect (stuck "Đang đăng nhập...")

**Nguyên nhân:** `router.push()` không hoạt động đúng sau Supabase auth.

**Fix** trong `app/(auth)/login/page.tsx`:

```typescript
// Thay router.push('/dashboard') bằng:
window.location.href = '/dashboard';
```

### Supabase Auth URL chưa cấu hình

Sau khi deploy Vercel, vào **Supabase → Authentication → URL Configuration** và thêm domain Vercel vào:
- **Site URL**
- **Redirect URLs** (dạng `https://<domain>/**`)

### Đăng nhập thất bại sau khi đăng ký

**Nguyên nhân:** Supabase mặc định yêu cầu xác nhận email.

**Fix:** Supabase → Authentication → Providers → Email → Tắt **"Confirm email"** → Save.
