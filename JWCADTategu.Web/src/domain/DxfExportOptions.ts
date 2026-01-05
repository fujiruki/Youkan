/**
 * DXF Export Options
 * Configures optional elements to include in DXF output
 */
export interface DxfExportOptions {
    /** Include human scale figure (1600mm silhouette on Layer 5) */
    includeHumanScale?: boolean;

    /** Use A3 layout (2×3 grid, 420mm×297mm) */
    useA3Layout?: boolean;

    /** Include cost information on Layer 6 (future) */
    includeCost?: boolean;

    /** Include direction marker (triangle) (future) */
    includeDirectionMarker?: boolean;
}

export const DEFAULT_DXF_EXPORT_OPTIONS: DxfExportOptions = {
    includeHumanScale: true,
    useA3Layout: true,
    includeCost: false,
    includeDirectionMarker: false
};
