export default function JigsawControls({ canInteract, fullscreen, showUtilities = true, onPreview, onFullscreen, onExitFullscreen, onHelp, onReturn, onReset }: {
  canInteract: boolean;
  fullscreen: boolean;
  showUtilities?: boolean;
  onPreview: () => void;
  onFullscreen: () => void;
  onExitFullscreen: () => void;
  onHelp: () => void;
  onReturn: () => void;
  onReset: () => void;
}) {
  return <div className="jigsaw-controls" aria-label="Jigsaw controls">
    {showUtilities && <>
      <button type="button" aria-label="Preview image" disabled={!canInteract} onClick={onPreview}>Preview</button>
      <button type="button" aria-label="How to play" onClick={onHelp}>Help</button>
      <button type="button" aria-label="Return loose pieces to tray" disabled={!canInteract} onClick={onReturn}>Tray</button>
      <button type="button" aria-label="Reset puzzle" disabled={!canInteract} onClick={onReset}>Reset</button>
      <button type="button" aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} onClick={fullscreen ? onExitFullscreen : onFullscreen}>{fullscreen ? "Exit" : "Full"}</button>
    </>}
  </div>;
}
