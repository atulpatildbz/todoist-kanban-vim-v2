import React from 'react';
import { KanbanTask } from '../types';

interface KanbanColumnProps {
  title: string;
  tasks: KanbanTask[];
  selectedTaskId: string | null;
  onTaskSelect: (taskId: string | null) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ 
  title, 
  tasks, 
  selectedTaskId, 
  onTaskSelect 
}) => {
  return (
    <div className="flex flex-col w-72 bg-gray-800 rounded-lg p-4">
      <h2 className="text-lg font-bold mb-4 text-gray-100">{title}</h2>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => onTaskSelect(selectedTaskId === task.id ? null : task.id)}
            className={`bg-gray-700 p-4 rounded shadow-sm hover:shadow-md transition-all cursor-pointer border ${
              selectedTaskId === task.id 
                ? 'border-blue-500 shadow-lg transform scale-105' 
                : 'border-gray-600 hover:border-gray-500'
            }`}
          >
            <div className="text-sm font-medium text-gray-100">{task.content}</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {task.labels.map((label) => (
                <span
                  key={`${task.id}-${label}`}
                  className="text-xs px-2 py-1 bg-blue-900 text-blue-100 rounded"
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Priority: {task.priority}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 