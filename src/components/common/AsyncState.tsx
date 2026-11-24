import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="rounded-[12px] border border-[#E6EAF0] bg-white p-10 text-center text-[13px] text-[#6B7280]">
      {label}
    </div>
  );
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-[12px] border border-dashed border-[#E6EAF0] bg-white p-10 text-center">
      <p className="text-[14px] font-semibold text-[#374151]">{title}</p>
      {description && <p className="mt-1 text-[12px] text-[#9CA3AF]">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13px] font-medium text-[#B91C1C]">
      <div className="flex items-center justify-between gap-4">
        <span>{message}</span>
        {onRetry && (
          <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline">
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
