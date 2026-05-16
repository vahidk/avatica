---
name: compose
description: Create and edit video sequences that arrange media files on a multi-track timeline. Use when the user wants to compose, edit, or arrange clips.
---

## Skill: Compose

Create video sequences that arrange media files on a multi-track timeline.

### Tools

- `file__list` — list available project files (returns ID, name, type, duration). Pass `type: "video"`, `"audio"`, or `"image"` to filter.
- `file__read` — read a file's text content by ID (used to inspect existing .seq files before modifying them)
- `compose__write_sequence` — write a sequence with tracks and clips (creates or overwrites)

### Workflow

Follow this exact order:

1. **Read first** — if the user references an existing sequence, call `file__read` with the sequence's file ID to understand its current state before modifying
2. **Generate media** — if the user needs new images/videos/audio, generate ALL of them using the app tools (image_generation, video_generation, etc.) before composing
3. **List files** — call `file__list` to get IDs for all available files (including ones just generated)
4. **Write sequence** — call `compose__write_sequence` once with all tracks and clips, referencing the file IDs from step 3

### Reference

**Sequence settings**: `width` (1920), `height` (1080), `fps` (30)

**Track types**: `"video"`, `"audio"`
- First video track in the array renders on top
- Audio tracks play sound

**Clip kinds** — every clip must be one of these two kinds:

| Kind | Fields | Use for |
|------|--------|---------|
| `"media"` | `fileId`, `start`, `duration` | Video, audio, and image files |
| `"overlay"` | `templateId`, `vars`, `start`, `duration` | Any text on screen: titles, captions, credits, intros, endings |

**For any text on screen (titles, captions, intros, credits, lower-thirds), ALWAYS use `kind: "overlay"`. NEVER generate an image or use `kind: "media"` for text.**

**Overlay templates**:

| Template | Vars (defaults) |
|----------|----------------|
| `"title"` | `text`, `fontSize` (72), `color` (#ffffff), `fontWeight`, `align`, `position` (center), `bg` (none) |
| `"subtitle"` | `text`, `fontSize` (36), `color`, `fontWeight`, `align`, `position` (bottom), `bg` (dark) |
| `"caption"` | `text`, `fontSize` (24), `color` (#cccccc), `fontWeight`, `align`, `position` (bottom), `bg` (none) |
| `"lower-third"` | `name`, `title`, `color` (#ffffff), `accentColor` (#3b82f6) |

**Position values**: `center`, `top`, `bottom`, `top-left`, `top-right`, `bottom-left`, `bottom-right`
**Background values**: `none`, `dark`, `light`
**Font weight values**: `normal`, `bold`, `300`
**Align values**: `center`, `left`, `right`

**Rules**:
- `fileId` must be a UUID from `file__list`, never a file name
- Clips on the same track must not overlap
- Duration for images = display time (e.g. 5000 = 5 seconds)
- For video/audio, match duration to the file's actual duration
- Overlay track must come before media track to render on top

### Example

Given `file__list` returns:
```
- "intro.mp4" — fileId: "a1b2c3d4-..." (video/mp4, 5s)
- "hero.jpg" — fileId: "e5f6g7h8-..." (image/jpeg)
- "main.mp4" — fileId: "i9j0k1l2-..." (video/mp4, 8s)
- "bgm.mp3" — fileId: "m3n4o5p6-..." (audio/mp3, 20s)
```

```
write_sequence({
  name: "Product Launch",
  tracks: [
    {
      type: "video",
      name: "Text",
      clips: [
        { kind: "overlay", templateId: "title", start: 0, duration: 3000, vars: { text: "INTRODUCING", fontSize: 72, color: "#ffffff", position: "center", bg: "dark" } },
        { kind: "overlay", templateId: "subtitle", start: 5000, duration: 4000, vars: { text: "The future of design", fontSize: 36, position: "bottom", bg: "dark" } },
        { kind: "overlay", templateId: "lower-third", start: 13000, duration: 4000, vars: { name: "Jane Smith", title: "CEO", accentColor: "#3b82f6" } }
      ]
    },
    {
      type: "video",
      name: "Media",
      clips: [
        { kind: "media", fileId: "a1b2c3d4-...", start: 0, duration: 5000 },
        { kind: "media", fileId: "e5f6g7h8-...", start: 5000, duration: 4000 },
        { kind: "media", fileId: "i9j0k1l2-...", start: 9000, duration: 8000 }
      ]
    },
    {
      type: "audio",
      name: "Music",
      clips: [
        { kind: "media", fileId: "m3n4o5p6-...", start: 0, duration: 17000 }
      ]
    }
  ]
})
```
