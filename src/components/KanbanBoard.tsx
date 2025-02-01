import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  useQuery,
  useQueryClient,
  useIsFetching,
  useMutation,
} from "@tanstack/react-query";
import { TodoistService } from "../services/todoistService";
import { KanbanColumn } from "./KanbanColumn";
import { LoadingIndicator } from "./LoadingIndicator";
import { CreateTaskModal } from "./CreateTaskModal";
import {
  KanbanTask,
  KanbanColumn as KanbanColumnType,
  KANBAN_LABELS,
} from "../types";
import { Task, GetTasksResponse } from "@doist/todoist-api-typescript";
import { FilterBar } from "./FilterBar";

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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const isFetching = useIsFetching();

  // Search state
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchResults, setSearchResults] = useState<KanbanTask[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false);

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
          .filter((task: Task) => {
            // Filter by parent
            if (task.parentId !== currentParentId) return false;

            // Filter by project
            if (
              selectedProjects.length > 0 &&
              !selectedProjects.includes(task.projectId)
            ) {
              return false;
            }

            // Filter by labels (excluding KANBAN labels)
            if (selectedLabels.length > 0) {
              const taskLabels = task.labels.filter(
                (label) => !label.startsWith("KANBAN_")
              );
              if (!taskLabels.some((label) => selectedLabels.includes(label))) {
                return false;
              }
            }

            return true;
          })
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
      [currentParentId, selectedProjects, selectedLabels]
    ),
  });

  const columns = useMemo<KanbanColumnType[]>(
    () => ["NOT_SET", "TODO", "IN_PROGRESS", "BLOCKED", "DONE"],
    []
  );

  const moveTaskMutation = useMutation({
    mutationFn: async ({
      taskId,
      newColumn,
    }: {
      taskId: string;
      newColumn: KanbanColumnType;
    }) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

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
    },
    onMutate: async ({ taskId, newColumn }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks = queryClient.getQueryData<GetTasksResponse>([
        "tasks",
      ]);

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

      return { previousTasks };
    },
    onError: (_, __, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (title: string) => {
      return todoistService.createTask({
        content: title,
        parentId: currentParentId,
      });
    },
    onMutate: async (title) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks = queryClient.getQueryData<GetTasksResponse>(["tasks"]);

      const optimisticTask = {
        id: `temp-${Date.now()}`,
        content: title,
        labels: ["KANBAN_NOT_SET"],  // Add default Kanban label
        priority: 1,
        parentId: currentParentId,
        due: null,
        projectId: null,
        order: 0,
        url: "",
        commentCount: 0,
        createdAt: new Date().toISOString(),
        creatorId: "",
        assigneeId: null,
        assignerId: null,
        description: "",
        isCompleted: false,
        sectionId: null,
        duration: null,
      };

      queryClient.setQueryData(["tasks"], (oldData: GetTasksResponse | undefined) => {
        if (!oldData?.results) return { results: [optimisticTask] };
        return {
          ...oldData,
          results: [...oldData.results, optimisticTask],
        };
      });

      return { previousTasks };
    },
    onError: (_, __, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await todoistService.deleteTask(taskId);
    },
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks = queryClient.getQueryData<GetTasksResponse>([
        "tasks",
      ]);

      queryClient.setQueryData(
        ["tasks"],
        (oldData: GetTasksResponse | undefined) => {
          if (!oldData?.results) return oldData;
          return {
            ...oldData,
            results: oldData.results.filter((t) => t.id !== taskId),
          };
        }
      );

      return { previousTasks };
    },
    onError: (_, __, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
    },
    onSuccess: () => {
      setSelectedTaskId(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await todoistService.closeTask(taskId);
    },
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks = queryClient.getQueryData<GetTasksResponse>([
        "tasks",
      ]);

      queryClient.setQueryData(
        ["tasks"],
        (oldData: GetTasksResponse | undefined) => {
          if (!oldData?.results) return oldData;
          return {
            ...oldData,
            results: oldData.results.filter((t) => t.id !== taskId),
          };
        }
      );

      return { previousTasks };
    },
    onError: (_, __, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
    },
    onSuccess: () => {
      setSelectedTaskId(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const moveTask = useCallback(
    async (taskId: string, newColumn: KanbanColumnType) => {
      await moveTaskMutation.mutateAsync({ taskId, newColumn });
    },
    [moveTaskMutation]
  );

  const createTask = useCallback(
    async (title: string) => {
      await createTaskMutation.mutateAsync(title);
    },
    [createTaskMutation]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      await deleteTaskMutation.mutateAsync(taskId);
    },
    [deleteTaskMutation]
  );

  const completeTask = useCallback(
    async (taskId: string) => {
      await completeTaskMutation.mutateAsync(taskId);
    },
    [completeTaskMutation]
  );

  const handleSearch = useCallback(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const matches = tasks.filter((task) =>
      task.content.toLowerCase().includes(query)
    );
    setSearchResults(matches);
    setCurrentMatchIndex(0);

    if (matches.length > 0) {
      setSelectedTaskId(matches[0].id);
    }
  }, [searchQuery, tasks]);

  useEffect(() => {
    if (isSearchMode && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchMode]);

  useEffect(() => {
    handleSearch();
  }, [searchQuery, handleSearch]);

  const [lastKeyPressed, setLastKeyPressed] = useState("");

  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts if we're in an input field or if filter modal is open
      if (
        (e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement) &&
        !isSearchMode
      ) {
        return;
      }

      // Handle search input mode
      if (isSearchMode) {
        if (e.key === "Enter") {
          e.preventDefault();
          setIsSearchMode(false);
          setIsSearchActive(true);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setIsSearchMode(false);
          setSearchQuery("");
          setSearchResults([]);
          setIsSearchActive(false);
          return;
        }
        return;
      }

      // Handle multi-key shortcuts first
      if (lastKeyPressed === "g") {
        if (e.key === "f") {
          e.preventDefault();
          setIsFilterModalOpen(true);
          setLastKeyPressed("");
          return;
        }
        if (e.key === "d" && selectedTaskId) {
          e.preventDefault();
          setCurrentParentId(selectedTaskId);
          setSelectedTaskId(null);
          setLastKeyPressed("");
          return;
        }
        // If any other key is pressed after 'g', reset lastKeyPressed
        setLastKeyPressed("");
        return;
      }

      // Set up for multi-key shortcuts
      if (e.key === "g") {
        e.preventDefault();
        setLastKeyPressed("g");
        return;
      }

      // Handle single-key shortcuts
      if (e.key === "o") {
        e.preventDefault();
        setIsCreateModalOpen(true);
        return;
      }

      // Handle search navigation when search is active
      if (isSearchActive && e.key === "n") {
        e.preventDefault();
        if (searchResults.length > 0) {
          const newIndex = e.shiftKey
            ? (currentMatchIndex - 1 + searchResults.length) % searchResults.length
            : (currentMatchIndex + 1) % searchResults.length;
          setCurrentMatchIndex(newIndex);
          setSelectedTaskId(searchResults[newIndex].id);
        }
        return;
      }

      // Handle search activation
      if (e.key === "/" && !isSearchMode) {
        e.preventDefault();
        setIsSearchMode(true);
        setSearchQuery("");
        setIsSearchActive(false);
        return;
      }

      // Handle clearing search with Escape when not in search mode
      if (e.key === "Escape") {
        if (isSearchActive) {
          setSearchResults([]);
          setIsSearchActive(false);
          return;
        }
        if (currentParentId) {
          setCurrentParentId(null);
          setSelectedTaskId(null);
          return;
        }
      }

      if (!selectedTaskId) return;

      const task = tasks.find((t) => t.id === selectedTaskId);
      if (!task) return;

      // Handle single key task actions
      if (e.key === "d") {
        e.preventDefault();
        deleteTask(selectedTaskId);
        return;
      }

      if (e.key === "c") {
        e.preventDefault();
        completeTask(selectedTaskId);
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
        moveTask(selectedTaskId, newColumn);
      }
    },
    [
      selectedTaskId,
      tasks,
      columns,
      moveTask,
      currentParentId,
      deleteTask,
      completeTask,
      isFilterModalOpen,
      isSearchMode,
      isSearchActive,
      searchResults,
      currentMatchIndex,
      lastKeyPressed,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleKeyPress]);

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
      {isFetching > 0 && <LoadingIndicator />}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={createTask}
      />
      <FilterBar
        todoistService={todoistService}
        selectedProjects={selectedProjects}
        selectedLabels={selectedLabels}
        onProjectsChange={setSelectedProjects}
        onLabelsChange={setSelectedLabels}
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
      />
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
            onTaskMove={(taskId) => moveTaskMutation.mutate({ taskId, newColumn: column })}
            selectedTaskId={selectedTaskId}
            onTaskSelect={setSelectedTaskId}
            columnType={column}
            searchResults={searchResults}
            currentMatchIndex={currentMatchIndex}
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
            <li>'gf' to open filters</li>
            {currentParentId && <li>'Esc' to go back</li>}
            <li>'o' to create new task</li>
            <li>'d' to delete task</li>
            <li>'c' to complete task</li>
            <li>or drag and drop to move tasks</li>
          </ul>
        </div>
      )}
      {isSearchMode && (
        <div className="fixed bottom-4 left-4 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <span className="text-gray-500">/</span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setIsSearchMode(false);
                setIsSearchActive(true);
              }
            }}
            className="bg-transparent border-none outline-none"
            placeholder="Search tasks..."
          />
          {searchResults.length > 0 && (
            <span className="text-sm text-gray-500">
              {currentMatchIndex + 1}/{searchResults.length}
            </span>
          )}
        </div>
      )}
      {isSearchActive && !isSearchMode && searchResults.length > 0 && (
        <div className="fixed bottom-4 left-4 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg z-50">
          <span className="text-sm text-gray-500">
            {currentMatchIndex + 1}/{searchResults.length} matches for "{searchQuery}"
          </span>
        </div>
      )}
    </div>
  );
};
