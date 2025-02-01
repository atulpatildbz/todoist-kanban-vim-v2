import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TodoistService } from '../services/todoistService';
import { Project, Label } from '@doist/todoist-api-typescript';

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
    queryKey: ['projects'],
    queryFn: () => todoistService.getProjects(),
  });

  const { data: labelsResponse } = useQuery({
    queryKey: ['labels'],
    queryFn: () => todoistService.getLabels(),
  });

  const projects = projectsResponse?.results || [];
  const labels = labelsResponse?.results || [];
  const [focusedSection, setFocusedSection] = React.useState<'projects' | 'labels'>('projects');
  const [focusedIndex, setFocusedIndex] = React.useState(0);

  const toggleProject = (projectId: string) => {
    if (selectedProjects.includes(projectId)) {
      onProjectsChange(selectedProjects.filter(id => id !== projectId));
    } else {
      onProjectsChange([...selectedProjects, projectId]);
    }
  };

  const toggleLabel = (labelId: string) => {
    if (selectedLabels.includes(labelId)) {
      onLabelsChange(selectedLabels.filter(id => id !== labelId));
    } else {
      onLabelsChange([...selectedLabels, labelId]);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'Tab':
          e.preventDefault();
          setFocusedSection(prev => prev === 'projects' ? 'labels' : 'projects');
          setFocusedIndex(0);
          break;
        case 'ArrowDown':
        case 'j':
          setFocusedIndex(prev => {
            const items = focusedSection === 'projects' ? projects : labels.filter(l => !l.name.startsWith('KANBAN_'));
            return (prev + 1) % items.length;
          });
          break;
        case 'ArrowUp':
        case 'k':
          setFocusedIndex(prev => {
            const items = focusedSection === 'projects' ? projects : labels.filter(l => !l.name.startsWith('KANBAN_'));
            return prev === 0 ? items.length - 1 : prev - 1;
          });
          break;
        case ' ':
        case 'Enter':
          if (focusedSection === 'projects') {
            toggleProject(projects[focusedIndex].id);
          } else {
            const filteredLabels = labels.filter(l => !l.name.startsWith('KANBAN_'));
            toggleLabel(filteredLabels[focusedIndex].id);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, focusedSection, focusedIndex, projects, labels, toggleProject, toggleLabel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-[800px] max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-6 text-gray-100">Filter Tasks</h2>
        <div className="flex gap-8">
          <div className={`flex-1 ${focusedSection === 'projects' ? 'ring-2 ring-blue-500 rounded-lg p-2' : ''}`}>
            <h3 className="text-gray-200 font-semibold mb-2">Projects (Tab to switch)</h3>
            <div className="flex flex-col gap-2">
              {projects.map((project: Project, index) => (
                <button
                  key={project.id}
                  className={`px-3 py-2 rounded text-left ${
                    selectedProjects.includes(project.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-200'
                  } ${focusedSection === 'projects' && focusedIndex === index ? 'ring-2 ring-yellow-500' : ''}`}
                >
                  {project.name}
                </button>
              ))}
            </div>
          </div>
          <div className={`flex-1 ${focusedSection === 'labels' ? 'ring-2 ring-blue-500 rounded-lg p-2' : ''}`}>
            <h3 className="text-gray-200 font-semibold mb-2">Labels (Tab to switch)</h3>
            <div className="flex flex-col gap-2">
              {labels
                .filter((label: Label) => !label.name.startsWith('KANBAN_'))
                .map((label: Label, index) => (
                  <button
                    key={label.id}
                    className={`px-3 py-2 rounded text-left ${
                      selectedLabels.includes(label.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-200'
                    } ${focusedSection === 'labels' && focusedIndex === index ? 'ring-2 ring-yellow-500' : ''}`}
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
            <li>Space/Enter - Toggle selection</li>
            <li>Esc - Close filters</li>
          </ul>
        </div>
      </div>
    </div>
  );
}; 