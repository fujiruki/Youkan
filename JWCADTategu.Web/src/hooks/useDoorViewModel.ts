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

    const updateDimensions = (newDimensions: DoorDimensions) => {
        setDoor(prev => ({
            ...prev,
            dimensions: newDimensions,
            updatedAt: new Date()
        }));
        setIsDirty(true);
    };

    const updateName = (name: string) => {
        setDoor(prev => ({ ...prev, name, updatedAt: new Date() }));
        setIsDirty(true);
    };

    const updateFields = (updates: Partial<Door>) => {
        setDoor(prev => ({ ...prev, ...updates, updatedAt: new Date() }));
        setIsDirty(true);
    };

    const replaceDoor = (newDoor: Door) => {
        setDoor(newDoor);
        setIsDirty(true);
    };

    return {
        door,
        dimensions: door.dimensions,
        isDirty,
        updateDimension,
        updateDimensions,
        updateName,
        updateFields,
        replaceDoor
    };
};
