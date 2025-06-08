import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
import { HelpPopover } from "./HelpPopover";
import {
  KanbanTask,
  KanbanColumn as KanbanColumnType,
  KANBAN_LABELS,
} from "../types";
import { Task } from "@doist/todoist-api-typescript";
import { FilterBar } from "./FilterBar";
import { Toast } from "./Toast";

// Date filter types
export type DateFilterType = "today" | "today_upcoming" | "all";

interface KanbanBoardProps {
  apiToken: string;
  initialColumnWidth?: number;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  apiToken,
  initialColumnWidth = 300,
}) => {
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
  const [dateFilter, setDateFilter] = useState<DateFilterType>(() => {
    // Default to "today_upcoming" on main board, "all" on sub-boards
    const hash = window.location.hash.slice(1);
    return hash ? "all" : "today_upcoming";
  });
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

  // Update dateFilter when navigating between main board and sub-boards
  useEffect(() => {
    if (currentParentId) {
      // When entering a sub-board, switch to "all" tasks
      setDateFilter("all");
    } else {
      // When returning to main board, switch to "today_upcoming"
      setDateFilter("today_upcoming");
    }
  }, [currentParentId]);

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

  // Get projects for project name lookup
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => todoistService.getProjects(),
  });

  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => todoistService.getTasks(),
    select: useCallback(
      (response: Task[]) => {
        return response
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
              const nonKanbanLabels = task.labels.filter(
                (label: string) => !label.startsWith("KANBAN_")
              );
              if (nonKanbanLabels.length === 0) return false;
              if (
                !nonKanbanLabels.some((label) => selectedLabels.includes(label))
              ) {
                return false;
              }
            }

            return true;
          })
          .map((task: Task) => {
            let column: KanbanColumnType = "NOT_SET";
            const labels = task.labels || [];

            // Determine the column based on labels
            const kanbanLabel = labels.find((label: string) =>
              Object.keys(KANBAN_LABELS).includes(label)
            );

            if (kanbanLabel) {
              column = KANBAN_LABELS[kanbanLabel as keyof typeof KANBAN_LABELS];
            }

            // Find project name
            const project = projects.find((p) => p.id === task.projectId);

            return {
              id: task.id,
              content: task.content || "Untitled Task",
              column,
              labels,
              priority: task.priority || 1,
              projectId: task.projectId,
              projectName: project?.name,
              due: task.due,
            };
          });
      },
      [currentParentId, selectedProjects, selectedLabels, projects]
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
      const previousTasks = queryClient.getQueryData<Task[]>(["tasks"]);

      queryClient.setQueryData(["tasks"], (oldData: Task[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map((t) =>
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
        );
      });

      return { previousTasks };
    },
    onError: (error: Error, __, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
      setToast({
        message: error.message || "Failed to move task",
        type: "error",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (title: string) => {
      const task = await todoistService.createTask({
        content: title,
        parentId: currentParentId,
      });
      // Add the KANBAN_NOT_SET label after creation
      if (task) {
        await todoistService.updateTaskLabels(task.id, ["KANBAN_NOT_SET"]);
      }
      return task;
    },
    onMutate: async (title) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks = queryClient.getQueryData<Task[]>(["tasks"]);

      // Create an optimistic task that matches the Todoist API Task format
      const optimisticTask = {
        id: `temp-${Date.now()}`,
        content: title,
        description: "",
        projectId: "",
        sectionId: null,
        parentId: currentParentId,
        order: 0,
        labels: ["KANBAN_NOT_SET"],
        priority: 1,
        due: null,
        url: "",
        commentCount: 0,
        createdAt: new Date().toISOString(),
        creatorId: "",
        assigneeId: null,
        assignerId: null,
        isCompleted: false,
        duration: null,
        deadline: null,
      };

      queryClient.setQueryData(["tasks"], (oldData: Task[] | undefined) => {
        if (!oldData) return [optimisticTask];
        return [...oldData, optimisticTask];
      });

      return { previousTasks };
    },
    onError: (error: Error, __, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
      setToast({
        message: error.message || "Failed to create task",
        type: "error",
      });
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
      const previousTasks = queryClient.getQueryData<Task[]>(["tasks"]);

      queryClient.setQueryData(["tasks"], (oldData: Task[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.filter((t) => t.id !== taskId);
      });

      return { previousTasks };
    },
    onError: (error: Error, __, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
      setToast({
        message: error.message || "Failed to delete task",
        type: "error",
      });
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
      const previousTasks = queryClient.getQueryData<Task[]>(["tasks"]);

      queryClient.setQueryData(["tasks"], (oldData: Task[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.filter((t) => t.id !== taskId);
      });

      return { previousTasks };
    },
    onError: (error: Error, __, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
      setToast({
        message: error.message || "Failed to complete task",
        type: "error",
      });
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
      setSelectedTaskId(null);
      return;
    }

    const query = searchQuery.toLowerCase();
    const matches = tasks.filter((task) =>
      task.content.toLowerCase().includes(query)
    );
    setSearchResults(matches);
    setCurrentMatchIndex(0);

    if (matches.length > 0 && isSearchActive) {
      setSelectedTaskId(matches[0].id);
    }
  }, [searchQuery, tasks, isSearchActive]);

  // Focus effect
  useEffect(() => {
    if (isSearchMode && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchMode]);

  // Search effect
  useEffect(() => {
    if (isSearchActive || searchQuery) {
      handleSearch();
    }
  }, [searchQuery, handleSearch, isSearchActive]);

  const [lastKeyPressed, setLastKeyPressed] = useState("");

  const [isHelpOpen, setIsHelpOpen] = useState(false);

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

      // Don't handle keyboard events if filter modal is open
      if (isFilterModalOpen) {
        return;
      }

      // Handle help shortcut
      if (e.key === "?" && !isSearchMode) {
        e.preventDefault();
        setIsHelpOpen((prev) => !prev);
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
            ? (currentMatchIndex - 1 + searchResults.length) %
              searchResults.length
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
      deleteTask,
      completeTask,
      isSearchMode,
      isSearchActive,
      searchResults,
      currentMatchIndex,
      lastKeyPressed,
      isFilterModalOpen,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleKeyPress]);

  const getParentTaskContent = useCallback(
    (parentId: string | null) => {
      if (!parentId) return null;
      const parentTask = queryClient
        .getQueryData<Task[]>(["tasks"])
        ?.find((task) => task.id === parentId);
      return parentTask?.content || parentId; // Fallback to ID if task not found
    },
    [queryClient]
  );

  const [columnWidth, setColumnWidth] = useState(initialColumnWidth);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      setIsResizing(true);
      resizeStartXRef.current = e.clientX;
      startWidthRef.current = columnWidth;
      document.body.style.cursor = "col-resize";
    },
    [columnWidth]
  );

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const diff = e.clientX - resizeStartXRef.current;
      const newWidth = Math.max(
        250,
        Math.min(600, startWidthRef.current + diff)
      );
      setColumnWidth(newWidth);
    },
    [isResizing]
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = "default";
  }, []);

  const handleDoubleClick = useCallback(() => {
    // Get the container width (excluding padding and gaps)
    const containerWidth =
      document.querySelector(".kanban-container")?.clientWidth ??
      window.innerWidth - 64; // 64px for padding
    const totalGaps = (columns.length - 1) * 24; // 24px gap between columns (6 * 4 for the gap-6 class)
    const availableWidth = containerWidth - totalGaps;

    // Calculate width per column
    const widthPerColumn = Math.floor(availableWidth / columns.length);

    // Set new width, but keep it within bounds
    const newWidth = Math.max(250, Math.min(600, widthPerColumn));
    setColumnWidth(newWidth);
  }, [columns.length]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeEnd);
      return () => {
        window.removeEventListener("mousemove", handleResizeMove);
        window.removeEventListener("mouseup", handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  // Helper function to check if a date is today
  const isToday = (date: string) => {
    const today = new Date();
    const taskDate = new Date(date);

    // Reset time to compare only dates
    today.setHours(0, 0, 0, 0);
    taskDate.setHours(0, 0, 0, 0);

    const isToday = today.getTime() === taskDate.getTime();
    console.log(
      `Checking if ${date} is today (${today.toDateString()}):`,
      isToday
    );
    return isToday;
  };

  // Helper function to check if a date is today or in the future
  const isTodayOrFuture = (date: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);
    const isFuture = taskDate.getTime() >= today.getTime();
    console.log(
      `Checking if ${date} is today (${today.toDateString()}) or future:`,
      isFuture
    );
    return isFuture;
  };

  // Helper function to filter tasks by date
  const filterTasksByDate = (tasks: KanbanTask[]) => {
    console.log(
      `Filtering ${tasks.length} tasks with dateFilter: ${dateFilter}`
    );
    if (dateFilter === "all") return tasks;

    const filtered = tasks.filter((task) => {
      // Handle tasks with no due date
      if (!task.due?.date) {
        // For both "today" and "today_upcoming" filters, exclude tasks with no due date
        console.log(
          `Task "${task.content}" has no due date, excluding from "${dateFilter}" filter`
        );
        return false;
      }

      if (dateFilter === "today") {
        const result = isToday(task.due.date);
        console.log(
          `Task "${task.content}" due ${task.due.date}, today filter result:`,
          result
        );
        return result;
      } else if (dateFilter === "today_upcoming") {
        const result = isTodayOrFuture(task.due.date);
        console.log(
          `Task "${task.content}" due ${task.due.date}, today+upcoming filter result:`,
          result
        );
        return result;
      }

      return true;
    });

    console.log(
      `Filtered result: ${filtered.length} tasks (from ${tasks.length} original)`
    );
    return filtered;
  };

  // Helper function to sort tasks by priority first, then by date
  const sortTasks = (tasks: KanbanTask[]) => {
    return tasks.sort((a, b) => {
      // Sort by priority first (4 = highest, 1 = lowest)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // Then sort by date (earliest first)
      if (a.due?.date && b.due?.date) {
        const dateA = new Date(a.due.date);
        const dateB = new Date(b.due.date);
        return dateA.getTime() - dateB.getTime();
      }

      // If only one has a date, prioritize the one with a date
      if (a.due?.date && !b.due?.date) return -1;
      if (!a.due?.date && b.due?.date) return 1;

      // If neither has a date, maintain original order
      return 0;
    });
  };

  // Debug effect to log when dateFilter changes
  useEffect(() => {
    console.log("DateFilter changed to:", dateFilter);
  }, [dateFilter]);

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
    const tasksInColumn = tasks.filter(
      (task: KanbanTask) => task.column === column
    );

    // Debug: log all tasks and their due dates
    console.log(
      `All tasks in column ${column}:`,
      tasksInColumn.map((t) => ({
        content: t.content,
        due: t.due,
        priority: t.priority,
      }))
    );

    // Apply date filtering and sorting
    const filteredTasks = filterTasksByDate(tasksInColumn);
    const sortedTasks = sortTasks(filteredTasks);
    console.log(
      `Final tasks in column ${column} after filtering:`,
      sortedTasks.length
    );
    return sortedTasks;
  };

  const getColumnTitle = (column: KanbanColumnType): string => {
    return column
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      {isFetching > 0 && <LoadingIndicator />}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
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
      <HelpPopover isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          {currentParentId && (
            <button
              onClick={() => {
                setCurrentParentId(null);
                setSelectedTaskId(null);
              }}
              className="px-4 py-2 bg-gray-800 text-gray-200 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center gap-2 border border-gray-700 hover:border-gray-600"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Parent
            </button>
          )}
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            {currentParentId ? (
              <>
                <span>Subtasks of: </span>
                <span className="text-gray-100">
                  {getParentTaskContent(currentParentId)}
                </span>
              </>
            ) : (
              "Atul's Board"
            )}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {/* Project Filter Button */}
          <button
            onClick={() => setIsFilterModalOpen(true)}
            className={`px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium flex items-center gap-2 border ${
              selectedProjects.length > 0 || selectedLabels.length > 0
                ? "bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-lg shadow-blue-500/10"
                : "bg-gray-800/50 text-gray-400 border-gray-700/50 hover:text-gray-200 hover:bg-gray-700/50 hover:border-gray-600/50"
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filter
            {(selectedProjects.length > 0 || selectedLabels.length > 0) && (
              <span className="bg-blue-500/30 text-blue-200 px-1.5 py-0.5 rounded-full text-xs">
                {selectedProjects.length + selectedLabels.length}
              </span>
            )}
          </button>
          {/* Date Filter Controls */}
          <div className="flex items-center bg-gray-800/50 backdrop-blur-sm rounded-lg p-1 border border-gray-700/50">
            <button
              onClick={() => {
                console.log("Clicking Today filter");
                setDateFilter("today");
              }}
              className={`px-3 py-1.5 rounded-md transition-all duration-200 text-xs font-medium ${
                dateFilter === "today"
                  ? "bg-blue-500/20 text-blue-300 shadow-lg shadow-blue-500/10"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => {
                console.log("Clicking Today + Upcoming filter");
                setDateFilter("today_upcoming");
              }}
              className={`px-3 py-1.5 rounded-md transition-all duration-200 text-xs font-medium ${
                dateFilter === "today_upcoming"
                  ? "bg-green-500/20 text-green-300 shadow-lg shadow-green-500/10"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
              }`}
            >
              Today + Upcoming
            </button>
            <button
              onClick={() => {
                console.log("Clicking All Tasks filter");
                setDateFilter("all");
              }}
              className={`px-3 py-1.5 rounded-md transition-all duration-200 text-xs font-medium ${
                dateFilter === "all"
                  ? "bg-purple-500/20 text-purple-300 shadow-lg shadow-purple-500/10"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
              }`}
            >
              All Tasks
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <kbd className="px-2 py-1 bg-gray-800 rounded-md border border-gray-700">
              ?
            </kbd>
            <span>for help</span>
          </div>
        </div>
      </div>
      <div className="flex gap-6 overflow-x-auto pb-4 px-2 -mx-2 kanban-container">
        {columns.map((column, index) => (
          <div key={column} className="flex items-stretch">
            <KanbanColumn
              title={getColumnTitle(column)}
              tasks={getTasksByColumn(column)}
              onTaskMove={(taskId) =>
                moveTaskMutation.mutate({ taskId, newColumn: column })
              }
              selectedTaskId={selectedTaskId}
              onTaskSelect={setSelectedTaskId}
              columnType={column}
              searchResults={searchResults}
              currentMatchIndex={currentMatchIndex}
              minWidth={columnWidth}
            />
            {index < columns.length - 1 && (
              <div
                className="w-6 cursor-col-resize flex items-center justify-center hover:bg-gray-700/30 transition-colors -mx-3 z-10"
                onMouseDown={handleResizeStart}
                onDoubleClick={handleDoubleClick}
              >
                <div className="w-0.5 h-12 bg-gray-600/50 rounded-full" />
              </div>
            )}
          </div>
        ))}
      </div>
      {isSearchMode && (
        <div className="fixed bottom-4 left-4 bg-gray-800 text-gray-200 p-3 rounded-lg shadow-lg z-50 flex items-center gap-2 border border-gray-700">
          <span className="text-gray-400">/</span>
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
            className="bg-transparent border-none outline-none text-gray-200 placeholder-gray-500 w-64"
            placeholder="Search tasks..."
          />
          {searchResults.length > 0 && (
            <span className="text-sm text-gray-400 bg-gray-700 px-2 py-1 rounded">
              {currentMatchIndex + 1}/{searchResults.length}
            </span>
          )}
        </div>
      )}
      {isSearchActive && !isSearchMode && searchResults.length > 0 && (
        <div className="fixed bottom-4 left-4 bg-gray-800 text-gray-200 p-3 rounded-lg shadow-lg z-50 border border-gray-700">
          <span className="text-sm">
            <span className="text-gray-400">
              {currentMatchIndex + 1}/{searchResults.length}
            </span>
            <span className="mx-2 text-gray-500">matches for</span>
            <span className="text-gray-200">"{searchQuery}"</span>
          </span>
        </div>
      )}
    </div>
  );
};
