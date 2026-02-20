import { Project, Door } from '../db/db';
import { BUILD_TIMESTAMP, BUILD_TIME_DISPLAY } from '../config/debug';

/**
 * Project Export Data Structure
 */
export interface ProjectExportData {
    exportInfo: {
        version: string;
        exportedAt: string;
        buildTime: string;
        buildTimestamp: string;
    };
    project: {
        id: string | undefined;
        title: string;
        name: string; // Maintain for compatibility
        createdAt: string | undefined;
        updatedAt: string | undefined;
        doorCount: number;
    };
    doors: Array<{
        id: string | undefined;
        tag: string;
        name: string;
        dimensions: {
            width: number;
            height: number;
            frameThickness: number;
            topRailWidth: number;
            bottomRailWidth: number;
            leftStileWidth: number;
            rightStileWidth: number;
        };
        estimatedCost?: number;
    }>;
    settings: {
        dxfLayerConfig: {
            frame: string;
            joineryOutline: string;
            joineryFill: string;
            dimensions: string;
            text: string;
            humanScale: string;
        };
        dxfColorConfig?: any;
    };
}

/**
 * Export project data to JSON format
 * @param project Project to export
 * @param doors Array of doors in the project
 * @returns JSON string (formatted with 2-space indentation)
 */
export function exportProjectToJson(project: Project, doors: Door[]): string {

    const exportData: ProjectExportData = {
        exportInfo: {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            buildTime: BUILD_TIME_DISPLAY,
            buildTimestamp: BUILD_TIMESTAMP
        },
        project: {
            id: project.id?.toString(),
            title: project.title || project.name || '',
            name: project.title || project.name || '',
            createdAt: project.createdAt ? (project.createdAt instanceof Date ? project.createdAt.toISOString() : new Date(project.createdAt).toISOString()) : undefined,
            updatedAt: project.updatedAt ? (project.updatedAt instanceof Date ? project.updatedAt.toISOString() : new Date(project.updatedAt).toISOString()) : undefined,
            doorCount: doors.length
        },
        doors: doors.map(door => ({
            id: door.id?.toString(),
            tag: door.tag,
            name: door.name,
            dimensions: {
                width: door.dimensions.width,
                height: door.dimensions.height,
                frameThickness: door.dimensions.depth, // depth mapped to frameThickness for export compat? Or rename? Let's use depth.
                topRailWidth: door.dimensions.topRailWidth,
                bottomRailWidth: door.dimensions.bottomRailWidth,
                leftStileWidth: door.dimensions.stileWidth, // stileWidth mapped to left/right
                rightStileWidth: door.dimensions.stileWidth
            },
            // estimatedCost: door.estimatedCost // Removed as it doesn't exist
        })),
        settings: {
            dxfLayerConfig: project.dxfLayerConfig || {
                frame: '8-1',
                joineryOutline: '0-2',
                joineryFill: '0-E',
                dimensions: '8-F',
                text: '8-0',
                humanScale: '5_SCALE'
            },
            dxfColorConfig: (project as any).dxfColorConfig
        }
    };

    // Format with 2-space indentation for readability
    return JSON.stringify(exportData, null, 2);
}

/**
 * Generate filename for project export
 * @param projectName Project name
 * @returns Filename in format: {name}_backup_{date}.json
 */
export function generateExportFilename(projectName: string): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const safeName = projectName.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_');
    return `${safeName}_backup_${date}.json`;
}
