# Media Upload System - ARG Puzzle Platform

## Overview

The media upload system enables administrators to attach rich media (images, videos, audio, documents) to ARG puzzles, creating immersive puzzle experiences with multimedia content.

## Architecture

### Database Schema

**PuzzleMedia Model** (`prisma/schema.prisma`)
```prisma
model PuzzleMedia {
  id          String   @id @default(cuid())
  puzzleId    String
  puzzle      Puzzle   @relation(fields: [puzzleId], references: [id], onDelete: Cascade)
  
  // File information
  type        String   // "image" | "video" | "audio" | "document"
  url         String   // Public URL path: /uploads/media/filename
  fileName    String   // Original filename
  fileSize    Int      // Size in bytes
  mimeType    String   // MIME type
  
  // Display metadata
  title       String?  // User-friendly title
  description String?  // Description text
  order       Int      @default(0) // Display order
  
  // Media-specific metadata
  duration    Int?     // Duration in seconds (video/audio)
  width       Int?     // Image/video width in pixels
  height      Int?     // Image/video height in pixels
  thumbnail   String?  // Thumbnail URL for videos
  
  // Tracking
  uploadedBy  String   // User ID who uploaded
  uploadedAt  DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([puzzleId])
  @@index([type])
}
```

### Supported Media Types

| Type | Extensions | MIME Types | Max Size |
|------|-----------|-----------|----------|
| **Image** | jpg, jpeg, png, gif, webp, svg | image/* | 500MB |
| **Video** | mp4, webm, mov, avi | video/* | 500MB |
| **Audio** | mp3, wav, webm, ogg | audio/* | 500MB |
| **Document** | pdf, txt, doc, docx | application/pdf, text/plain | 500MB |

### File Storage

- **Location**: `public/uploads/media/`
- **Filename Format**: `{timestamp}_{randomId}_{originalExtension}`
- **Public URL**: `/uploads/media/{filename}`
- **Example**: `/uploads/media/1735404123456_abc123def_puzzle_clue.mp4`

## API Endpoints

### Upload Media

**Endpoint**: `POST /api/admin/media`

**Authentication**: Admin only (checked via user role)

**Request Body**: Multipart FormData
```
- file: File (binary)
- puzzleId: string (UUID)
```

**Response (Success - 200)**
```json
{
  "id": "clxxxxx",
  "puzzleId": "puzzle-id-123",
  "type": "video",
  "url": "/uploads/media/1735404123456_abc123def_clue.mp4",
  "fileName": "clue.mp4",
  "fileSize": 52428800,
  "mimeType": "video/mp4",
  "title": null,
  "description": null,
  "order": 0,
  "duration": null,
  "width": null,
  "height": null,
  "thumbnail": null,
  "uploadedBy": "user-id",
  "uploadedAt": "2024-12-28T...",
  "updatedAt": "2024-12-28T..."
}
```

**Response (Errors)**
- `400 Bad Request` - No file provided or no puzzleId
- `401 Unauthorized` - User not authenticated
- `403 Forbidden` - User is not an admin
- `413 Payload Too Large` - File exceeds 500MB
- `415 Unsupported Media Type` - Invalid file type

### Delete Media

**Endpoint**: `DELETE /api/admin/media?id={mediaId}`

**Authentication**: Admin only

**Response (Success - 200)**
```json
{
  "success": true,
  "message": "Media deleted successfully"
}
```

**Response (Errors)**
- `400 Bad Request` - No media ID provided
- `401 Unauthorized` - User not authenticated
- `403 Forbidden` - User is not an admin
- `404 Not Found` - Media not found

## Frontend Components

### Puzzle Creator (Admin Page)

**File**: `src/app/admin/puzzles/page.tsx`

**Features**:
- 3-column layout with media sidebar
- Multiple file upload support
- Real-time upload progress
- Media listing with delete buttons
- File type icons and size display
- Admin-only access control

**Key States**:
- `mediaFiles` - Array of uploaded media
- `uploadingMedia` - Upload in progress
- `puzzleId` - Current puzzle being created

**Sticky Media Sidebar**: Shows uploaded media while scrolling through form

### Puzzle Viewer

**File**: `src/app/puzzles/[id]/page.tsx`

**Features**:
- Grid layout for media display (1-2 columns)
- Native media players:
  - Images: Responsive with object-cover
  - Videos: HTML5 video player with controls
  - Audio: HTML5 audio player with controls
  - Documents: File icon with download link
- Media metadata display (title, description, file size)
- Ordered media display

**Media Section**: Rendered after puzzle content/description

## Workflow

### Step 1: Admin Creates Puzzle

1. Navigate to `/admin/puzzles`
2. Fill in puzzle details (title, description, content, etc.)
3. System creates temporary placeholder for media

### Step 2: Upload Media

1. Click "Choose Files" in media sidebar
2. Select one or multiple files
3. Files upload automatically via FormData
4. Media appears in list with:
   - File type emoji (🖼️ 🎬 🎵 📄)
   - Filename
   - File size in MB
5. Delete option available for each file

### Step 3: Complete Puzzle Creation

1. Click "Create Puzzle"
2. Backend:
   - Validates puzzle data
   - Links all media to puzzle
   - Stores metadata in database
3. Success confirmation
4. Redirect to puzzles list

### Step 4: View Puzzle with Media

1. Player clicks puzzle in list
2. Loads `/puzzles/[id]`
3. API fetches puzzle WITH media:
   ```typescript
   include: {
     media: {
       orderBy: { order: "asc" }
     }
   }
   ```
4. Media displays in grid below content
5. Player can interact (watch, listen, read)

## Security Features

### File Validation

1. **MIME Type Checking**
   - Validates against allowed types per category
   - Prevents executable files
   - Checks actual file content, not just extension

2. **File Size Limits**
   - Max 500MB per file
   - Configurable per type
   - Prevents storage abuse

3. **Admin-Only Access**
   - Both API endpoints check user role
   - Non-admins receive 403 Forbidden
   - Server-side verification (not client-side)

4. **Filename Sanitization**
   - Timestamps prevent collisions
   - Random ID added for uniqueness
   - Original extension preserved
   - No special characters in filename

### Database Integrity

- **Cascade Delete**: When puzzle deleted, all media deleted
- **User Tracking**: Records who uploaded each file
- **Timestamps**: Audit trail with uploadedAt/updatedAt

## Testing the System

### Manual Testing Steps

1. **Login as Admin**
   ```bash
   # Use admin account or promote user:
   node scripts/make-admin.js admin@example.com
   ```

2. **Create Puzzle with Media**
   - Go to `/admin/puzzles`
   - Fill form
   - Upload: image, video, audio files
   - Create puzzle

3. **Verify Storage**
   ```bash
   ls public/uploads/media/
   # Should see: timestamp_id_filename.ext files
   ```

4. **Verify Database**
   ```bash
   # Use Prisma Studio:
   npx prisma studio
   # Navigate to PuzzleMedia table
   # Should see records for each uploaded file
   ```

5. **View as Player**
   - Logout and login as regular user
   - Navigate to puzzle
   - Should see media displayed below content
   - Test playback/interaction

### API Testing (cURL)

```bash
# Upload media
curl -X POST http://localhost:3000/api/admin/media \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -F "file=@path/to/video.mp4" \
  -F "puzzleId=PUZZLE_ID"

# Delete media
curl -X DELETE "http://localhost:3000/api/admin/media?id=MEDIA_ID" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION"
```

## Configuration

### File Size Limits

Edit in `src/app/api/admin/media/route.ts`:
```typescript
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
```

### Allowed MIME Types

Edit in `src/app/api/admin/media/route.ts`:
```typescript
const ALLOWED_TYPES = {
  image: ["image/jpeg", ...],
  video: ["video/mp4", ...],
  audio: ["audio/mpeg", ...],
  document: ["application/pdf", ...],
};
```

### Upload Directory

Default: `public/uploads/media/`

To change, update:
1. Upload endpoint: `src/app/api/admin/media/route.ts` (UPLOAD_DIR)
2. Puzzle API: Ensure media.url matches public path

## Database Migration

Applied migration: `20251228125647_add_puzzle_media_model`

To reset database and reapply:
```bash
npx prisma migrate reset --force
```

To view migration status:
```bash
npx prisma migrate status
```

## Troubleshooting

### Media Not Appearing in Puzzle

1. **Check Database**
   - Verify media record exists: `prisma studio`
   - Check puzzleId matches

2. **Check File Storage**
   - Verify file exists in `public/uploads/media/`
   - Check file permissions

3. **Check API Response**
   - Fetch puzzle via `/api/puzzles/[id]`
   - Verify media array is present
   - Check URLs are correct

### Upload Failing

1. **Check Admin Status**
   - Verify user role is "admin" in database
   - Check session cookie

2. **Check File**
   - Verify file size < 500MB
   - Verify MIME type is allowed
   - Check file isn't corrupted

3. **Check Server Logs**
   - Terminal output for errors
   - Check `public/uploads/media/` directory exists

### Storage Space Issues

1. **Monitor Uploads Directory**
   ```bash
   du -sh public/uploads/media/
   ```

2. **Clean Old Files** (if needed)
   ```bash
   # Find files older than 30 days
   find public/uploads/media/ -mtime +30
   ```

## Future Enhancements

1. **Cloud Storage Integration**
   - AWS S3, Azure Blob Storage, or Cloudinary
   - Reduces server storage needs
   - Better scalability

2. **Media Metadata Editing**
   - Update title/description after upload
   - Reorder media display
   - Add captions/subtitles

3. **Thumbnail Generation**
   - Auto-generate video thumbnails
   - Generate image previews
   - CDN delivery

4. **Media Gallery Component**
   - Lightbox viewer for images
   - Carousel for multiple files
   - Full-screen video player

5. **Transcoding Service**
   - Convert videos to web-friendly formats
   - Optimize file sizes
   - Multiple quality levels

6. **Access Control**
   - Media preview permissions
   - Download tracking
   - Usage analytics

7. **Streaming Optimization**
   - HLS/DASH support for video
   - Adaptive bitrate streaming
   - Progressive downloads

## Related Files

- **Database**: `prisma/schema.prisma` - PuzzleMedia model
- **Admin Page**: `src/app/admin/puzzles/page.tsx` - Puzzle creator with media upload
- **Upload API**: `src/app/api/admin/media/route.ts` - File upload/delete endpoints
- **Puzzle API**: `src/app/api/puzzles/[id]/route.ts` - Fetch puzzle with media
- **Puzzle Viewer**: `src/app/puzzles/[id]/page.tsx` - Display media in puzzle
- **Dashboard**: `src/app/dashboard/page.tsx` - Admin card conditional rendering

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review API response errors
3. Check browser console for client errors
4. Check terminal for server errors
5. Examine database via `prisma studio`
