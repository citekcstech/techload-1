export type Role = 'consultant' | 'technical' | 'lead_technical';
export type ReopenRootCause = 'missing_requirement' | 'technical_bug' | 'scope_change' | 'external_dependency' | 'estimate_error' | 'other';
export type TaskStatus = 'backlog' | 'pending' | 'in_progress' | 'blocked' | 'ready_for_review' | 'completed' | 'reopened' | 'cancelled';
export type CommentType = 'note' | 'question' | 'decision' | 'blocker_update';
export type NotificationType = 'assigned' | 'near_deadline' | 'overdue' | 'blocked' | 'reopened' | 'review_needed' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ProjectStatus = 'active' | 'completed' | 'on_hold';
export type RequestType = 'new_feature' | 'bug' | 'improvement' | 'consultation' | 'other';
export type TaskSource = 'client' | 'internal' | 'qa' | 'support' | 'other';

export const ROOT_CAUSE_LABELS: Record<ReopenRootCause, string> = {
  missing_requirement:  'Thiếu / sai requirement',
  technical_bug:        'Lỗi kỹ thuật',
  scope_change:         'Đổi scope',
  external_dependency:  'Phụ thuộc bên ngoài',
  estimate_error:       'Estimate sai',
  other:                'Khác',
};

export const ROLE_LABELS: Record<Role, string> = {
  consultant: 'Tư vấn nghiệp vụ',
  technical: 'Technical',
  lead_technical: 'Lead Technical',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  pending: 'Chờ xử lý',
  in_progress: 'Đang làm',
  blocked: 'Bị chặn',
  ready_for_review: 'Chờ review',
  completed: 'Hoàn thành',
  reopened: 'Mở lại',
  cancelled: 'Đã hủy',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Khẩn cấp',
};

export const SEVERITY_LABELS: Record<TaskSeverity, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Nghiêm trọng',
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  new_feature: 'Tính năng mới',
  bug: 'Bug',
  improvement: 'Cải tiến',
  consultation: 'Tư vấn',
  other: 'Khác',
};

export const SOURCE_LABELS: Record<TaskSource, string> = {
  client: 'Khách hàng',
  internal: 'Nội bộ',
  qa: 'QA',
  support: 'Support',
  other: 'Khác',
};

export const COMMENT_TYPE_LABELS: Record<CommentType, string> = {
  note: 'Ghi chú',
  question: 'Câu hỏi',
  decision: 'Quyết định',
  blocker_update: 'Cập nhật blocker',
};

export const COMMENT_TYPE_COLORS: Record<CommentType, string> = {
  note: 'bg-gray-100 text-gray-700',
  question: 'bg-blue-100 text-blue-700',
  decision: 'bg-green-100 text-green-700',
  blocker_update: 'bg-red-100 text-red-700',
};

// Thứ tự ưu tiên thực hiện (số nhỏ = làm trước)
export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const STATUS_ORDER: Record<TaskStatus, number> = {
  blocked: -2,
  backlog: -1,
  in_progress: 0,
  reopened: 1,
  pending: 2,
  ready_for_review: 3,
  completed: 99,
  cancelled: 100,
};

// Chuyển trạng thái hợp lệ
export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  backlog:          ['pending', 'cancelled'],
  pending:          ['in_progress', 'blocked', 'cancelled'],
  in_progress:      ['blocked', 'ready_for_review', 'completed'],
  blocked:          ['in_progress', 'cancelled'],
  ready_for_review: ['completed', 'reopened'],
  completed:        [],
  reopened:         ['in_progress', 'blocked'],
  cancelled:        [],
};

// Hệ số dự phòng 20% cho task chưa hoàn thành
export const BUFFER_FACTOR = 1.2;

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  roles: Role[];
  active_role: Role;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  working_hours_per_day: number;
  created_at: string;
  profile?: Profile;
  team?: Team;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  team_id: string;
  status: ProjectStatus;
  start_date?: string;
  end_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  team?: Team;
}

export interface EstimateParam {
  id: string;
  name: string;
  description?: string;
  estimated_hours: number;
  team_id: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  team?: Team;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  project_id: string;
  assignee_id?: string;
  created_by: string;
  status: TaskStatus;
  priority: TaskPriority;
  severity?: TaskSeverity;
  request_type?: RequestType;
  module?: string;
  source?: TaskSource;
  requester?: string;
  business_impact?: string;
  acceptance_criteria?: string;
  estimated_hours: number;
  actual_hours?: number;
  deadline: string;
  blocked_reason?: string;
  blocked_owner?: string;
  blocked_follow_up_date?: string;
  cancelled_reason?: string;
  baseline_estimated_hours?: number;
  completion_note?: string;
  completed_by?: string;
  completed_at?: string;
  projected_completion?: string;
  estimate_param_id?: string;
  created_at: string;
  updated_at: string;
  project?: Project;
  assignee?: Profile;
  creator?: Profile;
  completed_by_profile?: Profile;
  estimate_param?: EstimateParam;
  task_reopens?: TaskReopen[];
  task_work_logs?: TaskWorkLog[];
  task_estimate_logs?: TaskEstimateLog[];
  subtasks?: Subtask[];
  task_comments?: TaskComment[];
}

export interface TaskWorkLog {
  id: string;
  task_id: string;
  user_id?: string;
  work_date: string;
  hours: number;
  note?: string;
  created_at: string;
  profile?: Profile;
}

export interface TaskEstimateLog {
  id: string;
  task_id: string;
  changed_by?: string;
  old_estimated_hours?: number;
  new_estimated_hours?: number;
  old_deadline?: string;
  new_deadline?: string;
  reason?: string;
  is_scope_change: boolean;
  created_at: string;
  profile?: Profile;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  assignee_id?: string;
  estimated_hours?: number;
  sort_order: number;
  created_by?: string;
  created_at: string;
  assignee?: Profile;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id?: string;
  type: CommentType;
  body: string;
  created_at: string;
  profile?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  task_id?: string;
  type: NotificationType;
  message: string;
  read: boolean;
  created_at: string;
  task?: { id: string; title: string };
}

export interface TaskReopen {
  id: string;
  task_id: string;
  reopened_by: string;
  additional_hours: number;
  reason: string;
  root_cause?: ReopenRootCause;
  created_at: string;
  profile?: Profile;
}

// Kết quả mô phỏng lịch tuần tự cho 1 task
export interface ScheduledTask {
  taskId: string;
  projectedStart: string;       // ISO
  projectedCompletion: string;  // ISO
  willMissDeadline: boolean;
}

export interface WorkloadMember {
  userId: string;
  userName: string;
  email: string;
  workingHoursPerDay: number;
  activeTasks: Task[];
  totalEstimatedHours: number;
  schedule: ScheduledTask[];
  hasOverdue: boolean; // có ≥1 task trễ deadline theo lịch dự kiến
  availableHoursUntil: (deadline: Date) => number;
  overloadRatio: (deadline: Date) => number; // >1 = overloaded
}
