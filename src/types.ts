export type KanbanColumn = 'NOT_SET' | 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';

export const KANBAN_LABELS = {
  'KANBAN_TODO': 'TODO' as KanbanColumn,
  'KANBAN_IN_PROGRESS': 'IN_PROGRESS' as KanbanColumn,
  'KANBAN_BLOCKED': 'BLOCKED' as KanbanColumn,
  'KANBAN_DONE': 'DONE' as KanbanColumn,
};

export interface KanbanTask {
  id: string;
  content: string;
  column: KanbanColumn;
  labels: string[];
  priority: number;
} 