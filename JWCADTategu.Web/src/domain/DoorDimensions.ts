export interface EstimationOverride {
    hozo?: number;
    marginTop?: number;
    marginWidth?: number;
    marginLength?: number;
    marginThickness?: number;
    unitPrice?: number;
}

export type EstimationOverrides = Record<string, EstimationOverride>;

export interface DoorDimensions {
    width: number;
    height: number;
    depth: number;
    stileWidth: number;
    topRailWidth: number;
    bottomRailWidth: number;
    middleRailWidth: number;
    middleRailCount: number;

    // New features for restricted
    tsukaWidth: number;
    tsukaCount: number;

    // Kumiko (Grid)
    kumikoVertWidth: number;
    kumikoVertCount: number;
    kumikoHorizWidth: number;
    kumikoHorizCount: number;

    // Overrides
    estimationOverrides?: EstimationOverrides;
}
