import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface YoukanDropdownProps {
    trigger: React.ReactNode;
    children: React.ReactNode;
    isOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
    align?: 'left' | 'right';
    className?: string;
    width?: string;
}

/**
 * YoukanDropdown
 * 
 * Youkanシステム標準のドロップダウンコンポーネント。
 * 高いZ-Index、スムーズなアニメーション、柔軟なコンテンツ配置を提供します。
 */
export const YoukanDropdown: React.FC<YoukanDropdownProps> = ({
    trigger,
    children,
    isOpen: controlledIsOpen,
    onOpenChange,
    align = 'left',
    className = '',
    width = 'w-56'
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const isControlled = controlledIsOpen !== undefined;
    const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

    const handleToggle = () => {
        const newState = !isOpen;
        if (!isControlled) {
            setInternalIsOpen(newState);
        }
        onOpenChange?.(newState);
    };

    const handleClose = () => {
        if (!isControlled) {
            setInternalIsOpen(false);
        }
        onOpenChange?.(false);
    };

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                handleClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
            <div onClick={handleToggle} className="cursor-pointer">
                {trigger}
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -5 }}
                        transition={{ duration: 0.1 }}
                        className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1 ${width} origin-top-${align === 'right' ? 'right' : 'left'} bg-white dark:bg-slate-800 rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none z-[100] max-h-[300px] overflow-y-auto border border-slate-200 dark:border-slate-700`}
                    >
                        <div className="py-1">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Dropdown Item Helper
interface YoukanDropdownItemProps {
    onClick?: () => void;
    children: React.ReactNode;
    className?: string;
    active?: boolean;
    danger?: boolean;
    disabled?: boolean;
}

export const YoukanDropdownItem: React.FC<YoukanDropdownItemProps> = ({
    onClick,
    children,
    className = '',
    active = false,
    danger = false,
    disabled = false
}) => {
    return (
        <div
            onClick={disabled ? undefined : onClick}
            className={`
                group flex items-center w-full px-4 py-2 text-sm cursor-pointer transition-colors
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                ${active
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : danger 
                        ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                }
                ${className}
            `}
        >
            {children}
        </div>
    );
};
