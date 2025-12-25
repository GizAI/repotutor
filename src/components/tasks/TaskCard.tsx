import React from 'react';
import { Clock, CheckCircle, Circle, AlertCircle, Pause, X, ArrowRight, ChevronUp, Minus, Flag } from 'lucide-react';

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

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  showParent?: boolean;
  className?: string;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onClick,
  showParent = false,
  className = ''
}) => {
  const getStatusConfig = (status: Task['status']) => {
    switch (status) {
      case 'done':
        return {
          icon: CheckCircle,
          bgColor: 'bg-green-50 dark:bg-green-950',
          borderColor: 'border-green-200 dark:border-green-800',
          iconColor: 'text-green-600 dark:text-green-400',
          textColor: 'text-green-900 dark:text-green-100',
          statusText: 'Done'
        };

      case 'in-progress':
        return {
          icon: Clock,
          bgColor: 'bg-blue-50 dark:bg-blue-950',
          borderColor: 'border-blue-200 dark:border-blue-800',
          iconColor: 'text-blue-600 dark:text-blue-400',
          textColor: 'text-blue-900 dark:text-blue-100',
          statusText: 'In Progress'
        };

      case 'review':
        return {
          icon: AlertCircle,
          bgColor: 'bg-amber-50 dark:bg-amber-950',
          borderColor: 'border-amber-200 dark:border-amber-800',
          iconColor: 'text-amber-600 dark:text-amber-400',
          textColor: 'text-amber-900 dark:text-amber-100',
          statusText: 'Review'
        };

      case 'deferred':
        return {
          icon: Pause,
          bgColor: 'bg-gray-50 dark:bg-gray-800',
          borderColor: 'border-gray-200 dark:border-gray-700',
          iconColor: 'text-gray-500 dark:text-gray-400',
          textColor: 'text-gray-700 dark:text-gray-300',
          statusText: 'Deferred'
        };

      case 'cancelled':
        return {
          icon: X,
          bgColor: 'bg-red-50 dark:bg-red-950',
          borderColor: 'border-red-200 dark:border-red-800',
          iconColor: 'text-red-600 dark:text-red-400',
          textColor: 'text-red-900 dark:text-red-100',
          statusText: 'Cancelled'
        };

      case 'pending':
      default:
        return {
          icon: Circle,
          bgColor: 'bg-slate-50 dark:bg-slate-800',
          borderColor: 'border-slate-200 dark:border-slate-700',
          iconColor: 'text-slate-500 dark:text-slate-400',
          textColor: 'text-slate-900 dark:text-slate-100',
          statusText: 'Pending'
        };
    }
  };

  const config = getStatusConfig(task.status);
  const Icon = config.icon;

  const getPriorityIcon = (priority?: Task['priority']) => {
    switch (priority) {
      case 'high':
        return (
          <div className="w-4 h-4 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center" title="High Priority">
            <ChevronUp className="w-2.5 h-2.5 text-red-600 dark:text-red-400" />
          </div>
        );
      case 'medium':
        return (
          <div className="w-4 h-4 bg-amber-100 dark:bg-amber-900/30 rounded flex items-center justify-center" title="Medium Priority">
            <Minus className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
          </div>
        );
      case 'low':
        return (
          <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center" title="Low Priority">
            <Circle className="w-1.5 h-1.5 text-blue-600 dark:text-blue-400 fill-current" />
          </div>
        );
      default:
        return (
          <div className="w-4 h-4 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center" title="No Priority Set">
            <Circle className="w-1.5 h-1.5 text-gray-400 dark:text-gray-500" />
          </div>
        );
    }
  };

  const completedSubtasks = task.subtasks?.filter(st => st.status === 'done').length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 p-3 space-y-3 ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''} ${className}`}
      onClick={onClick}
    >
      {/* Header with Task ID, Title, and Priority */}
      <div className="flex items-start justify-between gap-2 mb-2">
        {/* Task ID and Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded" title={`Task ID: ${task.id}`}>
              {task.id}
            </span>
          </div>
          <h3 className="font-medium text-sm text-gray-900 dark:text-white line-clamp-2 leading-tight">
            {task.title}
          </h3>
          {showParent && task.parentId && (
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Task {task.parentId}
            </span>
          )}
        </div>

        {/* Priority Icon */}
        <div className="flex-shrink-0">
          {getPriorityIcon(task.priority)}
        </div>
      </div>

      {/* Footer with Dependencies and Status */}
      <div className="flex items-center justify-between">
        {/* Dependencies */}
        <div className="flex items-center">
          {task.dependencies && Array.isArray(task.dependencies) && task.dependencies.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400" title={`Depends on: ${task.dependencies.map(dep => `Task ${dep}`).join(', ')}`}>
              <ArrowRight className="w-3 h-3" />
              <span>Depends on: {task.dependencies.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-1" title={`Status: ${config.statusText}`}>
          <div className={`w-2 h-2 rounded-full ${config.iconColor.replace('text-', 'bg-')}`} />
          <span className={`text-xs font-medium ${config.textColor}`}>
            {config.statusText}
          </span>
        </div>
      </div>

      {/* Subtask Progress */}
      {totalSubtasks > 0 && (
        <div className="ml-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">Progress:</span>
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5" title={`${completedSubtasks} of ${totalSubtasks} subtasks completed`}>
              <div
                className={`h-full rounded-full transition-all duration-300 ${task.status === 'done' ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{
                  width: `${Math.round((completedSubtasks / totalSubtasks) * 100)}%`
                }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400" title={`${completedSubtasks} completed, ${totalSubtasks - completedSubtasks} remaining`}>
              {completedSubtasks}/{totalSubtasks}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskCard;
