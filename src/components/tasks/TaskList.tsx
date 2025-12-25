import React, { useState, useMemo } from 'react';
import { Search, Filter, List, Grid, Columns, ChevronDown } from 'lucide-react';
import TaskCard from './TaskCard';

interface Task {
  id: string | number;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'review' | 'deferred' | 'cancelled' | 'done';
  priority?: 'high' | 'medium' | 'low';
  parentId?: string | number;
  dependencies?: (string | number)[];
  subtasks?: Task[];
}

interface TaskListProps {
  tasks?: Task[];
  onTaskClick?: (task: Task) => void;
  className?: string;
  showParentTasks?: boolean;
  defaultView?: 'list' | 'grid' | 'kanban';
}

const TaskList: React.FC<TaskListProps> = ({
  tasks = [],
  onTaskClick,
  className = '',
  showParentTasks = false,
  defaultView = 'kanban'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'kanban'>(defaultView);
  const [showFilters, setShowFilters] = useState(false);

  // Get unique status and priority values
  const statuses = useMemo(() => {
    const statusSet = new Set(tasks.map(task => task.status));
    return Array.from(statusSet).sort();
  }, [tasks]);

  const priorities = useMemo(() => {
    const prioritySet = new Set(
      tasks.map(task => task.priority).filter((p): p is NonNullable<typeof p> => Boolean(p))
    );
    return Array.from(prioritySet).sort();
  }, [tasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        task.title.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower) ||
        task.id.toString().includes(searchLower);

      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, searchTerm, statusFilter, priorityFilter]);

  // Organize tasks by status for Kanban view
  const kanbanColumns = useMemo(() => {
    const allColumns = [
      {
        id: 'pending',
        title: '📋 To Do',
        status: 'pending',
        color: 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700',
        headerColor: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
      },
      {
        id: 'in-progress',
        title: '🚀 In Progress',
        status: 'in-progress',
        color: 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-700',
        headerColor: 'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
      },
      {
        id: 'done',
        title: '✅ Done',
        status: 'done',
        color: 'bg-emerald-50 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-700',
        headerColor: 'bg-emerald-100 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200'
      }
    ];

    const mainWorkflowStatuses = ['pending', 'in-progress', 'done'];
    const columnsWithTasks = allColumns.filter(column => {
      const hasTask = filteredTasks.some(task => task.status === column.status);
      const isMainWorkflow = mainWorkflowStatuses.includes(column.status);
      return hasTask || isMainWorkflow;
    });

    return columnsWithTasks.map(column => ({
      ...column,
      tasks: filteredTasks.filter(task => task.status === column.status)
    }));
  }, [filteredTasks]);

  if (tasks.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="max-w-md mx-auto">
          <div className="text-blue-600 dark:text-blue-400 mb-4">
            <Grid className="w-12 h-12 mx-auto mb-4" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No tasks yet
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Create your first task to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header Controls */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
              title="Kanban view"
            >
              <Columns className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
              title="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>

          {/* Filters Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${showFilters ? 'bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                {statuses.map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priority
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Priorities</option>
                {priorities.map(priority => (
                  <option key={priority} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredTasks.length} of {tasks.length} tasks
            </div>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setPriorityFilter('all');
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Task Cards */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No tasks match your filters</h3>
            <p className="text-sm">Try adjusting your search or filter criteria.</p>
          </div>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className={`grid gap-6 ${kanbanColumns.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : kanbanColumns.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {kanbanColumns.map((column) => (
            <div key={column.id} className={`rounded-xl border shadow-sm transition-shadow hover:shadow-md ${column.color}`}>
              <div className={`px-4 py-3 rounded-t-xl border-b ${column.headerColor}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">
                    {column.title}
                  </h3>
                  <span className="text-xs font-medium px-2 py-1 bg-white/60 dark:bg-black/20 rounded-full">
                    {column.tasks.length}
                  </span>
                </div>
              </div>

              <div className="p-3 space-y-3 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto">
                {column.tasks.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                    <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                    </div>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      No tasks yet
                    </div>
                  </div>
                ) : (
                  column.tasks.map((task) => (
                    <div key={task.id} className="transform transition-transform hover:scale-[1.02]">
                      <TaskCard
                        task={task}
                        onClick={() => onTaskClick?.(task)}
                        showParent={showParentTasks}
                        className="w-full shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-4'}>
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick?.(task)}
              showParent={showParentTasks}
              className={viewMode === 'grid' ? 'h-full' : ''}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskList;
