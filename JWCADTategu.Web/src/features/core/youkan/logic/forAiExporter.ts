import type { Item } from '../types';

export interface ForAiGroup {
  groupTitle: string;
  items: Item[];
}

export interface BuildForAiMarkdownInput {
  perspectiveLabel: string;
  today: Date;
  groups: ForAiGroup[];
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatPrepDate(prepDate: number): string {
  const ms = prepDate < 100_000_000_000 ? prepDate * 1000 : prepDate;
  return formatDate(new Date(ms));
}

function formatEstimatedMinutes(minutes: number): string {
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60}h`;
  }
  if (minutes >= 60) {
    return `${minutes / 60}h`;
  }
  return `${minutes}m`;
}

function buildItemLine(item: Item): string {
  const projectLabel = item.projectTitle || item.projectId || 'Inbox';
  const parts: string[] = [];

  if (item.due_date) parts.push(`納期: ${item.due_date}`);
  if (item.prep_date) parts.push(`マイ期限: ${formatPrepDate(item.prep_date)}`);
  if (item.estimatedMinutes) parts.push(`目安: ${formatEstimatedMinutes(item.estimatedMinutes)}`);
  if (item.work_days) parts.push(`目安期間: ${item.work_days}日`);
  const assignee = item.assigneeName || item.assignedTo;
  if (assignee) parts.push(`担当: ${assignee}`);
  if (item.tenantName) parts.push(`会社: ${item.tenantName}`);
  if (item.memo) parts.push(`メモ: ${item.memo}`);

  const suffix = parts.length > 0 ? ` — ${parts.join(' / ')}` : '';
  return `- [ ] (${projectLabel}) ${item.title}${suffix}`;
}

export function buildForAiMarkdown(input: BuildForAiMarkdownInput): string {
  const { perspectiveLabel, today, groups } = input;
  const lines: string[] = [];

  lines.push(`# Youkan タスク状況 (${formatDate(today)})`);
  lines.push(`## 立場: ${perspectiveLabel}`);

  for (const group of groups) {
    if (group.items.length === 0) continue;
    lines.push('');
    lines.push(`## ${group.groupTitle}`);
    for (const item of group.items) {
      lines.push(buildItemLine(item));
    }
  }

  return lines.join('\n');
}
