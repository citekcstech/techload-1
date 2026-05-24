import { Task, WorkloadMember, TeamMember } from '@/types';

/** Count working days (Mon–Fri) between two dates, inclusive */
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

/** Sum estimated hours for a user's active tasks up to a deadline */
export function getActiveHoursForUser(
  tasks: Task[],
  userId: string,
  upToDeadline?: Date
): number {
  return tasks
    .filter((t) => {
      if (t.assignee_id !== userId) return false;
      if (!['pending', 'in_progress', 'reopened'].includes(t.status)) return false;
      if (upToDeadline && new Date(t.deadline) > upToDeadline) return false;
      return true;
    })
    .reduce((sum, t) => sum + (t.estimated_hours ?? 0), 0);
}

/** Build workload summary per team member */
export function buildWorkloadMembers(
  teamMembers: TeamMember[],
  allTasks: Task[]
): WorkloadMember[] {
  return teamMembers.map((tm) => {
    const profile = tm.profile!;
    const activeTasks = allTasks.filter(
      (t) =>
        t.assignee_id === tm.user_id &&
        ['pending', 'in_progress', 'reopened'].includes(t.status)
    );
    const totalEstimatedHours = activeTasks.reduce(
      (s, t) => s + (t.estimated_hours ?? 0),
      0
    );

    return {
      userId: tm.user_id,
      userName: profile.full_name,
      email: profile.email,
      workingHoursPerDay: tm.working_hours_per_day,
      activeTasks,
      totalEstimatedHours,
      availableHoursUntil(deadline: Date) {
        const days = getWorkingDays(new Date(), deadline);
        return days * tm.working_hours_per_day;
      },
      overloadRatio(deadline: Date) {
        const avail = this.availableHoursUntil(deadline);
        if (avail <= 0) return 999;
        // include only tasks whose deadline <= given deadline
        const hours = getActiveHoursForUser(activeTasks, tm.user_id, deadline);
        return hours / avail;
      },
    };
  });
}

/**
 * Suggest earliest deadline for a new task with `estHours` assigned to `userId`.
 * Returns a Date that is at least `bufferDays` working days after capacity is met.
 */
export function suggestDeadline(
  member: WorkloadMember,
  estHours: number,
  bufferDays = 1
): Date {
  const existing = member.totalEstimatedHours;
  const totalNeeded = existing + estHours;
  const daysNeeded = Math.ceil(totalNeeded / member.workingHoursPerDay);
  const result = new Date();
  let workDaysAdded = 0;
  while (workDaysAdded < daysNeeded + bufferDays) {
    result.setDate(result.getDate() + 1);
    const d = result.getDay();
    if (d !== 0 && d !== 6) workDaysAdded++;
  }
  return result;
}

/** Find members with lowest overload ratio (best candidates to assign) */
export function suggestAssignees(
  members: WorkloadMember[],
  deadline: Date,
  estHours: number,
  top = 3
): (WorkloadMember & { ratioAfterAssign: number })[] {
  return members
    .map((m) => {
      const avail = m.availableHoursUntil(deadline);
      const currentHours = getActiveHoursForUser(m.activeTasks, m.userId, deadline);
      const ratioAfterAssign = avail > 0 ? (currentHours + estHours) / avail : 999;
      return { ...m, ratioAfterAssign };
    })
    .sort((a, b) => a.ratioAfterAssign - b.ratioAfterAssign)
    .slice(0, top);
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
