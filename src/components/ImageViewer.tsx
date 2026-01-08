"use client";

import { useState, useRef, useEffect } from "react";

interface ImageViewerProps {
  src: string;
  alt: string;
  title?: string;
}

export default function ImageViewer({ src, alt, title }: ImageViewerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [magnifierPosition, setMagnifierPosition] = useState({ x: 0, y: 0 });
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMagnifierPosition({ x, y });
  };

  const handleMouseLeave = () => {
    setShowMagnifier(false);
  };

  const handleMouseEnter = () => {
    if (zoom > 1) {
      setShowMagnifier(true);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.max(1, Math.min(5, prev + delta)));
  };

  const resetZoom = () => {
    setZoom(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom === 1) return;

    const startX = e.clientX - imagePosition.x;
    const startY = e.clientY - imagePosition.y;

    const handleDragMove = (moveEvent: MouseEvent) => {
      const newX = moveEvent.clientX - startX;
      const newY = moveEvent.clientY - startY;

      // Constrain movement
      const maxX = (containerRef.current?.clientWidth || 0) * (zoom - 1) / 2;
      const maxY = (containerRef.current?.clientHeight || 0) * (zoom - 1) / 2;

      setImagePosition({
        x: Math.max(-maxX, Math.min(maxX, newX)),
        y: Math.max(-maxY, Math.min(maxY, newY)),
      });
    };

    const handleDragEnd = () => {
      document.removeEventListener("mousemove", handleDragMove);
      document.removeEventListener("mouseup", handleDragEnd);
    };

    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleDragEnd);
  };

  return (
    <>
      {/* Thumbnail - Clickable */}
      <div
        onClick={() => setIsModalOpen(true)}
        className="cursor-pointer hover:opacity-80 transition-opacity"
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-48 object-cover rounded-lg"
        />
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-4xl max-h-[90vh] bg-gray-900 rounded-lg shadow-2xl flex flex-col border border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex-1">
                {title && (
                  <h3 className="text-white font-semibold text-lg">{title}</h3>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                {/* Zoom Display */}
                <div className="bg-gray-800 px-3 py-1 rounded text-white text-sm font-mono">
                  {Math.round(zoom * 100)}%
                </div>

                {/* Zoom Out */}
                <button
                  onClick={() => setZoom((prev) => Math.max(1, prev - 0.2))}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded transition-colors"
                  title="Zoom out (Scroll down)"
                >
                  🔍−
                </button>

                {/* Zoom In */}
                <button
                  onClick={() => setZoom((prev) => Math.min(5, prev + 0.2))}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded transition-colors"
                  title="Zoom in (Scroll up)"
                >
                  🔍+
                </button>

                {/* Reset */}
                <button
                  onClick={resetZoom}
                  disabled={zoom === 1}
                  className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1 rounded transition-colors"
                  title="Reset zoom"
                >
                  ↺
                </button>

                {/* Magnifier Toggle */}
                <button
                  onClick={() => setShowMagnifier(!showMagnifier)}
                  className={`px-3 py-1 rounded transition-colors ${
                    showMagnifier
                      ? "bg-[#3891A6] hover:bg-[#2a7f8f] text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-white"
                  }`}
                  title="Toggle magnifier"
                >
                  🔎
                </button>

                {/* Close */}
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    resetZoom();
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Image Container */}
            <div
              ref={containerRef}
              className="flex-1 overflow-auto bg-black relative flex items-start justify-center"
              onMouseMove={handleMouseMove}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onWheel={handleWheel}
              onMouseDown={handleDragStart}
              style={{ cursor: zoom > 1 ? "grab" : "default" }}
            >
              {/* Image */}
              <img
                ref={imgRef}
                src={src}
                alt={alt}
                className="w-full h-full object-contain"
                style={{
                  transform: `scale(${zoom}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
                  transformOrigin: "center",
                  transition:
                    zoom === 1 ? "transform 0.3s ease-out" : "none",
                }}
                draggable={false}
              />

              {/* Magnifier Glass */}
              {showMagnifier && zoom > 1 && (
                <div
                  className="absolute border-2 border-yellow-400 pointer-events-none rounded-full"
                  style={{
                    width: "120px",
                    height: "120px",
                    left: `${magnifierPosition.x - 60}px`,
                    top: `${magnifierPosition.y - 60}px`,
                    boxShadow: "0 0 0 2px rgba(255,255,255,0.2), inset 0 0 10px rgba(0,0,0,0.5)",
                    background: `radial-gradient(circle, transparent 50%, rgba(253,231,76,0.1) 100%)`,
                  }}
                >
                  {/* Inner magnified view */}
                  <div
                    className="absolute inset-0 rounded-full overflow-hidden"
                    style={{
                      background: `url(${src})`,
                      backgroundSize: `${100 * zoom}% ${100 * zoom}%`,
                      backgroundPosition: `${
                        ((magnifierPosition.x / (containerRef.current?.clientWidth || 1)) * 100) *
                        (zoom - 1)
                      }% ${
                        ((magnifierPosition.y / (containerRef.current?.clientHeight || 1)) * 100) *
                        (zoom - 1)
                      }%`,
                      backgroundRepeat: "no-repeat",
                    }}
                  />
                </div>
              )}

              {/* Instructions */}
              {zoom === 1 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/60 text-white px-4 py-2 rounded-lg text-center">
                    <p className="text-sm">Scroll to zoom • Click magnifier to inspect details</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Info */}
            <div className="bg-gray-800 px-4 py-2 border-t border-gray-700 text-gray-400 text-xs">
              <p>
                💡 Scroll to zoom • Drag to pan • 🔎 Button for magnifying glass • Magnifier appears
                when zoomed in
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
