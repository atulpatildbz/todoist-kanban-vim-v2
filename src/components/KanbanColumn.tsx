import React from "react";
import { KanbanTask, KanbanColumn as KanbanColumnType } from "../types";

interface KanbanColumnProps {
  title: string;
  tasks: KanbanTask[];
  selectedTaskId: string | null;
  onTaskSelect: (taskId: string | null) => void;
  onTaskMove: (taskId: string, targetColumn: KanbanColumnType) => void;
  columnType: KanbanColumnType;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title,
  tasks,
  selectedTaskId,
  onTaskSelect,
  onTaskMove,
  columnType,
}) => {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const column = e.currentTarget;
    column.classList.add("bg-gray-700");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    const column = e.currentTarget;
    column.classList.remove("bg-gray-700");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const column = e.currentTarget;
    column.classList.remove("bg-gray-700");

    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) {
      onTaskMove(taskId, columnType);
    }
  };

  return (
    <div
      className="flex flex-col w-72 bg-gray-800 rounded-lg p-4 transition-colors duration-200"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <h2 className="text-lg font-bold mb-4 text-gray-100">{title}</h2>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            onClick={() =>
              onTaskSelect(selectedTaskId === task.id ? null : task.id)
            }
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", task.id);
              e.currentTarget.classList.add("opacity-50");
            }}
            onDragEnd={(e) => {
              e.currentTarget.classList.remove("opacity-50");
            }}
            className={`bg-gray-700 p-4 rounded shadow-sm hover:shadow-md transition-all cursor-move border ${
              selectedTaskId === task.id
                ? "border-blue-500 shadow-lg transform scale-105"
                : "border-gray-600 hover:border-gray-500"
            }`}
          >
            <div className="text-sm font-medium text-gray-100">
              {task.content}
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {task.labels
                .filter(label => !label.startsWith('KANBAN_'))
                .map((label) => (
                  <span
                    key={`${task.id}-${label}`}
                    className="text-xs px-2 py-1 bg-blue-900 text-blue-100 rounded"
                  >
                    {label}
                  </span>
                ))}
            </div>
            <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
              <div>Priority: {task.priority}</div>
              {task.due && (
                <div className={`flex items-center gap-1 ${
                  new Date(task.due.datetime || task.due.date) < new Date() 
                    ? 'text-red-400' 
                    : ''
                }`}>
                  <svg className="w-3 h-3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  <span>
                    {task.due.datetime 
                      ? new Date(task.due.datetime).toLocaleString(undefined, { 
                          month: 'short', 
                          day: 'numeric',
                          hour: 'numeric',
                          minute: 'numeric'
                        })
                      : new Date(task.due.date).toLocaleDateString(undefined, { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                    {task.due.isRecurring && ' 🔄'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
