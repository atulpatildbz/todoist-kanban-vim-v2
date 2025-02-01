import React from "react";
import { KanbanTask, KanbanColumn as KanbanColumnType } from "../types";

interface KanbanColumnProps {
  title: string;
  tasks: KanbanTask[];
  onTaskMove: (taskId: string) => void;
  selectedTaskId: string | null;
  onTaskSelect: (taskId: string | null) => void;
  columnType: KanbanColumnType;
  searchResults?: KanbanTask[];
  currentMatchIndex?: number;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title,
  tasks,
  onTaskMove,
  selectedTaskId,
  onTaskSelect,
  columnType,
  searchResults = [],
  currentMatchIndex = 0,
}) => {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    onTaskMove(taskId);
  };

  return (
    <div
      className="flex-1 min-w-[250px] max-w-[350px] bg-gray-100 dark:bg-gray-800 rounded-lg p-4"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <h2 className="text-lg font-bold mb-4 text-gray-100">{title}</h2>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => {
          const isSelected = task.id === selectedTaskId;
          const isSearchMatch = searchResults.some((t) => t.id === task.id);
          const isCurrentMatch =
            isSearchMatch && searchResults[currentMatchIndex]?.id === task.id;

          return (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", task.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => onTaskSelect(task.id === selectedTaskId ? null : task.id)}
              className={`bg-gray-700 p-4 rounded shadow-sm hover:shadow-md transition-all cursor-move border ${
                isSelected
                  ? "border-blue-500 shadow-lg transform scale-105"
                  : "border-gray-600 hover:border-gray-500"
              } ${
                isCurrentMatch
                  ? "ring-2 ring-yellow-500"
                  : isSearchMatch
                  ? "ring-1 ring-yellow-500/50"
                  : ""
              }`}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <span className="text-gray-100 flex-1">{task.content}</span>
                  {task.priority > 1 && (
                    <span className="text-red-500 ml-2">P{task.priority}</span>
                  )}
                </div>
                {task.due && (
                  <div className="text-sm text-gray-400">
                    Due: {new Date(task.due.date).toLocaleDateString()}
                  </div>
                )}
                {task.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {task.labels
                      .filter((label) => !label.startsWith("KANBAN_"))
                      .map((label) => (
                        <span
                          key={label}
                          className="px-2 py-1 text-xs rounded bg-gray-600 text-gray-300"
                        >
                          {label}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
