"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface RedactionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  imageSrc: string;
  onSave: (dataUrl: string) => void;
}

export function RedactionCanvas({ imageSrc, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [rects, setRects] = useState<RedactionRect[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [currentRect, setCurrentRect] = useState<RedactionRect | null>(null);


  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.src = imageSrc;
  }, [imageSrc]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = image.width;
    canvas.height = image.height;

    // Draw original image
    ctx.drawImage(image, 0, 0);

    // Draw redaction rectangles
    const allRects = currentRect ? [...rects, currentRect] : rects;
    for (const rect of allRects) {
      // Create a blurred version by drawing a clipped region
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.width, rect.height);
      ctx.clip();

      // Fill with a solid color block + pattern
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

      // Add a "?" pattern
      ctx.fillStyle = "#e94560";
      ctx.font = `bold ${Math.min(Math.abs(rect.height) * 0.6, 80)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        "?",
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
      );

      // Add border
      ctx.restore();
      ctx.strokeStyle = "#e94560";
      ctx.lineWidth = 3;
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
  }, [image, rects, currentRect]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const pos = getCanvasPos(e);
    setDrawing(true);
    setStartPos(pos);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing || !startPos) return;
    const pos = getCanvasPos(e);
    setCurrentRect({
      x: startPos.x,
      y: startPos.y,
      width: pos.x - startPos.x,
      height: pos.y - startPos.y,
    });
  }

  function handleMouseUp() {
    if (currentRect) {
      // Only add rects that are big enough (not accidental clicks)
      if (Math.abs(currentRect.width) > 10 && Math.abs(currentRect.height) > 10) {
        setRects((prev) => [...prev, currentRect]);
      }
    }
    setDrawing(false);
    setStartPos(null);
    setCurrentRect(null);
  }

  function handleUndo() {
    setRects((prev) => prev.slice(0, -1));
  }

  function handleClear() {
    setRects([]);
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  }

  if (!image) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-400">
        Loading image...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-zinc-400">
        Draw rectangles over brand names and logos to redact them.
      </div>

      <div className="overflow-auto rounded-lg border border-zinc-700">
        <canvas
          ref={canvasRef}
          className="max-w-full cursor-crosshair"
          style={{ maxHeight: "600px", width: "100%" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleUndo}
          disabled={rects.length === 0}
          className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-600 disabled:opacity-40"
        >
          Undo
        </button>
        <button
          onClick={handleClear}
          disabled={rects.length === 0}
          className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-600 disabled:opacity-40"
        >
          Clear All
        </button>
        <div className="flex-1" />
        <span className="text-sm text-zinc-400">
          {rects.length} redaction{rects.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={handleSave}
          disabled={rects.length === 0}
          className="rounded-lg bg-rose-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-rose-500 disabled:opacity-40"
        >
          Save Redacted Image
        </button>
      </div>
    </div>
  );
}
