import React from 'react';
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	DragEndEvent,
} from '@dnd-kit/core';
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { Item } from '../../types';
import { SmartItemRow } from './SmartItemRow';

interface SortableItemProps {
	item: Item;
	index: number;
	onClick: () => void;
	onContextMenu: (e: React.MouseEvent, itemId: string) => void;
	onFocus: (id: string, isEngaged: boolean) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ item, index, onClick, onContextMenu, onFocus }) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: item.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			data-sortable-item
			data-testid="sortable-card"
			className="flex items-center gap-0 cursor-grab active:cursor-grabbing"
			{...attributes}
			{...listeners}
		>
			<div
				data-testid="drag-handle"
				className="flex items-center justify-center w-5 h-7 text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0"
			>
				<GripVertical size={12} />
			</div>
			<div className="flex-1 min-w-0">
				<SmartItemRow
					item={item}
					onClick={onClick}
					onContextMenu={onContextMenu}
					onFocus={onFocus}
					index={index}
				/>
			</div>
		</div>
	);
};

interface SortableFocusQueueProps {
	items: Item[];
	onReorder: (newOrder: Item[]) => void;
	onItemClick: (item: Item) => void;
	onContextMenu: (e: React.MouseEvent, itemId: string) => void;
	onFocus: (id: string, isEngaged: boolean) => void;
}

export const SortableFocusQueue: React.FC<SortableFocusQueueProps> = ({
	items: rawItems,
	onReorder,
	onItemClick,
	onContextMenu,
	onFocus,
}) => {
	const items = rawItems.filter((i): i is Item => i != null);
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 5,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const oldIndex = items.findIndex(i => i.id === active.id);
		const newIndex = items.findIndex(i => i.id === over.id);

		if (oldIndex !== -1 && newIndex !== -1) {
			const newOrder = arrayMove(items, oldIndex, newIndex);
			onReorder(newOrder);
		}
	};

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragEnd={handleDragEnd}
		>
			<SortableContext
				items={items.map(i => i.id)}
				strategy={verticalListSortingStrategy}
			>
				<div className="grid grid-cols-1 gap-[2px]">
					{items.map((item, index) => (
						<SortableItem
							key={item.id}
							item={item}
							index={index}
							onClick={() => onItemClick(item)}
							onContextMenu={onContextMenu}
							onFocus={onFocus}
						/>
					))}
				</div>
			</SortableContext>
		</DndContext>
	);
};
