import * as React from 'react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'outline' | 'filled' | 'clear';
  active?: boolean;
}

const CustomButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, active, ...props }, ref) => {
    const baseClasses = 'flex-1 rounded-sm py-3 px-3 text-center text-lg font-bold transition mx-1';

    const variantClasses = {
      outline:
        'bg-white text-black border border-black hover:bg-gray-100 border-2',
      filled:
        'bg-black text-white border border-black border-2 hover:bg-gray-800',
      clear:
        'bg-white text-black border border-slate-300 hover:text-slate-700',
    };

    const activeClasses = {
      clear:
        'bg-cyan-500 text-white font-bold border-cyan-500',
      outline: '',
      filled: '',
    };

    return (
      <Button
        className={cn(
          baseClasses,
          variantClasses[variant],
          active && activeClasses[variant],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
CustomButton.displayName = 'Button';

export { CustomButton };