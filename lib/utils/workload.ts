import {
  Task,
  WorkloadMember,
  TeamMember,
  ScheduledTask,
  WeekBucket,
  MemberWeekCell,
  MemberWeekRow,
  WeekSummary,
  PRIORITY_ORDER,
  STATUS_ORDER,
  BUFFER_FACTOR,
} from '@/types';

const ACTIVE_STATUSES = ['pending', 'in_progress', 'reopened'];
const MS_PER_HOUR = 60 * 60 * 1000;
const MAX_WORKING_HOURS_PER_DAY = 8;

// Lịch làm việc: 8:30–12:00 (3.5h) + 13:00–17:30 (4.5h) = 8h/ngày
const WORKDAY_START_HOUR = 8;
const WORKDAY_START_MINUTE = 30;
const WORKDAY_END_HOUR = 17;
const WORKDAY_END_MINUTE = 30;
const LUNCH_START_HOUR = 12;
const LUNCH_END_HOUR = 13;

export function normalizeDailyHours(hours: number): number {
  return Math.max(0, Math.min(hours || 0, MAX_WORKING_HOURS_PER_DAY));
}

/** Count working days (Mon–Fri) between two dates, inclusive. */
export function getWorkingDays(from: Date, to: Date): number {
  let count = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  while (cur <= end) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function workdayStart(d: Date): Date {
  const r = new Date(d);
  r.setHours(WORKDAY_START_HOUR, WORKDAY_START_MINUTE, 0, 0);
  return r;
}

function workdayEnd(d: Date): Date {
  const r = new Date(d);
  r.setHours(WORKDAY_END_HOUR, WORKDAY_END_MINUTE, 0, 0);
  return r;
}

function lunchStart(d: Date): Date {
  const r = new Date(d);
  r.setHours(LUNCH_START_HOUR, 0, 0, 0);
  return r;
}

function lunchEnd(d: Date): Date {
  const r = new Date(d);
  r.setHours(LUNCH_END_HOUR, 0, 0, 0);
  return r;
}

function isInLunch(d: Date): boolean {
  return d >= lunchStart(d) && d < lunchEnd(d);
}

function nextWorkingDay(d: Date): Date {
  const cur = new Date(d);
  while (isWeekend(cur)) {
    cur.setDate(cur.getDate() + 1);
    cur.setHours(0, 0, 0, 0);
  }
  return cur;
}

function nextWorkdayStart(d: Date): Date {
  const tomorrow = new Date(d);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const next = nextWorkingDay(tomorrow);
  return workdayStart(next);
}

function nextWorkCursor(d: Date): Date {
  const cur = nextWorkingDay(new Date(d));
  const start = workdayStart(cur);
  const end = workdayEnd(cur);

  if (cur < start) return start;
  if (cur >= end) return nextWorkdayStart(cur);
  if (isInLunch(cur)) return lunchEnd(cur);
  return cur;
}

/**
 * Productive hours remaining today from cursor (excludes lunch 12:00–13:00).
 * 8:30 → 8.0h, 11:00 → 5.5h, 12:30 → 4.5h, 14:00 → 3.5h
 */
function workingHoursUntilEndOfDay(d: Date): number {
  const end = workdayEnd(d);
  if (d >= end) return 0;

  const ls = lunchStart(d);
  const le = lunchEnd(d);

  if (d < ls) {
    return (ls.getTime() - d.getTime()) / MS_PER_HOUR
      + (end.getTime() - le.getTime()) / MS_PER_HOUR;
  }
  if (d < le) {
    // Trong giờ nghỉ — tính từ 13:00
    return (end.getTime() - le.getTime()) / MS_PER_HOUR;
  }
  return (end.getTime() - d.getTime()) / MS_PER_HOUR;
}

/**
 * Productive hours from cursor to a target time (within same or next days).
 * Used to compute availableUntilDeadline correctly across lunch.
 */
function productiveHoursToEndOfDay(cursor: Date, to: Date): number {
  const end = workdayEnd(cursor);
  const limit = to < end ? to : end;
  if (limit <= cursor) return 0;

  const ls = lunchStart(cursor);
  const le = lunchEnd(cursor);

  if (cursor >= le) {
    return Math.max(0, (limit.getTime() - cursor.getTime()) / MS_PER_HOUR);
  }
  if (cursor >= ls) {
    if (limit <= le) return 0;
    return Math.max(0, (limit.getTime() - le.getTime()) / MS_PER_HOUR);
  }
  // Before lunch
  if (limit <= ls) {
    return (limit.getTime() - cursor.getTime()) / MS_PER_HOUR;
  }
  if (limit <= le) {
    return (ls.getTime() - cursor.getTime()) / MS_PER_HOUR;
  }
  return (ls.getTime() - cursor.getTime()) / MS_PER_HOUR
    + Math.max(0, (limit.getTime() - le.getTime()) / MS_PER_HOUR);
}

/**
 * Advance cursor by exactly `hours` productive hours, skipping lunch and weekends.
 */
function advanceCursor(cursor: Date, hours: number): Date {
  let cur = new Date(cursor);
  let remaining = hours;

  while (remaining > 1e-9) {
    const ls = lunchStart(cur);
    const le = lunchEnd(cur);
    const end = workdayEnd(cur);

    // Skip lunch if in it
    if (cur >= ls && cur < le) {
      cur = new Date(le);
      continue;
    }

    if (cur >= end) {
      cur = nextWorkdayStart(cur);
      continue;
    }

    // Morning or afternoon session
    const sessionEnd = cur < ls ? ls : end;
    const avail = (sessionEnd.getTime() - cur.getTime()) / MS_PER_HOUR;

    if (remaining <= avail) {
      cur = new Date(cur.getTime() + remaining * MS_PER_HOUR);
      remaining = 0;
    } else {
      remaining -= avail;
      // Jump past break (lunch → 13:00, end-of-day → next day)
      cur = cur < ls ? new Date(le) : nextWorkdayStart(cur);
    }
  }

  return cur;
}

export function getAvailableWorkingHours(
  from: Date,
  to: Date,
  dailyHours: number
): number {
  const dailyCapacity = normalizeDailyHours(dailyHours);
  if (dailyCapacity <= 0 || to <= from) return 0;

  let cursor = nextWorkCursor(from);
  let total = 0;

  while (cursor < to) {
    const availableUntilEnd = workingHoursUntilEndOfDay(cursor);
    const availableUntilDeadline = productiveHoursToEndOfDay(cursor, to);
    total += Math.min(dailyCapacity, availableUntilEnd, availableUntilDeadline);
    cursor = nextWorkdayStart(cursor);
  }

  return total;
}

/** Sum estimated hours for a user's active tasks up to a deadline. */
export function getActiveHoursForUser(
  tasks: Task[],
  userId: string,
  upToDeadline?: Date
): number {
  return tasks
    .filter((t) => {
      if (t.assignee_id !== userId) return false;
      if (!ACTIVE_STATUSES.includes(t.status)) return false;
      if (upToDeadline && new Date(t.deadline) > upToDeadline) return false;
      return true;
    })
    .reduce((sum, t) => sum + (t.estimated_hours ?? 0), 0);
}

/** Sort task execution order: Priority → Deadline → Status. */
export function sortByExecution(tasks: Task[]): Task[] {
  return tasks.slice().sort(
    (a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      new Date(a.deadline).getTime() - new Date(b.deadline).getTime() ||
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );
}

export function effectiveHours(task: Task): number {
  if (!ACTIVE_STATUSES.includes(task.status)) return 0;
  const remaining = (task.estimated_hours ?? 0) - (task.actual_hours ?? 0);
  return Math.max(0, remaining) * BUFFER_FACTOR;
}

export function computeSchedule(
  tasks: Task[],
  dailyHours: number,
  from: Date = new Date()
): ScheduledTask[] {
  const active = sortByExecution(
    tasks.filter((t) => ACTIVE_STATUSES.includes(t.status))
  );
  const result: ScheduledTask[] = [];
  const dailyCapacity = normalizeDailyHours(dailyHours);
  if (dailyCapacity <= 0) return result;

  let cursor = nextWorkCursor(new Date(from));
  let remainingToday = Math.min(dailyCapacity, workingHoursUntilEndOfDay(cursor));

  for (const task of active) {
    let hoursLeft = effectiveHours(task);

    if (remainingToday <= 1e-9) {
      cursor = nextWorkdayStart(cursor);
      remainingToday = dailyCapacity;
    }

    const projectedStart = new Date(cursor);

    while (hoursLeft > 1e-9) {
      const remainingWorkday = workingHoursUntilEndOfDay(cursor);

      if (remainingToday <= 1e-9 || remainingWorkday <= 1e-9) {
        cursor = nextWorkdayStart(cursor);
        remainingToday = dailyCapacity;
        continue;
      }

      const used = Math.min(remainingToday, remainingWorkday, hoursLeft);
      cursor = advanceCursor(cursor, used);
      hoursLeft -= used;
      remainingToday -= used;
    }

    result.push({
      taskId: task.id,
      projectedStart: projectedStart.toISOString(),
      projectedCompletion: cursor.toISOString(),
      willMissDeadline: cursor > new Date(task.deadline),
    });
  }

  return result;
}

/** Advance `from` by `hours` productive working hours, respecting the 8:30–17:30 schedule and lunch break. */
export function addWorkingHours(from: Date, hours: number): Date {
  return advanceCursor(nextWorkCursor(from), hours);
}

export function scheduleMapForAssignee(
  tasks: Task[],
  dailyHours: number
): Record<string, string> {
  const schedule = computeSchedule(tasks, dailyHours);
  const map: Record<string, string> = {};
  for (const s of schedule) map[s.taskId] = s.projectedCompletion;
  return map;
}

export function buildWorkloadMembers(
  teamMembers: TeamMember[],
  allTasks: Task[]
): WorkloadMember[] {
  return teamMembers.map((tm) => {
    const profile = tm.profile!;
    const workingHoursPerDay = normalizeDailyHours(tm.working_hours_per_day);
    const activeTasks = allTasks.filter(
      (t) =>
        t.assignee_id === tm.user_id && ACTIVE_STATUSES.includes(t.status)
    );
    const totalEstimatedHours = activeTasks.reduce(
      (s, t) => s + (t.estimated_hours ?? 0),
      0
    );
    const schedule = computeSchedule(activeTasks, workingHoursPerDay);
    const hasOverdue = schedule.some((s) => s.willMissDeadline);

    return {
      userId: tm.user_id,
      userName: profile.full_name,
      email: profile.email,
      workingHoursPerDay,
      activeTasks,
      totalEstimatedHours,
      schedule,
      hasOverdue,
      availableHoursUntil(deadline: Date) {
        return getAvailableWorkingHours(new Date(), deadline, workingHoursPerDay);
      },
      overloadRatio(deadline: Date) {
        const avail = this.availableHoursUntil(deadline);
        if (avail <= 0) return 999;
        const hours = activeTasks
          .filter((t) => new Date(t.deadline) <= deadline)
          .reduce((s, t) => s + effectiveHours(t), 0);
        return hours / avail;
      },
    };
  });
}

export function checkCapacityOnAdd(
  member: WorkloadMember,
  newEstHours: number,
  newDeadline: Date,
  newPriority: Task['priority'] = 'medium'
): { projectedCompletion: Date; willMiss: boolean; affectedTasks: ScheduledTask[] } {
  const NEW_ID = '__new__';
  const fakeTask: Task = {
    id: NEW_ID,
    title: '',
    project_id: '',
    created_by: '',
    status: 'pending',
    priority: newPriority,
    estimated_hours: newEstHours,
    deadline: newDeadline.toISOString(),
    created_at: '',
    updated_at: '',
  };
  const combined = [...member.activeTasks, fakeTask];
  const schedule = computeSchedule(combined, member.workingHoursPerDay);

  const newSched = schedule.find((s) => s.taskId === NEW_ID);
  const projectedCompletion = newSched
    ? new Date(newSched.projectedCompletion)
    : newDeadline;
  const willMiss = newSched ? newSched.willMissDeadline : false;

  const beforeMap = new Map(
    member.schedule.map((s) => [s.taskId, s.willMissDeadline])
  );
  const affectedTasks = schedule.filter(
    (s) =>
      s.taskId !== NEW_ID &&
      s.willMissDeadline &&
      beforeMap.get(s.taskId) === false
  );

  return { projectedCompletion, willMiss, affectedTasks };
}

export function suggestDeadline(member: WorkloadMember, estHours: number): Date {
  const farDeadline = new Date();
  farDeadline.setFullYear(farDeadline.getFullYear() + 10);
  const { projectedCompletion } = checkCapacityOnAdd(
    member,
    estHours,
    farDeadline,
    'low'
  );
  return projectedCompletion;
}

export function suggestAssignees(
  members: WorkloadMember[],
  deadline: Date,
  estHours: number,
  top = 3,
  priority: Task['priority'] = 'medium'
): (WorkloadMember & { projectedCompletion: Date; willMiss: boolean })[] {
  return members
    .map((m) => {
      const { projectedCompletion, willMiss } = checkCapacityOnAdd(
        m,
        estHours,
        deadline,
        priority
      );
      return { ...m, projectedCompletion, willMiss };
    })
    .sort((a, b) => {
      if (a.willMiss !== b.willMiss) return a.willMiss ? 1 : -1;
      return a.projectedCompletion.getTime() - b.projectedCompletion.getTime();
    })
    .slice(0, top);
}

/** Một ngày có nằm trong [start, end] không (so theo mốc thời gian thực). */
function inRange(d: Date, start: Date, end: Date): boolean {
  return d >= start && d <= end;
}

/**
 * Dựng bảng tải trọng thành viên × tuần cho dashboard.
 *
 * Logic:
 * - GOM task theo `deadline`: task thuộc tuần chứa deadline của nó.
 * - `demand` = tổng effectiveHours (giờ còn lại × 1.2) của task ACTIVE trong tuần.
 * - `capacity` = số ngày làm (T2–T6) trong tuần × giờ làm/ngày của thành viên.
 * - `ratio` = demand / capacity → tô màu xanh/cam/đỏ.
 * - CẢNH BÁO theo LỊCH: chạy computeSchedule trên toàn bộ task active của thành viên
 *   (mô phỏng làm tuần tự theo ưu tiên), đếm task trong tuần mà lịch dự kiến sẽ trễ deadline.
 */
export function buildWeeklyWorkload(
  teamMembers: TeamMember[],
  allTasks: Task[],
  weeks: WeekBucket[],
  now: Date = new Date()
): { rows: MemberWeekRow[]; summaries: WeekSummary[] } {
  const rows: MemberWeekRow[] = teamMembers.map((tm) => {
    const profile = tm.profile!;
    const dailyHours = normalizeDailyHours(tm.working_hours_per_day);
    const myTasks = allTasks.filter((t) => t.assignee_id === tm.user_id);
    const activeTasks = myTasks.filter((t) => ACTIVE_STATUSES.includes(t.status));

    // Lịch dự kiến → biết task nào sẽ trễ và mốc hoàn thành dự kiến
    const schedule = computeSchedule(activeTasks, dailyHours);
    const missMap = new Map(schedule.map((s) => [s.taskId, s.willMissDeadline]));
    const projMap = new Map(schedule.map((s) => [s.taskId, s.projectedCompletion]));

    const cells: MemberWeekCell[] = weeks.map((w) => {
      const capacityHours = getWorkingDays(w.start, w.end) * dailyHours;
      // Toàn bộ task (mọi trạng thái) có deadline trong tuần, sắp theo thứ tự thực hiện
      const weekTasks = sortByExecution(
        myTasks.filter((t) => inRange(new Date(t.deadline), w.start, w.end))
      ).map((t) => ({
        ...t,
        projected_completion: projMap.get(t.id) ?? t.projected_completion,
      }));
      const weekActive = weekTasks.filter((t) => ACTIVE_STATUSES.includes(t.status));
      const demandHours = weekActive.reduce((s, t) => s + effectiveHours(t), 0);
      const doneCount = weekTasks.filter((t) => t.status === 'completed').length;
      const willMissCount = weekActive.filter((t) => missMap.get(t.id)).length;
      const ratio =
        capacityHours > 0 ? demandHours / capacityHours : demandHours > 0 ? 999 : 0;

      return {
        capacityHours,
        demandHours,
        ratio,
        taskCount: weekActive.length,
        doneCount,
        willMissCount,
        weekTasks,
      };
    });

    return {
      userId: tm.user_id,
      userName: profile.full_name,
      email: profile.email,
      workingHoursPerDay: dailyHours,
      cells,
    };
  });

  const summaries: WeekSummary[] = weeks.map((w, i) => {
    let taskCount = 0;
    let totalHours = 0;
    let doneCount = 0;
    let overloadedMembers = 0;
    let overdueCount = 0;

    for (const row of rows) {
      const c = row.cells[i];
      taskCount += c.taskCount;
      totalHours += c.demandHours;
      doneCount += c.doneCount;
      if (c.ratio >= 1) overloadedMembers++;
    }

    for (const tm of teamMembers) {
      const overdue = allTasks.filter((t) => {
        if (t.assignee_id !== tm.user_id) return false;
        if (!ACTIVE_STATUSES.includes(t.status)) return false;
        const d = new Date(t.deadline);
        return inRange(d, w.start, w.end) && d < now;
      });
      overdueCount += overdue.length;
    }

    return { taskCount, totalHours, overdueCount, doneCount, overloadedMembers };
  });

  return { rows, summaries };
}

export function overloadColor(ratio: number): string {
  if (ratio >= 1) return 'text-red-600';
  if (ratio >= 0.8) return 'text-orange-500';
  return 'text-green-600';
}

export function overloadBg(ratio: number): string {
  if (ratio >= 1) return 'bg-red-500';
  if (ratio >= 0.8) return 'bg-orange-400';
  return 'bg-green-500';
}
