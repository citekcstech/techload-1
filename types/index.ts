export type Role = 'consultant' | 'technical' | 'lead_technical';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'reopened';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type ProjectStatus = 'active' | 'completed' | 'on_hold';

export const ROLE_LABELS: Record<Role, string> = {
  consultant: 'Tư vấn nghiệp vụ',
  technical: 'Technical',
  lead_technical: 'Lead Technical',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Chờ xử lý',
  in_progress: 'Đang làm',
  completed: 'Hoàn thành',
  reopened: 'Mở lại',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Khẩn cấp',
};

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
  estimated_hours: number;
  actual_hours?: number;
  deadline: string;
  completed_at?: string;
  estimate_param_id?: string;
  created_at: string;
  updated_at: string;
  project?: Project;
  assignee?: Profile;
  creator?: Profile;
  estimate_param?: EstimateParam;
  task_reopens?: TaskReopen[];
}

export interface TaskReopen {
  id: string;
  task_id: string;
  reopened_by: string;
  additional_hours: number;
  reason: string;
  created_at: string;
  profile?: Profile;
}

export interface WorkloadMember {
  userId: string;
  userName: string;
  email: string;
  workingHoursPerDay: number;
  activeTasks: Task[];
  totalEstimatedHours: number;
  availableHoursUntil: (deadline: Date) => number;
  overloadRatio: (deadline: Date) => number; // >1 = overloaded
}
