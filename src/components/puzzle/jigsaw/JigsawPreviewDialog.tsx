import JigsawDialogFrame from "./JigsawDialogFrame";

export default function JigsawPreviewDialog({ imageUrl, puzzleTitle, onClose }: { imageUrl: string; puzzleTitle: string; onClose: () => void }) {
  return <JigsawDialogFrame title="Puzzle preview" onClose={onClose}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="jigsaw-preview-image" src={imageUrl} alt={`Completed image for ${puzzleTitle}`} />
    <button type="button" onClick={onClose}>Close Preview</button>
  </JigsawDialogFrame>;
}
