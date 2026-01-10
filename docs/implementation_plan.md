# Implementation Plan - Visual & Catalog Features

**Goal**: Establish a Design Mode that allows for detailed visual proposals and a Catalog System for reusing designs, as defined in `REQUIREMENT_DEF.md`.

## User Review Required
> [!IMPORTANT]
> This plan focuses on "Look & Feel" and "Cataloging" as requested.
> Basic estimation (material cost) will be implemented after the visual foundation is solid.

## Proposed Changes

### 1. Data Model Extension
[New Types](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/domain/DoorSpecs.ts)
*   Create `MaterialTexture` interface (material type, grain, color).
*   Create `CatalogItem` interface (door copy + metadata).
*   Update `Door` interface to include `photoBlob`.

### 2. Canvas Engine Update
[GeometryGenerator.ts](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/logic/GeometryGenerator.ts)
*   Update `GeometryPart` to hold material metadata.

[PreviewCanvas.tsx](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/components/Editor/PreviewCanvas.tsx)
*   Implement `drawPattern` utility.
*   Load texture assets (or generate procedural noise for wood grain).
*   Switch drawing logic from `fillRect` to `drawPattern` based on specs.

### 3. UI Implementation
[EditorScreen.tsx](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/components/Editor/EditorScreen.tsx)
*   Add `DesignMode` toggle logic.
*   Implement `TextureSettingsPanel` (Sidebar).

[CatalogScreen.tsx](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/components/Catalog/CatalogScreen.tsx)
*   **[NEW]** Implement Gallery Grid View.
*   Implement "Create from Catalog" action.

[PhotoCompare.tsx](file:///c:/Users/doorf/OneDrive/ドキュメント/プロジェクト/TateguDesignStudio/JWCADTategu.Web/src/components/Editor/PhotoCompare.tsx)
*   **[NEW]** Implement Split View & File Upload logic.

## Verification Plan

### Automated Tests
*   Run `npm run build` to ensure type safety.

### Manual Verification
1.  **Texture Rendering**:
    *   Open Editor.
    *   Change Stile material to "Wood (Vertical Grain)".
    *   Verify Canvas shows vertical grain pattern.
2.  **Catalog Registration**:
    *   Save current door to Catalog.
    *   Go to Catalog Screen.
    *   Verify thumbnail and metadata appear correctly.
3.  **Photo Comparison**:
    *   Upload a dummy image.
    *   Verify Split View shows Canvas and Image side-by-side.
