import { TodoistApi } from "@doist/todoist-api-typescript";
import { KanbanTask, KANBAN_LABELS, KanbanColumn } from "../types";

export class TodoistService {
  private api: TodoistApi;

  constructor(apiToken: string) {
    this.api = new TodoistApi(apiToken);
  }

  async getTasks(): Promise<KanbanTask[]> {
    try {
      const response = await this.api.getTasks();
      const tasks = response.results || [];
      console.log('Tasks from API:', tasks);
      
      return tasks
        .filter(task => !task.parentId) // Only include top-level tasks
        .map((task) => {
          if (!task || typeof task !== 'object') {
            console.error('Invalid task object:', task);
            return null;
          }

          let column: KanbanColumn = "NOT_SET";
          const labels = task.labels || [];

          console.log(`Processing task:`, {
            id: task.id,
            content: task.content,
            labels: labels
          });

          // Determine the column based on labels
          for (const label of labels) {
            if (KANBAN_LABELS[label as keyof typeof KANBAN_LABELS]) {
              column = KANBAN_LABELS[label as keyof typeof KANBAN_LABELS];
              break;
            }
          }

          return {
            id: task.id || String(Math.random()),
            content: task.content || 'Untitled Task',
            column,
            labels,
            priority: task.priority || 1,
          };
        }).filter((task): task is KanbanTask => task !== null);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      throw error;
    }
  }

  async updateTaskLabels(taskId: string, labels: string[]): Promise<void> {
    try {
      await this.api.updateTask(taskId, { labels });
    } catch (error) {
      console.error("Error updating task labels:", error);
      throw error;
    }
  }
}
