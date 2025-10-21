import type { ReactNode } from 'react';
import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '../lib/utils';

interface IFloatingButtonProps {
  className?: string;
  children?: ReactNode;
}

const FloatingButton: React.FC<IFloatingButtonProps> = ({
  className,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        className={cn(
          'fixed bottom-18 right-4 z-30 bg-sky-500 text-white p-1 w-11 h-11 rounded-full flex items-center justify-center',
          className,
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          style={{ width: '4rem', height: '4rem' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15"
          />
        </svg>
      </PopoverTrigger>
      {children && (
        <PopoverContent
          align="center"
          side="top"
          className="bg-transparent p-4 border-none shadow-none"
        >
          <div onClick={() => setIsOpen(false)}>
            {children}
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
};

export { FloatingButton };