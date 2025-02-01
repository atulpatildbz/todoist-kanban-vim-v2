import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TodoistService } from "../services/todoistService";
import { KanbanColumn } from "./KanbanColumn";
import {
  KanbanTask,
  KanbanColumn as KanbanColumnType,
  KANBAN_LABELS,
} from "../types";
import { Task, GetTasksResponse } from "@doist/todoist-api-typescript";

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

  // Initialize currentParentId from URL hash
  const [currentParentId, setCurrentParentId] = useState<string | null>(() => {
    const hash = window.location.hash.slice(1); // Remove the # symbol
    return hash || null;
  });

  // Update URL when parent changes
  useEffect(() => {
    if (currentParentId) {
      window.location.hash = currentParentId;
    } else {
      // Remove hash if we're at the root level
      if (window.location.hash) {
        window.history.pushState("", document.title, window.location.pathname);
      }
    }
  }, [currentParentId]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      setCurrentParentId(hash || null);
      setSelectedTaskId(null);
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => todoistService.getTasks(),
    select: useCallback(
      (response: GetTasksResponse) => {
        const tasks = response.results || [];
        return tasks
          .filter((task: Task) => task.parentId === currentParentId)
          .map((task: Task) => {
            if (!task || typeof task !== "object") {
              console.error("Invalid task object:", task);
              return null;
            }

            let column: KanbanColumnType = "NOT_SET";
            const labels = task.labels || [];

            // Determine the column based on labels
            for (const label of labels) {
              if (KANBAN_LABELS[label as keyof typeof KANBAN_LABELS]) {
                column = KANBAN_LABELS[label as keyof typeof KANBAN_LABELS];
                break;
              }
            }

            return {
              id: task.id || String(Math.random()),
              content: task.content || "Untitled Task",
              column,
              labels,
              priority: task.priority || 1,
              due: task.due,
            };
          })
          .filter((task): task is KanbanTask => task !== null);
      },
      [currentParentId]
    ),
  });

  const columns = useMemo<KanbanColumnType[]>(
    () => ["NOT_SET", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"],
    []
  );

  const moveTask = useCallback(
    async (taskId: string, newColumn: KanbanColumnType) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Optimistically update the UI
      queryClient.setQueryData(
        ["tasks"],
        (oldData: GetTasksResponse | undefined) => {
          if (!oldData?.results) return oldData;
          return {
            ...oldData,
            results: oldData.results.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    labels: [
                      ...t.labels.filter(
                        (label) => !Object.keys(KANBAN_LABELS).includes(label)
                      ),
                      `KANBAN_${newColumn}`,
                    ],
                  }
                : t
            ),
          };
        }
      );

      try {
        const newLabels = task.labels.filter(
          (label) => !Object.keys(KANBAN_LABELS).includes(label)
        );
        const newKanbanLabel = Object.entries(KANBAN_LABELS).find(
          ([, value]) => value === newColumn
        )?.[0];

        if (newKanbanLabel) {
          newLabels.push(newKanbanLabel);
          await todoistService.updateTaskLabels(task.id, newLabels);
          await queryClient.invalidateQueries({ queryKey: ["tasks"] });
        }
      } catch (error) {
        console.error("Failed to move task:", error);
        await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      }
    },
    [tasks, queryClient, todoistService]
  );

  useEffect(() => {
    let lastKeyPressed = "";
    const handleKeyPress = async (e: KeyboardEvent) => {
      if (!selectedTaskId) return;

      const task = tasks.find((t) => t.id === selectedTaskId);
      if (!task) return;

      // Handle task navigation with 'gd'
      if (lastKeyPressed === "g" && e.key === "d") {
        setCurrentParentId(selectedTaskId);
        setSelectedTaskId(null);
        lastKeyPressed = "";
        return;
      }
      lastKeyPressed = e.key;

      // Handle going back to parent level
      if (e.key === "Escape" && currentParentId) {
        setCurrentParentId(null);
        setSelectedTaskId(null);
        return;
      }

      // Handle column movement
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
  }, [selectedTaskId, tasks, columns, moveTask, currentParentId]);

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
      {currentParentId && (
        <button
          onClick={() => {
            setCurrentParentId(null);
            setSelectedTaskId(null);
          }}
          className="mb-4 px-4 py-2 bg-gray-800 text-gray-200 rounded hover:bg-gray-700"
        >
          ← Back to Parent
        </button>
      )}
      <div className="flex gap-6 overflow-x-auto pb-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column}
            title={getColumnTitle(column)}
            tasks={getTasksByColumn(column)}
            selectedTaskId={selectedTaskId}
            onTaskSelect={setSelectedTaskId}
            onTaskMove={moveTask}
            columnType={column}
          />
        ))}
      </div>
      {selectedTaskId && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-gray-200 p-4 rounded-lg shadow-lg">
          <p>Selected task - Use:</p>
          <ul className="list-disc list-inside mt-2">
            <li>'h' to move left</li>
            <li>'l' to move right</li>
            <li>'gd' to view subtasks</li>
            {currentParentId && <li>'Esc' to go back</li>}
            <li>or drag and drop to move tasks</li>
          </ul>
        </div>
      )}
    </div>
  );
};
