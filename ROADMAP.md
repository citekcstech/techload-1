# ROADMAP — Quy trình xây dựng TechLoad

Tài liệu theo dõi các bước phát triển tiếp theo. Cập nhật khi hoàn thành từng mục.

---

## ✅ Đã hoàn thành

- [x] Auth (đăng ký/đăng nhập, switch role, middleware bảo vệ route)
- [x] CRUD Team / Project / EstimateParam / Task
- [x] Workload Engine theo **lịch tuần tự**: 8h/ngày, nghỉ T7/CN, cộng dồn, buffer ×1.2
- [x] Ngày hoàn thành dự kiến (`projected_completion`) — lưu DB, persist sau mọi mutation
- [x] Cảnh báo quá tải khi tạo task (vẫn cho ghi đè)
- [x] Đề xuất assignee/deadline theo lịch
- [x] Thứ tự ưu tiên thực hiện: Priority → Deadline → Status
- [x] Tách task **Hoàn thành** ra section thu gọn riêng

---

## 🔜 Nghiệp vụ cần bổ sung để hoàn thiện quy trình task

### 1. Chuẩn hóa đầu vào task
- Bổ sung trường nghiệp vụ: loại yêu cầu, module/phân hệ, nguồn yêu cầu, requester, business impact, acceptance criteria.
- Tách rõ `priority` và `severity`: priority để xếp lịch, severity để đánh giá mức ảnh hưởng nghiệp vụ.
- Có trạng thái backlog/triage để task mới chưa đủ thông tin không bị đưa thẳng vào hàng xử lý.
- Validate khi tạo task: title, project, deadline, estimate, acceptance criteria tối thiểu.

### 2. Quy trình estimate và scope control
- Lưu estimate gốc (`baseline_estimated_hours`) và estimate hiện tại (`estimated_hours`) để đo sai lệch.
- Mỗi lần re-estimate phải có lý do, người chỉnh, thời điểm chỉnh.
- Thêm bảng `task_estimate_logs` để audit lịch sử thay đổi estimate/deadline.
- Cho phép đánh dấu scope change để phân biệt task bị estimate sai và task phát sinh phạm vi mới.

### 3. Vòng đời status đầy đủ hơn
- Mở rộng status đề xuất:
  - `backlog`: mới ghi nhận/chưa triage
  - `pending`: đã đủ thông tin, chờ xử lý
  - `in_progress`: đang làm
  - `blocked`: bị chặn
  - `ready_for_review`: technical làm xong, chờ review/UAT
  - `completed`: đã được xác nhận hoàn thành
  - `reopened`: mở lại
  - `cancelled`: hủy
- Chặn chuyển status không hợp lệ, ví dụ `completed` không quay lại `pending`, phải qua `reopened`.
- Khi `blocked` phải nhập blocker reason, blocker owner, ngày cần follow-up.
- Khi `cancelled` phải nhập lý do hủy.

### 4. Theo dõi giờ làm thực tế chi tiết
- Hiện đã có `actual_hours`, nhưng nên chuyển sang bảng `task_work_logs`.
- Mỗi log gồm: task, user, work_date, hours, note, created_at.
- `actual_hours` nên là tổng từ work logs hoặc cache được recompute.
- Khi hoàn thành task phải nhập giờ thực tế và completion note.

### 5. Review, nghiệm thu và định nghĩa hoàn thành
- Thêm bước review/UAT trước khi completed nếu task liên quan nghiệp vụ.
- `completed` nên có `completed_by`, `completed_at`, `completion_note`.
- Nếu cần xác nhận từ consultant/requester, thêm `accepted_by`, `accepted_at`.
- Acceptance criteria phải được tick trước khi hoàn thành.

### 6. Re-open và rework rõ ràng
- Re-open phải lưu reason, root cause, additional_hours, reopened_by.
- Phân loại root cause: thiếu requirement, bug kỹ thuật, đổi scope, phụ thuộc ngoài, estimate sai.
- Khi re-open, task quay lại `reopened` hoặc `in_progress` tùy người nhận xử lý.
- Báo cáo tỷ lệ re-open theo project, assignee, root cause.

### 7. Subtask / checklist
- Bảng `subtasks`: title, status/done, assignee_id, estimated_hours, actual_hours.
- Task lớn có thể chia nhỏ để theo dõi tiến độ thật thay vì chỉ dựa vào số giờ.
- % hoàn thành task = checklist/subtask done, kết hợp actual_hours.

### 8. Dependencies và blocker
- Thêm bảng `task_dependencies` thay vì UUID array để query/audit dễ hơn.
- Không cho task phụ thuộc bắt đầu trước khi task cha completed/accepted.
- Cảnh báo circular dependency.
- Dashboard cần hiển thị task bị chặn do dependency hoặc blocker thủ công.

### 9. Assignment và cân bằng tải theo nghiệp vụ
- Trước khi assign, hiển thị preview: ngày hoàn thành dự kiến, task nào bị đẩy trễ.
- Cho phép unassigned backlog để lead/consultant gom task trước khi phân công.
- Khi đổi assignee phải lưu lý do nếu task đang `in_progress` hoặc đã trễ.
- Nút gợi ý assignee nên cân nhắc skill/module sau này, không chỉ capacity.

### 10. Bình luận, quyết định và file đính kèm
- Bảng `task_comments` để ghi trao đổi theo task.
- Phân loại comment: note, question, decision, blocker update.
- Bảng `task_attachments` dùng Supabase Storage cho tài liệu requirement, screenshot, file test.
- Quy định các quyết định quan trọng phải nằm trong comment/audit, không chỉ nằm ngoài chat.

### 11. Thông báo nghiệp vụ
- Notify khi được assign, gần tới deadline, projected completion vượt deadline, bị block, bị re-open, cần review.
- Có notification inbox + badge sidebar.
- Có rule nhắc lại nếu task blocked quá lâu hoặc sắp trễ trong 24/48h.

### 12. Báo cáo vận hành
- Báo cáo cần trước Gantt:
  - task aging: task nằm ở mỗi status bao lâu
  - lead time/cycle time
  - estimate accuracy: actual vs baseline/current estimate
  - utilization theo người/team
  - overdue rate
  - reopen rate/root cause
- Cho phép lọc theo project, team, assignee, priority, status, khoảng ngày.
- Export CSV sau khi các báo cáo chính ổn định.

---

## ⚠️ Nợ kỹ thuật phục vụ nghiệp vụ

- `projected_completion` là **cache** — phải recompute mọi mutation ảnh hưởng hàng đợi assignee. Hiện đã tập trung qua helper `persistSchedule`/`persistScheduleFor` nhưng nếu thêm call site mới phải nhớ gọi.
- Người dùng ở **nhiều team** với `working_hours_per_day` khác nhau → hiện lấy giờ theo team của task đang thao tác (đơn giản hóa). Cần thống nhất khi 1 người gánh task xuyên team.
- Trang chi tiết fetch riêng `assigneeTasks` — cân nhắc gộp query để giảm round-trip.
- Chưa có realtime → 2 người sửa cùng lúc dễ ghi đè. Cân nhắc optimistic lock theo `updated_at`.

---

## 📋 Thứ tự đề xuất triển khai

```
1. Chuẩn hóa đầu vào task + acceptance criteria
2. Vòng đời status đầy đủ: backlog / blocked / review / completed / reopened / cancelled
3. Work logs + completion note + estimate/deadline logs
4. Re-open root cause + báo cáo rework
5. Subtask / checklist
6. Dependencies + blocker
7. Assignment preview + unassigned backlog
8. Comment / decision / attachment
9. Notifications nghiệp vụ
10. Báo cáo vận hành
11. Role / permission / RLS
12. Hiệu năng query, index, realtime tối ưu
```
