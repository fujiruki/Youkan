import { ExternalSource, ManufacturingPlugin } from '../types';
// import { MockManufacturingPlugin } from '../../../plugins/mock/MockManufacturingPlugin';

class ManufacturingBusService {
    private plugins: Map<string, ManufacturingPlugin> = new Map();

    constructor() {
        // [Auto-Register] Ensure Mock Plugin is always available for now
        // REMOVED for Production Fix: Mock Plugin should not be auto-registered in production.
        // this.registerPlugin(new MockManufacturingPlugin());
    }

    registerPlugin(plugin: ManufacturingPlugin) {
        if (this.plugins.has(plugin.id)) {
            // calculated warning is unnecessary for auto-init
            // console.warn(`Plugin ${plugin.id} is already registered.`);
            return;
        }
        this.plugins.set(plugin.id, plugin);
        console.log(`[ManufacturingBus] Plugin registered: ${plugin.name} (${plugin.id})`);
    }


    async getSources(): Promise<ExternalSource[]> {
        const sources: ExternalSource[] = [];
        for (const plugin of this.plugins.values()) {
            try {
                const pluginSources = await plugin.getSources();
                sources.push(...pluginSources);
            } catch (e) {
                console.error(`[ManufacturingBus] Failed to get sources from plugin ${plugin.id}:`, e);
            }
        }
        return sources;
    }

    // This method converts an ExternalItem into a format ready for import (e.g. creating Youkan Item)
    // The actual conversion/saving happens in ViewModel/Repo, but this is the entry point logic.
    async onDrop(sourceItemId: string, targetDate: Date): Promise<any> {
        console.log(`[ManufacturingBus] Drop Detected: ${sourceItemId} -> ${targetDate}`);
        // Here we could validate or pre-process.
        // For MVP, we pass thru.
        return { sourceItemId, targetDate };
    }
}

export const ManufacturingBus = new ManufacturingBusService();
