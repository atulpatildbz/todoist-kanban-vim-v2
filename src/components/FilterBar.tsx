import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { TodoistService } from "../services/todoistService";
import { Project, Label } from "@doist/todoist-api-typescript";

interface FilterBarProps {
  todoistService: TodoistService;
  selectedProjects: string[];
  selectedLabels: string[];
  onProjectsChange: (projects: string[]) => void;
  onLabelsChange: (labels: string[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

type ViewType = "projects" | "labels";

export const FilterBar: React.FC<FilterBarProps> = ({
  todoistService,
  selectedProjects,
  selectedLabels,
  onProjectsChange,
  onLabelsChange,
  isOpen,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentView, setCurrentView] = useState<ViewType>("projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => todoistService.getProjects(),
  });

  const { data: labels = [] } = useQuery<Label[]>({
    queryKey: ["labels"],
    queryFn: () => todoistService.getLabels(),
  });

  const nonKanbanLabels = labels.filter(
    (l) => !l.name.startsWith("KANBAN_")
  );

  const filteredItems = useMemo(() => {
    const items = currentView === "projects" ? projects : nonKanbanLabels;
    if (!searchQuery) return items;

    const query = searchQuery.toLowerCase();
    return items.filter(item => 
      item.name.toLowerCase().includes(query)
    );
  }, [currentView, projects, nonKanbanLabels, searchQuery]);

  const handleToggleItem = useCallback(
    (item: Project | Label) => {
      if ("id" in item && currentView === "projects") {
        onProjectsChange(
          selectedProjects.includes(item.id)
            ? selectedProjects.filter((id) => id !== item.id)
            : [...selectedProjects, item.id]
        );
      } else if ("name" in item && currentView === "labels") {
        onLabelsChange(
          selectedLabels.includes(item.name)
            ? selectedLabels.filter((name) => name !== item.name)
            : [...selectedLabels, item.name]
        );
      }
    },
    [selectedProjects, selectedLabels, onProjectsChange, onLabelsChange, currentView]
  );

  const resetFilters = useCallback(() => {
    onProjectsChange([]);
    onLabelsChange([]);
  }, [onProjectsChange, onLabelsChange]);

  const handleSearch = useCallback(
    (forward: boolean) => {
      if (!searchQuery || filteredItems.length === 0) return;

      const nextIndex = forward
        ? (searchMatchIndex + 1) % filteredItems.length
        : (searchMatchIndex - 1 + filteredItems.length) % filteredItems.length;

      setSearchMatchIndex(nextIndex);
      setSelectedIndex(nextIndex);
    },
    [searchQuery, filteredItems, searchMatchIndex]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Stop propagation for all keyboard events when filter is open
      e.stopPropagation();

      if (isSearchMode) {
        switch (e.key) {
          case "Enter":
            e.preventDefault();
            setIsSearchMode(false);
            break;
          case "Escape":
            e.preventDefault();
            setIsSearchMode(false);
            setSearchQuery("");
            break;
          default:
            return;
        }
        return;
      }

      switch (e.key) {
        case "j":
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, filteredItems.length - 1)
          );
          break;
        case "k":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "h":
          e.preventDefault();
          if (currentView === "labels") {
            setCurrentView("projects");
            setSelectedIndex(0);
            setSearchQuery("");
          }
          break;
        case "l":
          e.preventDefault();
          if (currentView === "projects") {
            setCurrentView("labels");
            setSelectedIndex(0);
            setSearchQuery("");
          }
          break;
        case " ":
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            handleToggleItem(filteredItems[selectedIndex]);
          }
          break;
        case "Enter":
          e.preventDefault();
          onClose();
          break;
        case "C":
          e.preventDefault();
          resetFilters();
          break;
        case "Escape":
          e.preventDefault();
          if (searchQuery) {
            setSearchQuery("");
            setSearchMatchIndex(0);
          } else {
            onClose();
          }
          break;
        case "/":
          e.preventDefault();
          setIsSearchMode(true);
          break;
        case "n":
          e.preventDefault();
          if (searchQuery) {
            handleSearch(!e.shiftKey);
          }
          break;
      }
    },
    [
      filteredItems,
      selectedIndex,
      handleToggleItem,
      onClose,
      resetFilters,
      searchQuery,
      isSearchMode,
      handleSearch,
      currentView,
    ]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      setCurrentView("projects");
      setSearchQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isSearchMode && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800/95 p-8 rounded-xl shadow-2xl w-[600px] max-h-[80vh] border border-gray-700/50 relative transform transition-all">
        <div className="flex flex-col mb-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              {currentView === "projects" ? "Filter Projects" : "Filter Labels"}
            </h2>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentView("projects")}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  currentView === "projects"
                    ? "bg-blue-500/20 text-blue-400"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Projects (h)
              </button>
              <button
                onClick={() => setCurrentView("labels")}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  currentView === "labels"
                    ? "bg-purple-500/20 text-purple-400"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Labels (l)
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-200 transition-colors"
                aria-label="Close"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className="text-sm text-gray-400 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">j/k</kbd>
              <span>move</span>
            </span>
            <span className="text-gray-500">•</span>
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">h/l</kbd>
              <span>switch view</span>
            </span>
            <span className="text-gray-500">•</span>
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">space</kbd>
              <span>toggle</span>
            </span>
            <span className="text-gray-500">•</span>
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">/</kbd>
              <span>search</span>
            </span>
            <span className="text-gray-500">•</span>
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">n/N</kbd>
              <span>next/prev</span>
            </span>
          </div>
        </div>

        {isSearchMode && (
          <div className="mb-4 flex items-center gap-2 bg-gray-700/50 p-2 rounded-lg">
            <span className="text-gray-400">/</span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchMatchIndex(0);
                setSelectedIndex(0);
              }}
              className="flex-1 bg-transparent border-none outline-none text-gray-200"
              placeholder={`Search ${currentView}...`}
            />
            {filteredItems.length > 0 && searchQuery && (
              <span className="text-sm text-gray-400 bg-gray-600/50 px-2 py-1 rounded">
                {searchMatchIndex + 1}/{filteredItems.length}
              </span>
            )}
          </div>
        )}

        <div
          className="overflow-y-auto max-h-[60vh] pr-4 -mr-4"
          ref={containerRef}
        >
          <div className="space-y-1">
            {filteredItems.map((item: Project | Label, index) => {
              const isProject = currentView === "projects";
              const itemId = isProject ? (item as Project).id : (item as Label).name;
              const isSelected = isProject
                ? selectedProjects.includes(itemId)
                : selectedLabels.includes(itemId);

              return (
                <div
                  key={itemId}
                  data-index={index}
                  className={`flex items-center space-x-3 p-2.5 rounded-lg transition-colors ${
                    selectedIndex === index
                      ? "bg-gray-600/80 shadow-lg"
                      : isSelected
                      ? "bg-gray-700/60"
                      : "hover:bg-gray-700/40"
                  }`}
                >
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className={`rounded border-gray-600 focus:ring-opacity-50 bg-gray-700/80 ${
                        isProject
                          ? "text-blue-500 focus:ring-blue-500"
                          : "text-purple-500 focus:ring-purple-500"
                      }`}
                    />
                    {isSelected && (
                      <div
                        className={`absolute inset-0 rounded animate-pulse ${
                          isProject ? "bg-blue-500/20" : "bg-purple-500/20"
                        }`}
                      />
                    )}
                  </div>
                  <span className="text-gray-200 font-medium">{item.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
