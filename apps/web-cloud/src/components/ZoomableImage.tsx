"use client";

import React, { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Maximize } from "lucide-react";
import { cn } from "@/lib/utils";

interface ZoomableImageProps {
    src: string;
    alt?: string;
}

export function ZoomableImage({ src, alt = "Official View" }: ZoomableImageProps) {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 5));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
    const handleReset = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale === 1) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    // Mouse wheel zoom
    const handleWheel = (e: WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setScale(prev => Math.min(Math.max(prev + delta, 0.5), 5));
        }
    };

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener("wheel", handleWheel, { passive: false });
        }
        return () => {
            if (container) container.removeEventListener("wheel", handleWheel);
        };
    }, []);

    return (
        <div className="relative h-full w-full flex flex-col bg-slate-950 overflow-hidden border border-slate-800 shadow-inner">
            {/* Toolbar */}
            <div className="absolute top-4 right-4 z-20 flex gap-1.5 bg-black/40 backdrop-blur-xl p-1.5 rounded-xl border border-white/10 shadow-2xl">
                <button onClick={handleZoomIn} className="p-2 hover:bg-white/10 text-white rounded-lg transition-colors">
                    <ZoomIn className="h-4 w-4" />
                </button>
                <button onClick={handleZoomOut} className="p-2 hover:bg-white/10 text-white rounded-lg transition-colors">
                    <ZoomOut className="h-4 w-4" />
                </button>
                <div className="w-px h-4 bg-white/10 my-auto mx-1" />
                <button onClick={handleReset} className="p-2 hover:bg-white/10 text-white rounded-lg transition-colors">
                    <RotateCcw className="h-4 w-4" />
                </button>
            </div>

            {/* Scale Indicator */}
            <div className="absolute bottom-4 left-6 z-20">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] bg-black/20 px-3 py-1 rounded-full border border-white/5">
                    Magnification: {(scale * 100).toFixed(0)}%
                </span>
            </div>

            {/* Image Stage */}
            <div
                ref={containerRef}
                className={cn(
                    "flex-1 relative overflow-hidden flex items-center justify-center select-none",
                    scale > 1 ? "cursor-grab" : "cursor-default",
                    isDragging && "cursor-grabbing"
                )}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)'
                    }}
                    className="flex items-center justify-center transition-transform"
                >
                    <img
                        ref={imgRef}
                        src={src}
                        alt={alt}
                        className="max-h-[85vh] w-auto shadow-[0_0_100px_rgba(0,0,0,0.8)] pointer-events-none"
                        onLoad={handleReset}
                    />
                </div>
            </div>

            {/* Floating Hint */}
            {scale === 1 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex flex-col items-center gap-2">
                        <div className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                            <Maximize className="h-6 w-6 text-white/50" />
                        </div>
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Click Zoom to Inspect</p>
                    </div>
                </div>
            )}
        </div>
    );
}
