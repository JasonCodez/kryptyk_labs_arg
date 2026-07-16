import JigsawDialogFrame from "./JigsawDialogFrame";

export default function JigsawHelpDialog({ onClose }: { onClose: () => void }) {
  return <JigsawDialogFrame title="How to play Jigsaw" onClose={onClose}>
    <p>Move loose pieces from the tray onto the board. Neighboring pieces connect when their edges and positions match.</p>
    <p>Pinch or use the zoom controls to inspect details. Drag with one finger to pan while zoomed.</p>
    <p>Keyboard: select a tray group with Enter, move with Arrow keys, press Enter to try snapping, T to return it, P for Preview, and 0 to reset zoom.</p>
    <button type="button" onClick={onClose}>Got it</button>
  </JigsawDialogFrame>;
}
