'use client';

import { useState, useMemo } from 'react';
import { Check, X, Loader2, Shield, ChevronRight } from 'lucide-react';
import { PermissionRequest } from '../types';

interface PermissionCardProps {
  permission: PermissionRequest;
  onRespond: (
    permissionId: string,
    approved: boolean,
    options?: { mode?: 'default' | 'acceptEdits'; allowTools?: string[] }
  ) => void;
}

// Edit-type tools that can use "allow all edits" option
const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'ExitPlanMode', 'exit_plan_mode']);

export function PermissionCard({ permission, onRespond }: PermissionCardProps) {
  const [loading, setLoading] = useState<'yes' | 'all' | 'session' | 'no' | null>(null);

  const isEditTool = EDIT_TOOLS.has(permission.toolName);
  const isPending = permission.status === 'pending';
  const isApproved = permission.status === 'approved';
  const isDenied = permission.status === 'denied';

  // Get tool identifier for "allow for session" (includes command for Bash)
  const toolIdentifier = useMemo(() => {
    if (permission.toolName === 'Bash' && permission.toolInput?.command) {
      return `Bash(${permission.toolInput.command})`;
    }
    return permission.toolName;
  }, [permission.toolName, permission.toolInput]);

  // Handlers
  const handleYes = async () => {
    if (!isPending || loading) return;
    setLoading('yes');
    onRespond(permission.id, true);
  };

  const handleAllowAllEdits = async () => {
    if (!isPending || loading) return;
    setLoading('all');
    onRespond(permission.id, true, { mode: 'acceptEdits' });
  };

  const handleAllowForSession = async () => {
    if (!isPending || loading) return;
    setLoading('session');
    onRespond(permission.id, true, { allowTools: [toolIdentifier] });
  };

  const handleNo = async () => {
    if (!isPending || loading) return;
    setLoading('no');
    onRespond(permission.id, false);
  };

  // Status display when resolved
  if (!isPending) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 text-xs ${
        isApproved ? 'text-emerald-600' : 'text-red-500'
      }`}>
        {isApproved ? (
          <>
            <Check className="w-3.5 h-3.5" />
            <span>Approved</span>
          </>
        ) : (
          <>
            <X className="w-3.5 h-3.5" />
            <span>Denied</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--border-default)] bg-amber-500/5">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-500/20">
        <Shield className="w-3.5 h-3.5 text-amber-600" />
        <span className="text-xs font-medium text-amber-700">Permission Required</span>
        {permission.decisionReason && (
          <span className="text-[10px] text-amber-600/70 truncate flex-1">
            {permission.decisionReason}
          </span>
        )}
      </div>

      {/* Blocked path warning */}
      {permission.blockedPath && (
        <div className="px-3 py-1.5 text-[10px] text-amber-600 bg-amber-500/10 border-b border-amber-500/20">
          <span className="font-medium">Blocked path:</span>{' '}
          <code className="font-mono">{permission.blockedPath}</code>
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-col p-2 gap-1">
        {/* Yes - just this once */}
        <PermissionButton
          onClick={handleYes}
          loading={loading === 'yes'}
          disabled={!isPending || loading !== null}
          variant="primary"
        >
          Yes
        </PermissionButton>

        {/* Yes, allow all edits (for edit tools) */}
        {isEditTool && (
          <PermissionButton
            onClick={handleAllowAllEdits}
            loading={loading === 'all'}
            disabled={!isPending || loading !== null}
            variant="secondary"
          >
            Yes, allow all edits
          </PermissionButton>
        )}

        {/* Yes, for this tool in session (for non-edit tools) */}
        {!isEditTool && (
          <PermissionButton
            onClick={handleAllowForSession}
            loading={loading === 'session'}
            disabled={!isPending || loading !== null}
            variant="secondary"
          >
            Yes, for this session
          </PermissionButton>
        )}

        {/* No - deny and tell Claude */}
        <PermissionButton
          onClick={handleNo}
          loading={loading === 'no'}
          disabled={!isPending || loading !== null}
          variant="deny"
        >
          No
        </PermissionButton>
      </div>
    </div>
  );
}

// Styled button component
function PermissionButton({
  children,
  onClick,
  loading,
  disabled,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  variant: 'primary' | 'secondary' | 'deny';
}) {
  const colors = {
    primary: 'text-emerald-600 hover:bg-emerald-500/10 border-l-emerald-500',
    secondary: 'text-blue-600 hover:bg-blue-500/10 border-l-blue-500',
    deny: 'text-red-500 hover:bg-red-500/10 border-l-red-500',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-r
        border-l-2 border-l-transparent transition-all
        ${disabled && !loading ? 'opacity-40 cursor-not-allowed' : ''}
        ${colors[variant]}
        hover:border-l-current
      `}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <ChevronRight className="w-3.5 h-3.5" />
      )}
      {children}
    </button>
  );
}
