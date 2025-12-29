# Media Upload System - Quick Start Guide

## Quick Overview

You can now upload **images, videos, audio, and documents** when creating ARG puzzles. Media is stored in `public/uploads/media/` and displays in the puzzle viewer.

## For Admins: Creating a Puzzle with Media

### 1. Navigate to Puzzle Creator
```
Login → Dashboard → Create Puzzle (admin only)
or direct: http://localhost:3000/admin/puzzles
```

### 2. Fill Puzzle Form
- **Title**: Puzzle name
- **Description**: Short summary
- **Content**: Main puzzle text/clues
- **Category**: Select category
- **Correct Answer**: Answer to validate
- **Points**: Reward for solving
- **Hints**: Optional clues (expandable)

### 3. Upload Media
In the **right sidebar**:
1. Click **"Choose Files"** button
2. Select one or more files (images, videos, audio, etc.)
3. Files auto-upload and appear in the list
4. Each file shows:
   - 🖼️ Icon (indicates type)
   - Filename
   - File size in MB
   - Delete button (❌)

### 4. Create Puzzle
- Click **"Create Puzzle"** button
- Media stays linked to puzzle
- Success message confirms creation

## For Players: Solving Puzzles with Media

### 1. Open Puzzle
```
Puzzles → Click puzzle title
```

### 2. View Media
**📎 Media section** below puzzle description shows:

- **Images**: Click to view full size
- **Videos**: Play button, timeline scrubber, volume control
- **Audio**: Play/pause, progress bar, volume control
- **Documents**: Download link to PDF/text files

### 3. Solve Puzzle
- Read content
- Study media clues
- Submit your answer in the text box

## API Usage

### Upload File
```bash
curl -X POST http://localhost:3000/api/admin/media \
  -H "Cookie: next-auth.session-token=TOKEN" \
  -F "file=@puzzle_clue.mp4" \
  -F "puzzleId=puzzle-12345"
```

**Response**:
```json
{
  "id": "media-id-123",
  "url": "/uploads/media/1735404123456_abc123_puzzle_clue.mp4",
  "type": "video",
  "fileSize": 52428800,
  "mimeType": "video/mp4"
}
```

### Delete File
```bash
curl -X DELETE "http://localhost:3000/api/admin/media?id=media-id-123" \
  -H "Cookie: next-auth.session-token=TOKEN"
```

### Get Puzzle with Media
```bash
curl http://localhost:3000/api/puzzles/puzzle-id-123
```

**Response includes**:
```json
{
  "id": "puzzle-id-123",
  "title": "The Hidden Code",
  "media": [
    {
      "id": "media-1",
      "type": "video",
      "url": "/uploads/media/1735404123456_abc123_clue.mp4",
      "fileSize": 52428800,
      "title": "Encrypted Message",
      "order": 0
    }
  ]
}
```

## File Types & Limits

| Type | Extensions | Max Size | MIME Types |
|------|-----------|----------|-----------|
| Image | jpg, png, gif, webp, svg | 500MB | image/* |
| Video | mp4, webm, mov, avi | 500MB | video/* |
| Audio | mp3, wav, webm, ogg | 500MB | audio/* |
| Document | pdf, txt, doc, docx | 500MB | application/pdf, text/* |

## Troubleshooting

### "Admin access denied"
→ Make sure you're logged in as an admin. Promote user with:
```bash
node scripts/make-admin.js your-email@example.com
```

### "File type not allowed"
→ Check file is actually that type. MIME type is validated.

### "Upload keeps failing"
→ Check:
1. File size < 500MB
2. Correct file format for its type
3. Server has write permissions to `public/uploads/media/`

### "Media not showing in puzzle"
→ Check:
1. Media appears in admin page media list
2. Puzzle was created successfully
3. File exists in `public/uploads/media/`

## Directory Structure

```
public/
└── uploads/
    └── media/
        ├── 1735404123456_abc123_intro.mp4
        ├── 1735404130000_def456_clue.jpg
        └── 1735404135001_ghi789_audio.mp3

src/app/
├── admin/
│   └── puzzles/
│       └── page.tsx          ← Puzzle creator with media upload
├── api/
│   ├── admin/
│   │   └── media/
│   │       └── route.ts      ← Upload/delete endpoints
│   └── puzzles/
│       └── [id]/
│           └── route.ts      ← Fetch puzzle with media
└── puzzles/
    └── [id]/
        └── page.tsx          ← Display media in puzzle

prisma/
└── schema.prisma              ← PuzzleMedia model
```

## Key Features

✅ **Multiple file types** - Images, videos, audio, documents
✅ **Drag & drop upload** - Easy file selection
✅ **Real-time preview** - See uploaded files instantly
✅ **Admin-only access** - Only admins can upload
✅ **Auto-validation** - File type and size checked
✅ **Secure storage** - Files timestamped and uniquely named
✅ **Database tracking** - Full metadata stored
✅ **Responsive display** - Works on all screen sizes
✅ **Native players** - HTML5 video/audio with controls

## Common Patterns

### Create Horror/Suspense Puzzle
```
Content: Cryptic text clues
Audio: Spooky background music
Video: Short eerie footage
Image: Blurred or distorted photos
→ Player experiences through multiple senses
```

### Create Detective Puzzle
```
Content: Case description
Images: Crime scene photos, evidence pictures
Document: PDF police report or letter
Video: Interview footage
→ Player analyzes evidence across formats
```

### Create Treasure Hunt
```
Content: Location riddle
Image: Map or landmark photo
Audio: Language lesson (polyglot hunt)
Video: Landmark walkthrough
→ Player uses geographic and visual clues
```

## Next Steps

1. ✅ **Create test puzzle** - Use admin page to try uploading
2. ✅ **Test playback** - View puzzle as regular user
3. ✅ **Create immersive puzzle** - Combine multiple media types
4. ✅ **Test answers** - Verify submission works with media

## Performance Tips

- **Compress videos** before upload (use HandBrake or ffmpeg)
- **Optimize images** with tools like ImageOptim or TinyPNG
- **Use appropriate formats**: MP4 for video, MP3 for audio
- **Keep file sizes under 100MB** for faster loading

## Support

Check [MEDIA_SYSTEM.md](MEDIA_SYSTEM.md) for detailed documentation, troubleshooting, and advanced features.
