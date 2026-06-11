# Cách xoá user khỏi hệ thống

## Cách 1 — Supabase Dashboard UI (đơn giản nhất)

**Authentication → Users** → tìm user → click menu ⋯ → **Delete user**

> Nếu gặp lỗi "Database error loading user", dùng Cách 3.

---

## Cách 2 — Admin API (dùng trong code server-side)

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // KHÔNG dùng public key
)

const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
```

---

## Cách 3 — SQL thủ công (khi Dashboard lỗi)

Chạy trong **Supabase → SQL Editor**. Thay `<user_id>` bằng UUID thực.

```sql
SET ROLE postgres;

DO $$
DECLARE
  uid UUID := '<user_id>';
BEGIN
  DELETE FROM notifications    WHERE user_id = uid;
  DELETE FROM task_work_logs   WHERE user_id = uid;
  DELETE FROM task_comments    WHERE user_id = uid;
  UPDATE subtasks SET created_by  = NULL WHERE created_by  = uid;
  UPDATE subtasks SET assignee_id = NULL WHERE assignee_id = uid;
  DELETE FROM team_members     WHERE user_id = uid;
  DELETE FROM profiles         WHERE id = uid;
  DELETE FROM auth.users       WHERE id = uid;

  RAISE NOTICE 'Đã xoá user %', uid;
END $$;
```

**Tìm user ID theo email:**

```sql
SET ROLE postgres;
SELECT id, email FROM auth.users WHERE email = 'user@example.com';
```

---

## Lưu ý quan trọng

- **Không** chạy `GRANT DELETE ON auth.users TO authenticated` — đây là lỗ hổng bảo mật.
- Cần `SET ROLE postgres;` vì role `authenticated` không có quyền xoá `auth.users`.
- Cascade tự động: xoá `auth.users` → xoá `profiles` → xoá `team_members`, `notifications` theo CASCADE.
- Các field `assignee_id`, `created_by`, `completed_by` trong tasks sẽ tự SET NULL.