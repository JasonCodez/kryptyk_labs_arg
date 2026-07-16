import JigsawDialogFrame from "./JigsawDialogFrame";

export default function JigsawHelpDialog({ onClose }: { onClose: () => void }) {
  return <JigsawDialogFrame title="How to play Jigsaw" onClose={onClose}>
    <p>Swipe sideways across the tray to browse pieces. Drag a piece upward from the tray to pick it up, then drag it around the board. Matching neighboring pieces connect automatically.</p>
    <p>Place the assembled group over the image to finish it. Use Fullscreen for a larger board — the whole board always stays visible and can&apos;t be zoomed or panned.</p>
    <p>Keyboard: select a tray group with Enter, move with Arrow keys, press Enter to try snapping, T to return it, and P for Preview.</p>
    <button type="button" onClick={onClose}>Got it</button>
  </JigsawDialogFrame>;
}
