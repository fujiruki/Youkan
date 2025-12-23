import React, { useRef, useEffect } from 'react';
import { DoorDimensions } from '../../domain/DoorDimensions';
import { DoorGeometryGenerator } from '../../logic/GeometryGenerator';

export const PreviewCanvas: React.FC<{ dimensions: DoorDimensions }> = ({ dimensions }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Reset
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Generate Geometry
        const { lines, rects } = DoorGeometryGenerator.generate(dimensions);

        // Scaling Logic (Fit to canvas)
        const margin = 40;
        const scaleX = (canvas.width - margin * 2) / dimensions.width;
        const scaleY = (canvas.height - margin * 2) / dimensions.height;
        const scale = Math.min(scaleX, scaleY);

        const offsetX = (canvas.width - dimensions.width * scale) / 2;
        const offsetY = (canvas.height - dimensions.height * scale) / 2;

        // Draw Grid
        drawGrid(ctx, canvas.width, canvas.height);

        // Draw Fills (Wood Texture Base)
        ctx.fillStyle = '#d4c5b0'; // Wood-like color (Spruce/Pine)
        rects.forEach(r => {
            const rx = r.x * scale + offsetX;
            const ry = r.y * scale + offsetY;
            const rw = r.w * scale;
            const rh = r.h * scale;
            ctx.fillRect(rx, ry, rw, rh);
        });

        // Draw Door Lines (Wireframe)
        ctx.beginPath();
        ctx.strokeStyle = '#334155'; // darker slate for contrast against wood
        ctx.lineWidth = 1.5;

        lines.forEach(line => {
            const sx = line.start.x * scale + offsetX;
            const sy = line.start.y * scale + offsetY;
            const ex = line.end.x * scale + offsetX;
            const ey = line.end.y * scale + offsetY;

            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
        });
        ctx.stroke();

    }, [dimensions]);

    return (
        <div className="flex-1 bg-slate-900 relative overflow-hidden flex items-center justify-center">
            <canvas ref={canvasRef} width={800} height={600} className="w-full h-full" />
        </div>
    );
};

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.strokeStyle = '#1e293b'; // slate-800
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 20) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0; y <= h; y += 20) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
}
