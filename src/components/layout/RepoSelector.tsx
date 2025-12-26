'use client';

import { useState, useEffect, useRef } from 'react';
import { Icon } from '../ui/Icon';

interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
}

interface RepoSelectorProps {
  currentProject?: Project | null;
}

export function RepoSelector({ currentProject: initialProject }: RepoSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(initialProject || null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 프로젝트 목록 로드
  useEffect(() => {
    fetchProjects();
  }, []);

  // 외부 클릭 감지
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAddMode(false);
        setError('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchProjects() {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data.projects || []);
      if (data.currentProject) {
        setCurrentProject(data.currentProject);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  }

  async function switchProject(projectId: string) {
    if (currentProject?.id === projectId) {
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (res.ok) {
        // 페이지 새로고침으로 새 프로젝트 반영
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to switch project:', err);
    } finally {
      setLoading(false);
    }
  }

  async function addProject() {
    if (!newPath.trim()) {
      setError('Project path is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: newPath.trim(),
          name: newName.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to add project');
        return;
      }

      // 새 프로젝트로 전환
      await switchProject(data.project.id);
    } catch (err) {
      setError('Failed to add project');
    } finally {
      setLoading(false);
    }
  }

  async function removeProject(projectId: string, e: React.MouseEvent) {
    e.stopPropagation();

    if (!confirm('Remove this project from the list?')) return;

    try {
      const res = await fetch(`/api/projects?id=${projectId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchProjects();
      }
    } catch (err) {
      console.error('Failed to remove project:', err);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition-colors group"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent)] text-white">
          <Icon name="folder-code" className="h-3.5 w-3.5" />
        </div>
        <span className="font-medium text-[var(--text-primary)] max-w-[120px] truncate">
          {currentProject?.name || 'Select Project'}
        </span>
        <Icon
          name="chevron-down"
          className={`h-4 w-4 text-[var(--text-tertiary)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl z-50">
          {/* Project List */}
          {!isAddMode && (
            <>
              <div className="p-2 max-h-64 overflow-y-auto">
                {projects.length === 0 ? (
                  <div className="text-sm text-[var(--text-tertiary)] text-center py-4">
                    No projects yet
                  </div>
                ) : (
                  projects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => switchProject(project.id)}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer group transition-colors ${
                        currentProject?.id === project.id
                          ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                          : 'hover:bg-[var(--hover-bg)]'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{project.name}</div>
                        <div className="text-xs text-[var(--text-tertiary)] truncate">
                          {project.path}
                        </div>
                      </div>
                      {currentProject?.id === project.id && (
                        <Icon name="check" className="h-4 w-4 flex-shrink-0" />
                      )}
                      {projects.length > 1 && currentProject?.id !== project.id && (
                        <button
                          onClick={(e) => removeProject(project.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--bg-tertiary)] transition-opacity"
                          title="Remove project"
                        >
                          <Icon name="x" className="h-3 w-3 text-[var(--text-tertiary)]" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Add Project Button */}
              <div className="border-t border-[var(--border-default)] p-2">
                <button
                  onClick={() => setIsAddMode(true)}
                  className="flex items-center gap-2 w-full p-2 rounded-md text-sm text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <Icon name="plus" className="h-4 w-4" />
                  Add Project
                </button>
              </div>
            </>
          )}

          {/* Add Project Form */}
          {isAddMode && (
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => {
                    setIsAddMode(false);
                    setError('');
                    setNewPath('');
                    setNewName('');
                  }}
                  className="p-1 rounded hover:bg-[var(--hover-bg)]"
                >
                  <Icon name="arrow-left" className="h-4 w-4 text-[var(--text-secondary)]" />
                </button>
                <span className="font-medium text-sm">Add Project</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-[var(--text-tertiary)] mb-1">
                    Project Path *
                  </label>
                  <input
                    type="text"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    placeholder="/home/user/my-project"
                    className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs text-[var(--text-tertiary)] mb-1">
                    Display Name (optional)
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="My Project"
                    className="w-full px-3 py-2 text-sm rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>

                {error && (
                  <div className="text-xs text-red-500">{error}</div>
                )}

                <button
                  onClick={addProject}
                  disabled={loading || !newPath.trim()}
                  className="w-full py-2 rounded-md text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {loading ? 'Adding...' : 'Add Project'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
