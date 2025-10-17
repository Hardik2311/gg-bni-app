// src/components/ui/ReusableDropdown.tsx

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '../lib/utils'; // Adjust path if necessary
import { Button } from '../Components/ui/button'; // Adjust path if necessary
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../Components/ui/dropdown-menu'; // Adjust path if necessary

// 1. Make the Option interface generic with <T>
export interface Option<T> {
    value: T;
    label: string;
}

// 2. Make the Props interface generic
interface ReusableDropdownProps<T extends string> {
    options: Option<T>[];
    value?: T;
    onChange: (value: T) => void; // This now expects a value of the specific type T
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

// 3. Make the component function generic
export const ReusableDropdown = <T extends string>({
    options,
    value,
    onChange,
    placeholder = 'Select an option...',
    className,
    disabled = false,
}: ReusableDropdownProps<T>) => {
    const selectedLabel = React.useMemo(() => {
        return options.find((option) => option.value === value)?.label;
    }, [options, value]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={disabled}>
                <Button
                    variant="outline"
                    className={cn('w-full justify-between py-7 text-base', className)}
                >
                    {selectedLabel || placeholder}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className={cn('w-full p-0', className)}>
                {options.map((option) => (
                    <DropdownMenuItem
                        key={option.value}
                        // The `option.value` is now correctly inferred as type T
                        onSelect={() => onChange(option.value)}
                    >
                        <Check
                            className={cn(
                                'mr-2 h-4 w-4',
                                value === option.value ? 'opacity-100' : 'opacity-0'
                            )}
                        />
                        {option.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};