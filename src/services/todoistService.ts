import { TodoistApi } from "@doist/todoist-api-typescript";

interface CreateTaskParams {
  content: string;
  parentId?: string | null;
}

export class TodoistService {
  private api: TodoistApi;

  constructor(apiToken: string) {
    this.api = new TodoistApi(apiToken);
  }

  async getTasks() {
    return this.api.getTasks();
  }

  async createTask(params: CreateTaskParams) {
    return this.api.addTask({
      content: params.content,
      parentId: params.parentId || undefined,
    });
  }

  async deleteTask(taskId: string) {
    return this.api.deleteTask(taskId);
  }

  async closeTask(taskId: string) {
    return this.api.closeTask(taskId);
  }

  private debouncedUpdateTask: {
    [key: string]: ReturnType<typeof setTimeout>;
  } = {};

  async updateTaskLabels(taskId: string, labels: string[]): Promise<void> {
    try {
      // Clear any existing timeout for this task
      if (this.debouncedUpdateTask[taskId]) {
        clearTimeout(this.debouncedUpdateTask[taskId]);
      }

      // Create a new promise that resolves when the debounced update completes
      return new Promise((resolve, reject) => {
        this.debouncedUpdateTask[taskId] = setTimeout(async () => {
          try {
            await this.api.updateTask(taskId, { labels });
            delete this.debouncedUpdateTask[taskId];
            resolve();
          } catch (error) {
            console.error("Error updating task labels:", error);
            delete this.debouncedUpdateTask[taskId];
            reject(error);
          }
        }, 500); // 500ms debounce delay
      });
    } catch (error) {
      console.error("Error in debounced update:", error);
      throw error;
    }
  }
}
