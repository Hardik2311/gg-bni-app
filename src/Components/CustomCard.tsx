import React from 'react';

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

interface CustomCardProps {
    children: React.ReactNode;
    className?: string;
}

const CustomCard = React.forwardRef<HTMLDivElement, CustomCardProps>(
    ({ children, className, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    'mb-4 flex flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-sm',
                    className,
                )}
                {...props}
            >
                {children}
            </div>
        );
    },
);

CustomCard.displayName = 'CustomCard';

export { CustomCard };
