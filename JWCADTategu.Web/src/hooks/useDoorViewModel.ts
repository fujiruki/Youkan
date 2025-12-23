import { useState } from 'react';
import { Door } from '../db/db';
import { DoorDimensions } from '../domain/DoorDimensions';

export const useDoorViewModel = (initialDoor: Door) => {
    const [door, setDoor] = useState<Door>(initialDoor);
    const [isDirty, setIsDirty] = useState(false);

    const updateDimension = (key: keyof DoorDimensions, value: number) => {
        setDoor(prev => ({
            ...prev,
            dimensions: { ...prev.dimensions, [key]: value },
            updatedAt: new Date()
        }));
        setIsDirty(true);
    };

    const updateName = (name: string) => {
        setDoor(prev => ({ ...prev, name, updatedAt: new Date() }));
        setIsDirty(true);
    };

    return {
        door,
        dimensions: door.dimensions,
        isDirty,
        updateDimension,
        updateName
    };
};
