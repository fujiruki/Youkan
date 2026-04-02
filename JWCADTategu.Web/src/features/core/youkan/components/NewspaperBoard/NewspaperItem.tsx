import React, { useState, useRef, useEffect } from 'react';
import { Item } from '../../types';
import { cn } from '../../../../../lib/utils';
import { NewspaperItemWrapper } from './useNewspaperItems';
import { Folder, FolderOpen } from 'lucide-react';

interface NewspaperItemProps {
	wrapper: NewspaperItemWrapper;
	onClick: (item: Item) => void;
	onContextMenu: (e: React.MouseEvent, itemId: string) => void;
	onAddChild?: (item: Item, title: string) => void;
	titleLimit?: number; // [NEW]
}

const StatusDot = ({ status, isEngaged, isDone }: { status: string, isEngaged?: boolean, isDone?: boolean }) => {
	if (isDone) return null;
	if (status === 'log') return null;

	if (isEngaged) {
		return (
			<div className="relative flex items-center justify-center w-[1em] h-[1em] shrink-0">
				<div className="absolute w-[0.6em] h-[0.6em] rounded-full bg-emerald-500 animate-ping opacity-75" />
				<div className="relative w-[0.55em] h-[0.55em] rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
			</div>
		);
	}

	if (status === 'focus') {
		return (
			<div className="flex items-center justify-center w-[1em] h-[1em] shrink-0">
				<div className="w-[0.55em] h-[0.55em] rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
			</div>
		);
	}

	if (status === 'waiting') {
		return (
			<div className="flex items-center justify-center w-[1em] h-[1em] shrink-0">
				<div className="w-[0.55em] h-[0.55em] rounded-full bg-purple-400 opacity-80" />
			</div>
		);
	}

	// Default: light grey for and-so-on
	return (
		<div className="flex items-center justify-center w-[1em] h-[1em] shrink-0">
			<div className="w-[0.45em] h-[0.45em] rounded-full bg-slate-300 dark:bg-slate-600" />
		</div>
	);
};

const IndentLines = ({ depth }: { depth: number }) => {
	if (depth <= 0) return null;
	return (
		<div className="absolute top-0 bottom-0 left-0 pointer-events-none flex" style={{ width: `${depth * 1.5}rem` }}>
			{Array.from({ length: depth }).map((_, i) => (
				<div
					key={i}
					className="h-full border-l border-slate-200 dark:border-slate-800"
					style={{ width: '1.5rem', marginLeft: i === 0 ? '0.75rem' : '0' }}
				/>
			))}
		</div>
	);
};

export const NewspaperItem: React.FC<NewspaperItemProps> = ({
	wrapper,
	onClick,
	onContextMenu,
	onAddChild,
	titleLimit
}) => {
	const { item, type, depth, project, displayDate, displayDateType } = wrapper;
	const isHeader = type === 'header';
	const [isInlineInputOpen, setIsInlineInputOpen] = useState(false);
	const [inlineInputValue, setInlineInputValue] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	// Auto-focus when input opens
	useEffect(() => {
		if (isInlineInputOpen && inputRef.current) {
			inputRef.current.focus();
		}
	}, [isInlineInputOpen]);

	const handleInlineSubmit = () => {
		const trimmed = inlineInputValue.trim();
		const targetProject = project || item;
		if (trimmed && onAddChild) {
			onAddChild(targetProject as any, trimmed);
		}
		setInlineInputValue('');
		setIsInlineInputOpen(false);
	};

	const handleInlineCancel = () => {
		setInlineInputValue('');
		setIsInlineInputOpen(false);
	};

	if (isHeader) {
		return (
			<div
				className="mb-[2px] mt-[0.6em] break-inside-avoid group/header relative"
				style={{ breakAfter: 'avoid' }}
			>
				<IndentLines depth={depth} />
				{depth === 0 && (
					<div className="border-t border-slate-200 dark:border-slate-700 mb-[2px]" style={{ marginLeft: `${depth * 1.5 + 0.5}rem` }} />
				)}
				<div className={cn(
					"flex items-center gap-[0.5em] text-slate-700 dark:text-slate-200 font-bold px-1 py-0 rounded transition-colors cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50",
					depth > 0 && "text-[0.9em] text-slate-500 dark:text-slate-400 font-bold mt-[0.3em]"
				)}
					style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
					onClick={() => onClick(item)}
					onContextMenu={(e) => {
						e.preventDefault();
						onContextMenu(e, item.id);
					}}
				>
					{depth > 0 ? (
						<FolderOpen size="1em" className="text-slate-400 dark:text-slate-500" />
					) : (
						<Folder size="1em" className="text-slate-400 dark:text-slate-500" />
					)}
					<span className="truncate flex-1" style={{ maxWidth: `${titleLimit || 20}em` }}>{item.title}</span>
					<button
						className="opacity-60 hover:opacity-100 p-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-all text-blue-600 dark:text-blue-400"
						onClick={(e) => {
							e.stopPropagation();
							setIsInlineInputOpen(true);
						}}
						title="サブアイテムを追加"
					>
						<span className="text-lg leading-none">+</span>
					</button>
				</div>

				{/* Inline Input */}
				{isInlineInputOpen && (
					<div className="mt-1" style={{ paddingLeft: `${(depth + 1) * 1.5 + 0.5}rem` }}>
						<input
							ref={inputRef}
							type="text"
							value={inlineInputValue}
							onChange={(e) => setInlineInputValue(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									e.preventDefault();
									handleInlineSubmit();
								} else if (e.key === 'Escape') {
									handleInlineCancel();
								}
							}}
							onBlur={() => {
								setTimeout(() => {
									if (!inlineInputValue.trim()) {
										handleInlineCancel();
									}
								}, 150);
							}}
							placeholder="Alt+D to add..."
							className="w-full text-[0.9em] px-2 py-1 border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				)}
			</div>
		);
	}


	const isDone = (item.status as string) === 'done' || (item.status as string) === 'completed' || (item.status as string) === 'log';

	return (
		<div
			onMouseUp={(e) => {
				if (e.button === 0) {
					onClick(item);
				}
			}}
			onContextMenu={(e) => {
				e.preventDefault();
				onContextMenu(e, item.id);
			}}
			className={
				cn(
					"group flex items-center justify-between gap-[0.4em] px-[0.4em] py-[0.15em] rounded-[0.3em] transition-all cursor-pointer select-none relative z-10",
					"hover:bg-indigo-50 dark:hover:bg-indigo-900/10 hover:shadow-sm",
					"break-inside-avoid",
					"mb-[2px]",
					isDone && "opacity-40 grayscale-[0.5]"
				)}
			style={{
				paddingLeft: `${depth * 1.5 + 0.5}rem`
			}}
		>
			<IndentLines depth={depth} />

			{/* Content: Title (with Dot) + Date */}
			<div className="flex-1 min-w-0 flex items-center justify-between gap-[0.3em] leading-tight overflow-hidden">
				<div className="flex-1 min-w-0 flex items-center gap-[0.2em] overflow-hidden">
					<span
						className={cn(
							"text-[1em] font-medium truncate",
							isDone ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200"
						)}
						style={{ maxWidth: `${titleLimit || 20}em` }}
						title={item.title}
					>
						{item.title}
					</span>
					<StatusDot status={item.status} isEngaged={item.isEngaged} isDone={isDone} />
				</div>

				{displayDate && !isDone && (
					<span className={cn(
						"text-[0.8em] font-bold whitespace-nowrap shrink-0",
						displayDateType === 'due' ? "text-slate-600 dark:text-slate-400" : "text-slate-600 dark:text-slate-300 font-medium"
					)}>
						{displayDate}
					</span>
				)}
			</div>
		</div >
	);
};
