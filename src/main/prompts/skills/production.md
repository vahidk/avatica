---
name: production
description: The end-to-end video production pipeline — how to turn an idea into a finished video using Avatica's built-in apps. Load this skill whenever the user wants to create scenes, characters, shots, or full videos from a concept or script.
---

## Skill: Production Pipeline

Avatica has a set of composable apps for video production. Each app produces an asset that flows into the next. Here's the full pipeline and how the assistant should use it.

### Pipeline overview

```
idea / concept
    │
    ▼
script_writer  ──────────────► .md script (with Characters + Scenes sections)
    │
    ├─► character_creator  ──► .char assets
    ├─► scene_creator      ──► .scene assets
    └─► object_creator     ──► .obj assets
                │
                ▼
          shot_creator  ──────► .shot asset (first frame + metadata)
                │
                ▼
         cinema_studio  ──────► .mp4 video (image_to_video from frame)
                │
                ▼
           compose      ──────► .seq sequence (timeline of videos)
```

### Apps

| App | Purpose | Input | Output |
|-----|---------|-------|--------|
| `script_writer` | Write a short video script | concept, genre, style, duration | `.md` with Characters, Scenes, Script sections |
| `character_creator` | Generate a character with reference image + profile | description | `.char` file |
| `scene_creator` | Generate a location with reference image + attributes | description | `.scene` file |
| `object_creator` | Generate an object with reference image | description | `.obj` file |
| `shot_creator` | Compose a first frame for a cinematic shot | scene + characters + objects + direction | `.shot` file |
| `cinema_studio` | Animate a shot's frame into a video | `.shot` + motion/camera direction | `.mp4` video |
| `compose` | Assemble videos into a timeline | file IDs + overlay templates | `.seq` sequence |
| `image_generation` | Generate or edit a standalone image | prompt | image file |
| `video_generation` | Generate a video without asset scaffolding | prompt | `.mp4` video |
| `song_generation` | Generate music | prompt (genre, mood, tempo) | audio file |
| `speech_generation` | Generate speech audio | text, voice | audio file |

### Typical workflow

When the user asks for a full short film or video sequence from an idea:

1. **Write the script** — call `script_writer` with the concept. Output includes:
   - `# Characters` section with each recurring character's description
   - `# Scenes` section with each unique location
   - `# Script` section with the actual scene-by-scene screenplay

2. **Create the cast and environments** — read the script file, parse the Characters and Scenes sections, then:
   - For each character bullet: call `character_creator` with the `prompt` being the description after the `—`
   - For each scene bullet: call `scene_creator` with the `prompt` being the description after the `—`

3. **Build shots** — for each scene in the Script section, call `shot_creator` with:
   - `scene`: the file ID of the matching .scene
   - `characters`: comma-separated file IDs of .char files for characters in that scene
   - `objects`: comma-separated file IDs if relevant
   - `prompt`: the action for the shot (derived from the script's action lines)
   - Creative direction (framing, angle, lens, mood, genre, lighting, color palette, depth of field) — use defaults unless the script's `> **SHOT:**` note specifies otherwise

4. **Animate shots** — for each .shot, call `cinema_studio` with:
   - `shot`: the file ID of the .shot
   - `cameraMovement`: derived from the SHOT note if any
   - `prompt`: leave empty — the shot's own description is used
   - Default to `veo-3.1-lite` (cheapest, supports image_to_video well)

5. **(Optional) Add music** — call `song_generation` with a prompt matching the scene's mood.

6. **Compose the final sequence** — call the `compose` skill to assemble video clips (and music) into a timeline, add title/subtitle overlays as needed.

### Parsing the script

The script file is markdown. The Characters and Scenes sections look like:

```
# Characters

- **Anna** — A 28-year-old white woman, light skin, short brown hair, hazel eyes, olive green sweater, quiet and reserved.
- **Mark** — A 38-year-old handsome Caucasian man, fair skin, black hair, blue eyes, scruffy beard, denim jacket, tired.

# Scenes

- **Coffee Shop** — A small neighborhood coffee shop, mid-morning, warm light through a wide front window.

# Script

## INT. COFFEE SHOP - MORNING [6s]
...
```

To extract a character: split on `— `, take the name before and the description after. Feed the description directly as `prompt` to `character_creator`. Same pattern for scenes.

### Shot vs. video_generation

- Use `shot_creator` + `cinema_studio` when the user has built up characters/scenes and wants consistency across shots. Character likeness is preserved because cinema_studio animates from the generated first frame (`image_to_video`), which Veo reproduces very accurately.
- Use `video_generation` for one-off videos without asset scaffolding. Character likeness is less reliable here.

### Model defaults

- Video: `veo-3.1-lite` is the default. It supports `image_to_video` (what cinema_studio uses) and is the cheapest. Upgrade to `veo-3.1-fast` for higher quality, or `veo-3.1` for maximum quality. xAI's `grok-video` (Grok Imagine) is also available.
- Image: `gemini-3.1-flash-image` is the default. Alternatives: `grok-image` / `grok-image-pro` (xAI), `gpt-image-2` (OpenAI).
- Text: `gemini-3.1-pro` for creative writing, `gemini-3.1-flash-lite` for cheap/fast tasks. `grok-4.2` is also available.

### Rules

- Always wait for a task's output before launching dependent tasks. E.g. character_creator must complete before its file ID can be used in shot_creator.
- Use `file__list` to discover existing assets in the project before generating new ones — the user may already have characters/scenes.
- The user's prompts feed into the `prompt` parameter of each app. Don't concatenate additional framing unless the user asks.
