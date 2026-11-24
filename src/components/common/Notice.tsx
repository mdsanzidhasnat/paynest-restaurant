import type { ReactNode } from 'react';

type NoticeTone = 'amber' | 'green';

const TONE_CLASSES: Record<NoticeTone, string> = {
  amber: 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]',
  green: 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]',
};

interface NoticeProps {
  children: ReactNode;
  className?: string;
  tone?: NoticeTone;
  action?: ReactNode;
}

/** Shared inline notice; existing screen colours and spacing are passed in. */
export function Notice({ children, className = '', tone = 'amber', action }: NoticeProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-[10px] border text-[13px] font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      <span>{children}</span>
      {action}
    </div>
  );
}
