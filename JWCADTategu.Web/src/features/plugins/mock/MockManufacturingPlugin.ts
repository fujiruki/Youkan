import { ManufacturingPlugin, ExternalSource, ExternalItem } from '../../core/youkan/types';

export class MockManufacturingPlugin implements ManufacturingPlugin {
    id = "mock-plugin";
    name = "Mock Plugin";

    private mockItems: ExternalItem[] = [
        {
            id: "box-1",
            title: "Test Box A",
            description: "A standard mock box for testing.",
            sourceId: "mock-factory",
            thumbnail: "",
            metadata: { type: 'box', dimensions: '100x100' }
        },
        {
            id: "box-2",
            title: "Test Box B",
            description: "Another mock box.",
            sourceId: "mock-factory",
            thumbnail: "",
            metadata: { type: 'box', dimensions: '200x200' }
        }
    ];

    async getSources(): Promise<ExternalSource[]> {
        return [
            {
                id: "mock-factory",
                name: "Mock Factory",
                icon: "🏭",
                items: this.mockItems
            }
        ];
    }
}
