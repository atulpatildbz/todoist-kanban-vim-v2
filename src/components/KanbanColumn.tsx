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
      className="flex-1 min-w-[300px] max-w-[400px] bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-200">{title}</h2>
        <span className="text-sm text-gray-400 bg-gray-700/50 px-2 py-1 rounded-lg">
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-col gap-3">
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
              className={`group bg-gray-700/50 backdrop-blur-sm p-4 rounded-lg shadow-sm hover:shadow-md transition-all cursor-move border ${
                isSelected
                  ? "border-blue-500/50 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/20"
                  : "border-gray-600/50 hover:border-gray-500/50"
              } ${
                isCurrentMatch
                  ? "ring-2 ring-yellow-500/50"
                  : isSearchMatch
                  ? "ring-1 ring-yellow-500/30"
                  : ""
              }`}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-gray-100 flex-1 font-medium group-hover:text-white transition-colors">
                    {task.content}
                  </span>
                  {task.priority > 1 && (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      task.priority === 4
                        ? "bg-red-500/20 text-red-300"
                        : task.priority === 3
                        ? "bg-orange-500/20 text-orange-300"
                        : "bg-yellow-500/20 text-yellow-300"
                    }`}>
                      P{task.priority}
                    </span>
                  )}
                </div>
                {task.due && (
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-gray-400">
                      {new Date(task.due.date).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {task.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {task.labels
                      .filter((label) => !label.startsWith("KANBAN_"))
                      .map((label) => (
                        <span
                          key={label}
                          className="px-2 py-1 text-xs rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20"
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
