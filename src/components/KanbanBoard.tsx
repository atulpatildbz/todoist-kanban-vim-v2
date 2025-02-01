import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { TodoistService } from '../services/todoistService';
import { KanbanColumn } from './KanbanColumn';
import { KanbanTask, KanbanColumn as KanbanColumnType } from '../types';

interface KanbanBoardProps {
  apiToken: string;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ apiToken }) => {
  const todoistService = new TodoistService(apiToken);

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => todoistService.getTasks(),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-xl">Loading tasks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-xl text-red-600">Error loading tasks</div>
      </div>
    );
  }

  const columns: KanbanColumnType[] = ['NOT_SET', 'TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
  
  const getTasksByColumn = (column: KanbanColumnType): KanbanTask[] => {
    return tasks.filter((task) => task.column === column);
  };

  const getColumnTitle = (column: KanbanColumnType): string => {
    return column.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  return (
    <div className="min-h-screen bg-gray-200 p-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Todoist Kanban Board</h1>
      <div className="flex gap-6 overflow-x-auto pb-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column}
            title={getColumnTitle(column)}
            tasks={getTasksByColumn(column)}
          />
        ))}
      </div>
    </div>
  );
}; 