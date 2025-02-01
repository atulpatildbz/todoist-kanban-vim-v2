import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TodoistService } from "../services/todoistService";
import { KanbanColumn } from "./KanbanColumn";
import {
  KanbanTask,
  KanbanColumn as KanbanColumnType,
  KANBAN_LABELS,
} from "../types";

interface KanbanBoardProps {
  apiToken: string;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ apiToken }) => {
  const todoistService = useMemo(
    () => new TodoistService(apiToken),
    [apiToken]
  );
  const queryClient = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const moveAbortController = useRef<AbortController | null>(null);

  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => todoistService.getTasks(),
  });

  const columns = useMemo<KanbanColumnType[]>(
    () => ["NOT_SET", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"],
    []
  );

  const moveTask = useCallback(
    async (taskId: string, newColumn: KanbanColumnType) => {
      if (isMoving) {
        moveAbortController.current?.abort();
      }

      moveAbortController.current = new AbortController();
      const signal = moveAbortController.current.signal;

      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      setIsMoving(true);
      queryClient.setQueryData(
        ["tasks"],
        (oldTasks: KanbanTask[] | undefined) => {
          if (!oldTasks) return [];
          return oldTasks.map((t) =>
            t.id === taskId ? { ...t, column: newColumn } : t
          );
        }
      );

      try {
        if (signal.aborted) return;

        const newLabels = task.labels.filter(
          (label) => !Object.keys(KANBAN_LABELS).includes(label)
        );
        const newKanbanLabel = Object.entries(KANBAN_LABELS).find(
          ([, value]) => value === newColumn
        )?.[0];

        if (newKanbanLabel) {
          newLabels.push(newKanbanLabel);
          await todoistService.updateTaskLabels(task.id, newLabels);
        }
      } catch (error) {
        if (!signal.aborted) {
          console.error("Failed to move task:", error);
          await queryClient.invalidateQueries({ queryKey: ["tasks"] });
        }
      } finally {
        if (!signal.aborted) {
          setIsMoving(false);
          moveAbortController.current = null;
        }
      }
    },
    [tasks, queryClient, todoistService, isMoving]
  );

  useEffect(() => {
    const handleKeyPress = async (e: KeyboardEvent) => {
      if (!selectedTaskId || isMoving) return;

      const task = tasks.find((t) => t.id === selectedTaskId);
      if (!task) return;

      const currentColumnIndex = columns.indexOf(task.column);
      let newColumn: KanbanColumnType | null = null;

      if (e.key === "h" && currentColumnIndex > 0) {
        newColumn = columns[currentColumnIndex - 1];
      } else if (e.key === "l" && currentColumnIndex < columns.length - 1) {
        newColumn = columns[currentColumnIndex + 1];
      }

      if (newColumn) {
        await moveTask(selectedTaskId, newColumn);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selectedTaskId, tasks, columns, moveTask, isMoving]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900">
        <div className="text-xl text-gray-200">Loading tasks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900">
        <div className="text-xl text-red-400">Error loading tasks</div>
      </div>
    );
  }

  const getTasksByColumn = (column: KanbanColumnType): KanbanTask[] => {
    return tasks.filter((task) => task.column === column);
  };

  const getColumnTitle = (column: KanbanColumnType): string => {
    return column
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="flex gap-6 overflow-x-auto pb-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column}
            title={getColumnTitle(column)}
            tasks={getTasksByColumn(column)}
            selectedTaskId={selectedTaskId}
            onTaskSelect={setSelectedTaskId}
          />
        ))}
      </div>
      {selectedTaskId && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-gray-200 p-4 rounded-lg shadow-lg">
          <p>Selected task - Use 'h' to move left, 'l' to move right</p>
        </div>
      )}
    </div>
  );
};
