/**
 * DXF Export Options
 * Configures optional elements to include in DXF output
 */
export interface DxfExportOptions {
    /** Include human scale figure (1600mm silhouette on Layer 5) */
    includeHumanScale?: boolean;

    /** Include cost information on Layer 6 (future) */
    includeCost?: boolean;

    /** Include direction marker (triangle) (future) */
    includeDirectionMarker?: boolean;
}

export const DEFAULT_DXF_EXPORT_OPTIONS: DxfExportOptions = {
    includeHumanScale: true,
    includeCost: false,
    includeDirectionMarker: false
};
