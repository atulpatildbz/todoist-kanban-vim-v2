import React, { useEffect, useRef, useState } from "react";
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

export const FilterBar: React.FC<FilterBarProps> = ({
  todoistService,
  selectedProjects,
  selectedLabels,
  onProjectsChange,
  onLabelsChange,
  isOpen,
  onClose,
}) => {
  const { data: projectsResponse } = useQuery({
    queryKey: ["projects"],
    queryFn: () => todoistService.getProjects(),
  });

  const { data: labelsResponse } = useQuery({
    queryKey: ["labels"],
    queryFn: () => todoistService.getLabels(),
  });

  const projects = projectsResponse?.results || [];
  const labels = labelsResponse?.results || [];
  const [focusedSection, setFocusedSection] = useState<"projects" | "labels">(
    "projects"
  );
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const projectsRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);

  const toggleProject = (projectId: string) => {
    if (selectedProjects.includes(projectId)) {
      onProjectsChange(selectedProjects.filter((id) => id !== projectId));
    } else {
      onProjectsChange([...selectedProjects, projectId]);
    }
  };

  const toggleLabel = (labelId: string) => {
    if (selectedLabels.includes(labelId)) {
      onLabelsChange(selectedLabels.filter((id) => id !== labelId));
    } else {
      onLabelsChange([...selectedLabels, labelId]);
    }
  };

  const clearAllFilters = () => {
    onProjectsChange([]);
    onLabelsChange([]);
  };

  const performSearch = (query: string, forward = true) => {
    const items =
      focusedSection === "projects"
        ? projects
        : labels.filter((l) => !l.name.startsWith("KANBAN_"));

    const matches = items
      .map((item, index) => ({ index, name: item.name.toLowerCase() }))
      .filter((item) => item.name.includes(query.toLowerCase()))
      .map((item) => item.index);

    setSearchMatches(matches);

    if (matches.length > 0) {
      const nextIndex = forward ? 0 : matches.length - 1;
      setCurrentMatchIndex(nextIndex);
      setFocusedIndex(matches[nextIndex]);
    }
  };

  const cycleSearch = (forward = true) => {
    if (searchMatches.length === 0) return;

    const nextIndex = forward
      ? (currentMatchIndex + 1) % searchMatches.length
      : currentMatchIndex === 0
      ? searchMatches.length - 1
      : currentMatchIndex - 1;

    setCurrentMatchIndex(nextIndex);
    setFocusedIndex(searchMatches[nextIndex]);
  };

  // Auto-scroll when focused item changes
  useEffect(() => {
    const currentRef =
      focusedSection === "projects" ? projectsRef.current : labelsRef.current;
    const items = currentRef?.getElementsByTagName("button");
    if (!items || !items[focusedIndex]) return;

    items[focusedIndex].scrollIntoView({
      behavior: "auto",
      block: "nearest",
    });
  }, [focusedIndex, focusedSection]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (searchMode) {
        if (e.key === "Escape") {
          setSearchMode(false);
          setSearchQuery("");
          e.preventDefault();
          return;
        }

        if (e.key === "Enter") {
          setSearchMode(false);
          performSearch(searchQuery);
          e.preventDefault();
          return;
        }

        if (e.key === "Backspace") {
          setSearchQuery((prev) => prev.slice(0, -1));
          e.preventDefault();
          return;
        }

        if (e.key.length === 1) {
          setSearchQuery((prev) => prev + e.key);
          e.preventDefault();
          return;
        }

        return;
      }

      e.preventDefault();

      switch (e.key) {
        case "C":
          clearAllFilters();
          break;
        case "/":
          setSearchMode(true);
          setSearchQuery("");
          break;
        case "n":
          if (searchMatches.length > 0) {
            cycleSearch(true);
          }
          break;
        case "N":
          if (searchMatches.length > 0) {
            cycleSearch(false);
          }
          break;
        case "Escape":
          onClose();
          break;
        case "Tab":
          setFocusedSection((prev) =>
            prev === "projects" ? "labels" : "projects"
          );
          setFocusedIndex(0);
          setSearchMatches([]);
          setSearchQuery("");
          break;
        case "ArrowDown":
        case "j":
          setFocusedIndex((prev) => {
            const items =
              focusedSection === "projects"
                ? projects
                : labels.filter((l) => !l.name.startsWith("KANBAN_"));
            return (prev + 1) % items.length;
          });
          break;
        case "ArrowUp":
        case "k":
          setFocusedIndex((prev) => {
            const items =
              focusedSection === "projects"
                ? projects
                : labels.filter((l) => !l.name.startsWith("KANBAN_"));
            return prev === 0 ? items.length - 1 : prev - 1;
          });
          break;
        case " ":
          if (focusedSection === "projects") {
            toggleProject(projects[focusedIndex].id);
          } else {
            const filteredLabels = labels.filter(
              (l) => !l.name.startsWith("KANBAN_")
            );
            toggleLabel(filteredLabels[focusedIndex].id);
          }
          break;
        case "Enter":
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    focusedSection,
    focusedIndex,
    projects,
    labels,
    toggleProject,
    toggleLabel,
    searchMode,
    searchQuery,
    searchMatches,
    currentMatchIndex,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-[800px] max-h-[80vh] overflow-hidden">
        <h2 className="text-xl font-bold mb-6 text-gray-100">Filter Tasks</h2>
        {searchMode && (
          <div className="mb-4 px-3 py-2 bg-gray-700 text-gray-200 rounded">
            /{searchQuery}
          </div>
        )}
        <div className="flex gap-8 h-[calc(80vh-200px)]">
          <div
            className={`flex-1 ${
              focusedSection === "projects"
                ? "ring-2 ring-blue-500 rounded-lg p-2"
                : ""
            }`}
          >
            <h3 className="text-gray-200 font-semibold mb-2">
              Projects (Tab to switch)
            </h3>
            <div
              ref={projectsRef}
              className="flex flex-col gap-2 overflow-y-auto h-[calc(100%-2rem)] pb-2"
            >
              {projects.map((project: Project, index) => (
                <button
                  key={project.id}
                  className={`px-3 py-2 rounded text-left ${
                    selectedProjects.includes(project.id)
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-200"
                  } ${
                    focusedSection === "projects" && focusedIndex === index
                      ? "outline outline-2 outline-yellow-500"
                      : ""
                  } ${
                    searchMatches.includes(index)
                      ? "border-l-4 border-green-500"
                      : ""
                  }`}
                >
                  {project.name}
                </button>
              ))}
            </div>
          </div>
          <div
            className={`flex-1 ${
              focusedSection === "labels"
                ? "ring-2 ring-blue-500 rounded-lg p-2"
                : ""
            }`}
          >
            <h3 className="text-gray-200 font-semibold mb-2">
              Labels (Tab to switch)
            </h3>
            <div
              ref={labelsRef}
              className="flex flex-col gap-2 overflow-y-auto h-[calc(100%-2rem)] pb-2"
            >
              {labels
                .filter((label: Label) => !label.name.startsWith("KANBAN_"))
                .map((label: Label, index) => (
                  <button
                    key={label.id}
                    className={`px-3 py-2 rounded text-left ${
                      selectedLabels.includes(label.id)
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-200"
                    } ${
                      focusedSection === "labels" && focusedIndex === index
                        ? "outline outline-2 outline-yellow-500"
                        : ""
                    } ${
                      searchMatches.includes(index)
                        ? "border-l-4 border-green-500"
                        : ""
                    }`}
                  >
                    {label.name}
                  </button>
                ))}
            </div>
          </div>
        </div>
        <div className="mt-6 text-gray-300 text-sm">
          <p>Keyboard shortcuts:</p>
          <ul className="list-disc list-inside mt-1">
            <li>Tab - Switch between Projects and Labels</li>
            <li>j/↓ - Move down</li>
            <li>k/↑ - Move up</li>
            <li>Space - Toggle selection</li>
            <li>Enter - Close filter</li>
            <li>/ - Search</li>
            <li>n/N - Next/Previous match</li>
            <li>C - Clear all filters</li>
            <li>Esc - Exit search or close filters</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
