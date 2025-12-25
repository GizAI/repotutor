'use client';

import React from 'react';
import { MessageSquare, Folder, Terminal, GitBranch, CheckSquare, LucideIcon } from 'lucide-react';

interface NavItem {
  id: string;
  icon: LucideIcon;
  onClick: () => void;
}

interface MobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isInputFocused?: boolean;
  tasksEnabled?: boolean;
}

const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  setActiveTab,
  isInputFocused = false,
  tasksEnabled = false
}) => {
  const navItems: NavItem[] = [
    {
      id: 'chat',
      icon: MessageSquare,
      onClick: () => setActiveTab('chat')
    },
    {
      id: 'shell',
      icon: Terminal,
      onClick: () => setActiveTab('shell')
    },
    {
      id: 'files',
      icon: Folder,
      onClick: () => setActiveTab('files')
    },
    {
      id: 'git',
      icon: GitBranch,
      onClick: () => setActiveTab('git')
    },
    ...(tasksEnabled ? [{
      id: 'tasks',
      icon: CheckSquare,
      onClick: () => setActiveTab('tasks')
    }] : [])
  ];

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 ios-bottom-safe transform transition-transform duration-300 ease-in-out shadow-lg ${
        isInputFocused ? 'translate-y-full' : 'translate-y-0'
      }`}
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderTopWidth: '1px',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="flex items-center justify-around py-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={item.onClick}
              onTouchStart={(e) => {
                e.preventDefault();
                item.onClick();
              }}
              className={`flex items-center justify-center p-2 rounded-lg min-h-[40px] min-w-[40px] relative touch-manipulation`}
              style={{
                color: isActive ? '#3b82f6' : 'var(--text-secondary)',
              }}
              aria-label={item.id}
            >
              <Icon className="w-5 h-5" />
              {isActive && (
                <div
                  className="absolute top-0 left-1/2 transform -translate-x-1/2 w-6 h-0.5 rounded-full"
                  style={{ backgroundColor: '#3b82f6' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileNav;
