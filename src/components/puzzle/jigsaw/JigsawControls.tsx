export default function JigsawControls({ zoom, canInteract, fullscreen, showUtilities = true, onZoomIn, onZoomOut, onResetZoom, onPreview, onFullscreen, onExitFullscreen, onHelp, onReturn, onReset }: {
  zoom: number;
  canInteract: boolean;
  fullscreen: boolean;
  showUtilities?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onPreview: () => void;
  onFullscreen: () => void;
  onExitFullscreen: () => void;
  onHelp: () => void;
  onReturn: () => void;
  onReset: () => void;
}) {
  return <div className="jigsaw-controls" aria-label="Jigsaw controls">
    <button type="button" aria-label="Zoom in" disabled={!canInteract || zoom >= 4} onClick={onZoomIn}>+</button>
    <button type="button" aria-label="Reset zoom" disabled={!canInteract || zoom === 1} onClick={onResetZoom}>{Math.round(zoom * 100)}%</button>
    <button type="button" aria-label="Zoom out" disabled={!canInteract || zoom <= .4} onClick={onZoomOut}>−</button>
    {showUtilities && <>
      <button type="button" aria-label="Preview image" disabled={!canInteract} onClick={onPreview}>Preview</button>
      <button type="button" aria-label="How to play" onClick={onHelp}>Help</button>
      <button type="button" aria-label="Return loose pieces to tray" disabled={!canInteract} onClick={onReturn}>Tray</button>
      <button type="button" aria-label="Reset puzzle" disabled={!canInteract} onClick={onReset}>Reset</button>
      <button type="button" aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} onClick={fullscreen ? onExitFullscreen : onFullscreen}>{fullscreen ? "Exit" : "Full"}</button>
    </>}
  </div>;
}
