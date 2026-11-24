import React, { useState } from 'react';
import { Package } from 'lucide-react';

interface ProductThumbProps {
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ProductThumb: React.FC<ProductThumbProps> = ({ src, alt, size = 'md' }) => {
  const [failed, setFailed] = useState(false);

  const sizeClass =
    size === 'sm'
      ? 'w-9 h-9 rounded-[8px]'
      : size === 'lg'
        ? 'w-14 h-14 rounded-[10px]'
        : 'w-10 h-10 rounded-[10px]';

  if (!src || failed) {
    return (
      <div
        className={`${sizeClass} shrink-0 bg-[#F3F5F9] border border-[#E6EAF0] flex items-center justify-center text-[#9CA3AF]`}
        aria-label={alt}
      >
        <Package className="w-4 h-4 stroke-[1.75]" />
      </div>
    );
  }

  return (
    <div className={`${sizeClass} shrink-0 overflow-hidden border border-[#E6EAF0] bg-[#F9FAFB]`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
};
