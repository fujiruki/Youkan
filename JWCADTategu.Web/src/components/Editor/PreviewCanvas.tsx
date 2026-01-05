import React, { useRef, useEffect, useState } from 'react';
import { DoorDimensions } from '../../domain/DoorDimensions';
import { DoorGeometryGenerator } from '../../logic/GeometryGenerator';

import { InteractionOverlay } from './InteractionOverlay';
import { PresetBar } from './PresetBar';
import { MiniEditor } from './MiniEditor';
import { GeometryPart } from '../../logic/GeometryGenerator';

export interface PreviewCanvasRef {
    toDataURL: () => string | null;
}

export const PreviewCanvas = React.forwardRef<PreviewCanvasRef, {
    dimensions: DoorDimensions;
    onDimensionsChange?: (dims: DoorDimensions) => void;
}>(({ dimensions, onDimensionsChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [canvasSize, setCanvasSize] = React.useState({ width: 0, height: 0 });
    const [selectedPart, setSelectedPart] = React.useState<GeometryPart | null>(null);
    const [editorPos, setEditorPos] = React.useState({ x: 0, y: 0 });
    const [showHumanScale, setShowHumanScale] = useState(true); // Default ON

    React.useImperativeHandle(ref, () => ({
        toDataURL: () => {
            if (canvasRef.current) {
                // Low quality JPEG for thumbnail size efficiency
                return canvasRef.current.toDataURL('image/jpeg', 0.5);
            }
            return null;
        }
    }));

    // View Transform State (x, y, scale)
    // Initialize with null to indicate "not fitted yet"
    const [transform, setTransform] = useState<{ x: number, y: number, k: number } | null>(null);

    // Initial Fit / Auto-fit
    // Re-fit when canvas size changes. 
    // We purposefully DO NOT re-fit when 'dimensions' change to prevent jarring resets while editing.
    useEffect(() => {
        if (canvasSize.width === 0 || canvasSize.height === 0) return;

        // Only fit if we haven't set a transform yet (Initial load)
        if (transform === null) {
            fitToScreen();
        }
    }, [canvasSize]);

    // Force fit helper
    const fitToScreen = () => {
        if (canvasSize.width === 0 || canvasSize.height === 0) return;

        const margin = 50;
        const dW = dimensions.width || 1;
        const dH = dimensions.height || 1;

        const scaleX = (canvasSize.width - margin * 2) / dW;
        const scaleY = (canvasSize.height - margin * 2) / dH;
        const k = Math.min(scaleX, scaleY);

        const x = (canvasSize.width - dW * k) / 2;
        const y = (canvasSize.height - dH * k) / 2;

        setTransform({ x, y, k });
    };

    // Also fit when dimensions change significantly? 
    // Actually, preserving view is better for "Tweaking".
    // But if we load a totally different preset, we might want to reset.
    // For now, let's keep it manual or implicit.
    // However, if we don't update on dimension change, the drawing code MUST rely on 'transform'.

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                canvas.width = width;
                canvas.height = height;
                setCanvasSize({ width, height });
            }
        });

        resizeObserver.observe(canvas.parentElement!);
        return () => resizeObserver.disconnect();
    }, []);

    // Zoom Logic
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!transform) return;

        const zoomIntensity = 0.1;
        const wheel = e.deltaY < 0 ? 1 : -1;
        const zoomFactor = Math.exp(wheel * zoomIntensity);

        const rect = canvasRef.current!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate new scale
        const newK = transform.k * zoomFactor;

        // Calculate new position to keep mouse pointer over same model point
        // (mouseX - newX) / newK = (mouseX - oldX) / oldK
        // mouseX - newX = (mouseX - oldX) * (newK / oldK)
        // newX = mouseX - (mouseX - oldX) * (newK / oldK)

        const newX = mouseX - (mouseX - transform.x) * zoomFactor;
        const newY = mouseY - (mouseY - transform.y) * zoomFactor;

        setTransform({ x: newX, y: newY, k: newK });
    };

    // Pan Logic (Middle Click Drag)
    const [isPanning, setIsPanning] = useState(false);
    const lastMouseRef = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        // Middle button (1) or Left button + Space? User asked for Middle Scroll Zoom.
        // Usually Middle Click Drag is Pan.
        if (e.button === 1) { // Middle button
            e.preventDefault();
            setIsPanning(true);
            lastMouseRef.current = { x: e.clientX, y: e.clientY };
        } else if (e.button === 0) {
            // Left click for selection (handled by Overlay, but Overlay is on top?)
            // If Overlay handles click, this might not fire if propagation stopped?
            // Actually Overlay is AFTER Canvas in DOM, so it captures clicks.
            // We need to pass Pan events through or handle them on Overlay?
            // Overlay has 'pointer-events-none' usually? No, it has interactions.
            // We'll handle Pan on the Wrapper Div.
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isPanning || !transform) return;
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;

        setTransform({ ...transform, x: transform.x + dx, y: transform.y + dy });
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };


    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas || !transform) return; // Wait for transform init
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Reset
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Generate Geometry
        const { lines, parts } = DoorGeometryGenerator.generate(dimensions);

        // Use Transform
        const { x: offsetX, y: offsetY, k: scale } = transform;

        // Draw Grid
        drawGrid(ctx, canvas.width, canvas.height, offsetX, offsetY, scale);

        // Draw Human Scale if enabled
        if (showHumanScale) {
            drawHumanSilhouette(ctx, scale, offsetX, offsetY, dimensions.width || 1);
        }

        // Draw Fills
        ctx.fillStyle = '#d4c5b0';
        parts.forEach(r => {
            const rx = r.x * scale + offsetX;
            const ry = r.y * scale + offsetY;
            const rw = r.w * scale;
            const rh = r.h * scale;
            ctx.fillRect(rx, ry, rw, rh);
        });

        // Draw Lines
        ctx.beginPath();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 0.75; // Maybe scale line width? 0.75 is fine.

        lines.forEach(line => {
            const sx = line.start.x * scale + offsetX;
            const sy = line.start.y * scale + offsetY;
            const ex = line.end.x * scale + offsetX;
            const ey = line.end.y * scale + offsetY;

            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
        });
        ctx.stroke();
    };

    // Human Silhouette Drawing Helper
    const drawHumanSilhouette = (ctx: CanvasRenderingContext2D, scale: number, offsetX: number, offsetY: number, doorWidth: number) => {
        // Position: To the right of the door
        const humanHeightMm = 1600;
        const humanWidthMm = 450;

        // Gap of 200mm
        const humanX = offsetX + (doorWidth * scale) + (200 * scale);
        // Floor level
        const floorY = offsetY + ((dimensions.height || 2000) * scale);

        const hPix = humanHeightMm * scale;
        const wPix = humanWidthMm * scale;
        const xPix = humanX;
        const yPix = floorY - hPix;

        ctx.fillStyle = '#94a3b8'; // slate-400 (Gray)

        // Head (Circle)
        ctx.beginPath();
        const headRadius = hPix * 0.08;
        ctx.arc(xPix + wPix / 2, yPix + headRadius, headRadius, 0, Math.PI * 2);
        ctx.fill();

        // Body (Simplified)
        ctx.beginPath();
        const neckY = yPix + (hPix * 0.15);
        ctx.moveTo(xPix + wPix / 2, neckY);
        ctx.lineTo(xPix + wPix, neckY + (hPix * 0.1));
        ctx.lineTo(xPix + wPix * 0.9, yPix + hPix * 0.5);
        ctx.lineTo(xPix + wPix * 0.2, yPix + hPix * 0.5);
        ctx.lineTo(xPix, neckY + (hPix * 0.1));
        ctx.closePath();
        ctx.fill();

        // Legs
        ctx.beginPath();
        ctx.rect(xPix + wPix * 0.2, yPix + hPix * 0.5, wPix * 0.25, hPix * 0.5);
        ctx.rect(xPix + wPix * 0.55, yPix + hPix * 0.5, wPix * 0.25, hPix * 0.5);
        ctx.fill();

        // Label "160cm"
        ctx.fillStyle = '#64748b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('160cm', xPix + wPix / 2, yPix - 10);
    };

    // Redraw when dimensions OR transform OR canvasSize changes
    useEffect(() => {
        draw();
    }, [dimensions, transform, showHumanScale, canvasSize]);

    return (
        <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
            {/* 1. Top Bar */}
            {onDimensionsChange && (
                <div className="relative z-10">
                    <PresetBar
                        currentDimensions={dimensions}
                        onChange={onDimensionsChange}
                        showHumanScale={showHumanScale}
                        onToggleHumanScale={setShowHumanScale}
                    />
                </div>
            )}

            {/* 2. Canvas Area */}
            <div
                className="flex-1 relative flex items-center justify-center overflow-hidden cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onClick={(e) => {
                    // Reset selection on background click if not panning
                    if (!isPanning && e.button === 0) setSelectedPart(null);
                }}
            >
                <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />

                {/* Interaction Overlay must share the same transform! */}
                {transform && (
                    <InteractionOverlay
                        dimensions={dimensions}
                        width={canvasSize.width}
                        height={canvasSize.height}
                        transform={transform} // Pass transform to overlay
                        onPartClick={(part, e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const x = e.clientX - rect.left + 20;
                            const y = e.clientY - rect.top - 20;
                            setEditorPos({ x, y });
                            setSelectedPart(part);
                        }}
                    />
                )}

                {onDimensionsChange && selectedPart && (
                    <MiniEditor
                        key={selectedPart.id}
                        part={selectedPart}
                        dimensions={dimensions}
                        onChange={onDimensionsChange}
                        onClose={() => setSelectedPart(null)}
                        canvasSize={canvasSize}
                        initialPosition={editorPos}
                    />
                )}
            </div>
        </div>
    );
});
PreviewCanvas.displayName = 'PreviewCanvas';

// Grid needs to respect Zoom/Pan
function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, ox: number, oy: number, scale: number) {
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Grid size 50mm in world space? Or fixed pixel grid?
    // CAD usually has fixed world grid. Let's say 100mm grid.
    const gridSize = 100 * scale;

    // Start from offset, go both directions
    // Horizontal lines
    // y = oy + N * gridSize
    // We want to cover 0 to h

    const startY = (oy % gridSize);
    for (let y = startY - gridSize; y < h; y += gridSize) {
        ctx.moveTo(0, y); ctx.lineTo(w, y);
    }

    const startX = (ox % gridSize);
    for (let x = startX - gridSize; x < w; x += gridSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, h);
    }

    ctx.stroke();
}

