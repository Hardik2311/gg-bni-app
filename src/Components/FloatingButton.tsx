import type { ReactNode } from 'react';
import { useState } from 'react';
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
          'fixed bottom-20 right-4 z-30 bg-sky-500 text-white w-[50px] h-[50px] rounded-full flex items-center justify-center text-4xl font-light shadow-lg hover:bg-sky-600 transition-colors',
          className,
        )}
      >
        +
      </PopoverTrigger>
      {children && (
        <PopoverContent
          align="center"
          side="top"
          className="bg-transparent p-4 border-none shadow-none"
        >
          <div onClick={() => setIsOpen(false)}>{children}</div>
        </PopoverContent>
      )}
    </Popover>
  );
};

export { FloatingButton };