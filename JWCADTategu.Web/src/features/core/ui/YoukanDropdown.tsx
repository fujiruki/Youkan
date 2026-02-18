import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface YoukanDropdownProps {
    trigger: React.ReactNode;
    children: React.ReactNode;
    isOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
    align?: 'left' | 'right';
    className?: string;
    width?: string;
    usePortal?: boolean; // [NEW] Portal Mode for modals
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
    width = 'w-56',
    usePortal = false // Default false to match existing behavior
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

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

    // Update coordinates when opening or window changes
    const updateCoords = () => {
        if (isOpen && containerRef.current && usePortal) {
            const rect = containerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom,
                left: rect.left,
                width: rect.width
            });
        }
    };

    useLayoutEffect(() => {
        updateCoords();
    }, [isOpen, usePortal]);

    useEffect(() => {
        if (isOpen && usePortal) {
            window.addEventListener('resize', updateCoords);
            window.addEventListener('scroll', updateCoords, true); // Capture scroll in modal
            return () => {
                window.removeEventListener('resize', updateCoords);
                window.removeEventListener('scroll', updateCoords, true);
            };
        }
    }, [isOpen, usePortal]);

    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const inTrigger = containerRef.current?.contains(target);
            const inDropdown = dropdownRef.current?.contains(target);

            if (!inTrigger && !inDropdown) {
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

    const dropdownContent = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="dropdown-menu"
                    ref={dropdownRef}

                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    transition={{ duration: 0.1 }}
                    style={usePortal ? {
                        position: 'fixed',
                        top: coords.top + 4,
                        left: align === 'left' ? coords.left : undefined,
                        right: align === 'right' ? (window.innerWidth - coords.left - coords.width) : undefined,
                        minWidth: width === 'w-full' ? coords.width : (width.startsWith('w-') ? undefined : width),
                        opacity: coords.top === 0 ? 0 : 1, // Safe to restore now with better tracking
                        pointerEvents: coords.top === 0 ? 'none' : 'auto',
                        zIndex: 9999
                    } : undefined}
                    className={usePortal
                        ? `${width} bg-white dark:bg-slate-800 rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none max-h-[300px] overflow-y-auto border border-slate-200 dark:border-slate-700`
                        : `absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1 ${width} origin-top-${align === 'right' ? 'right' : 'left'} bg-white dark:bg-slate-800 rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none z-[100] max-h-[300px] overflow-y-auto border border-slate-200 dark:border-slate-700`
                    }
                >
                    <div className="py-1" onClick={(e) => e.stopPropagation()}>
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
            <div onClick={(e) => {
                handleToggle();
                e.stopPropagation();
            }} className="cursor-pointer">
                {trigger}
            </div>
            {usePortal ? createPortal(dropdownContent, document.body) : dropdownContent}
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
