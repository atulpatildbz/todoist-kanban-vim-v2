import React from 'react';
import { KanbanTask } from '../types';

interface KanbanColumnProps {
  title: string;
  tasks: KanbanTask[];
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ title, tasks }) => {
  return (
    <div className="flex flex-col w-72 bg-gray-100 rounded-lg p-4">
      <h2 className="text-lg font-bold mb-4">{title}</h2>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="bg-white p-4 rounded shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="text-sm font-medium">{task.content}</div>
            <div className="flex gap-2 mt-2">
              {task.labels.map((label) => (
                <span
                  key={`${task.id}-${label}`}
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded"
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Priority: {task.priority}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 