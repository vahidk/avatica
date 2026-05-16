---
name: app-builder
description: Build custom apps with manifest, view, run, and estimate files. Use when the user wants to create, modify, or debug a custom app.
---

## Skill: App Builder

Build custom apps. An app has four files inside a .app folder.

### Tools

- `builder__create_app` — create a new app folder (returns folder ID)
- `builder__write_app_file` — write a file into the app folder
- `builder__publish_app` — publish the app so it appears in the app grid

### Workflow

Follow this exact order:

1. Call `builder__create_app` with a name — returns a folder ID
2. Call `builder__write_app_file` for each of: `manifest.json`, `run.js`, `estimate.js`, `view.html` — use the folder ID from step 1
3. Call `builder__publish_app` with the folder ID to make it available

Always create all four files before publishing.

### Reference: manifest.json

```json
{
  "id": "my_app",
  "name": "My App",
  "menu": ["Image"],
  "icon": "wand-magic-sparkles",
  "function": {
    "description": "What this app does",
    "inputSchema": {
      "type": "object",
      "properties": {
        "prompt": { "type": "string" }
      },
      "required": ["prompt"]
    }
  }
}
```

| Field | Values |
|-------|--------|
| `menu` | `"Image"`, `"Video"`, `"Audio"`, `"Entity"`, `"Custom"` |
| `icon` | FontAwesome name without `fa-` prefix: `image`, `video`, `film`, `music`, `microphone`, `camera`, `wand-magic-sparkles`, `palette`, `shirt`, `scissors`, `cube`, `mountain-sun`, `clapperboard`, `user`, `users` |

Property names in `inputSchema.properties` become form fields AND are available as `context.input.propertyName` in run.js and estimate.js.

### Reference: run.js

Sandboxed JavaScript. All APIs are async.

**AI generation** — each call auto-saves to the project and returns a file ID:

| Function | Parameters | Returns |
|----------|-----------|---------|
| `ai.text` | `prompt`, `schema?`, `provider?` | text string |
| `ai.image` | `prompt`, `mode?` (`"generate"`, `"edit"`), `images?`, `sourceImage?`, `aspectRatio?`, `imageSize?`, `provider?` | file ID |
| `ai.video` | `prompt`, `mode?` (`"generate"`, `"image_to_video"`, `"interpolate"`, `"extend"`, `"edit"`), `images?`, `startImage?`, `endImage?`, `sourceVideo?`, `duration?`, `resolution?`, `aspectRatio?`, `provider?` | file ID |
| `ai.audio` | `prompt`, `format?` (`"mp3"`, `"wav"`), `provider?` | file ID |
| `ai.speech` | `prompt`, `voice?`, `languageCode?`, `multiSpeaker?`, `provider?` | file ID |

- `images` = comma-separated file IDs for reference/style guidance
- `sourceImage` / `sourceVideo` = file ID of asset to edit or extend
- `startImage` / `endImage` = file IDs for interpolation mode

**Stateful chat** — multi-turn conversation within a single run:
```js
const chat = ai.chat({ provider: 'gemini-3.1-pro' }); // optional provider
const reply1 = await chat.send("First message");       // returns text
const reply2 = await chat.send("Follow-up");           // has context of reply1
```

**File operations**:
```js
// Read a file — returns { id, name, type, schema?, url, content? }
// content is included for JSON/text files, url is a signed GCS URL for binary files
const fileData = await file.read(fileId);

// List project files, optionally filtered by schema
const files = await file.list({ schema: "custom:x" });

// Save a file — name is required (include the extension).
await file.save(data, { name: "out.json", type: "application/json" });
await file.save(data, { name: "scene.scene", type: "application/json", schema: "scene.v1" });

// Get a schema definition by ID
const schemaDef = await schema.get("character.v1"); // or "custom:my_schema"

// Load a prompt template bundled with the app (Handlebars syntax supported)
const content = await app.prompt("prompts/guide.hbs");
const rendered = await app.prompt("prompts/brief.hbs", { name: "Alice", style: "noir" });

// Generate a descriptive, unique slug for an asset name (no extension).
// Use this when you want a human-readable filename derived from the prompt
// or generated content. Falls back to the supplied label on LLM failure.
const slug = await app.assetName(context.input.prompt, "script");
await file.save(content, { name: slug + ".md", type: "text/markdown" });
```

**Context**:
```js
context.input.paramName  // form input values
context.projectId        // current project UUID
context.userId           // current user ID
log("message")           // visible in log panel
```

**Rules**:
- `ai.image/video/audio/speech` auto-save results — no manual save needed
- Errors propagate automatically — no try/catch needed
- Code runs sandboxed with time and memory limits

### Reference: estimate.js

Must `return` a non-negative number (cost in credits). Runs in a restricted sandbox with no access to `ai`, `file`, `schema`, or `log`. Always multiply final result by `context.pricing.usdToCredits` for portability.

**Available context**:
```js
context.input.paramName
context.pricing.usdToCredits          // cost multiplier — always use this, never hardcode
context.pricing.capabilityDefaults    // { "image/generate": "gemini-3.1-flash-image", ... }
context.pricing.heuristics            // { tokenInputEstimate, tokenOutputEstimate }
context.pricing.imageOutputTokens     // { "512": 750, "1K": 1117, "2K": 1683, "4K": 2517 }
context.pricing.providers             // { "provider-id": { pricing: {...}, capabilities: { "image/generate": { defaults: {...} } } }, ... }
```

**Pricing types**:

| Type | How to estimate |
|------|----------------|
| `per_image` | `provider.pricing.perImage * usdToCredits` |
| `per_request` | `provider.pricing.perRequest * usdToCredits` |
| `token` | `(inputTokens / 1M * inputRate + outputTokens / 1M * outputRate) * usdToCredits` |
| `video` | `provider.pricing.video.perSecond[resolution] * seconds * usdToCredits` |

### Reference: view.html

```html
<app-view>
  <app-row>
    <app-input name="prompt" placeholder="Describe..." required></app-input>
    <app-submit></app-submit>
  </app-row>
</app-view>
```

**Components**:

| Component | Attributes | Notes |
|-----------|-----------|-------|
| `<app-view>` | — | Root container (required) |
| `<app-input>` | `name`, `label`, `placeholder`, `required`, `type` (`text`, `number`, `textarea`), `min`, `max`, `rows` | |
| `<app-select>` | `name`, `label`, `value`, `options` | Static `<option>` children or dynamic `options="$providers.image.generate[model].imageSize"` |
| `<app-file>` | `name`, `accept`, `multiple`, `max`, `size` (`sm`, `md`, `lg`, `xl`), `schema`, `label` | Value is comma-separated file IDs. Use `schema="character.v1"` etc. to filter by asset type |
| `<app-image-select>` | `name`, `label`, `multiple`, `required`, `columns` | `<option value="v" label="L" image="path">` children. Image paths are relative to the app folder |
| `<app-mode>` | `name`, `value`, `label` | Segmented toggle that shows/hides child panels. Children are `<app-mode-option>` |
| `<app-mode-option>` | `value`, `label`, `icon` | Child of `<app-mode>`. `icon` is FontAwesome name without `fa-` prefix (e.g. `venus`, `mars`). Value can be comma-separated to show panel for multiple modes. Content inside is shown when active |
| `<app-wizard>` | — | Multi-step container |
| `<app-wizard-step>` | `title` | Child of `<app-wizard>` |
| `<app-submit>` | `label`, `icon` | Submit button |
| `<app-row>` | — | Horizontal layout |
| `<app-spacer>` | — | Flexible space |
| `<app-stepper>` | `name`, `value`, `min`, `max`, `label` | Numeric stepper |

**Labels**: Use `$camelCase` keys for labels (e.g. `label="$colorPalette"`). These auto-convert to readable text ("Color Palette") via camelCase splitting. Apps can optionally provide `i18n/en.json` and `i18n/ja.json` files for explicit translations, but the fallback works without them.

**Dynamic options**: Use `options="$providers.{group}.{action}[model].{field}"` to populate a select from the provider registry (e.g. `$providers.video.generate[model].resolution`). The model select uses `options="$providers.{group}.{action}"` (e.g. `$providers.image.generate`).

Available capabilities: `image.generate`, `image.edit`, `video.generate`, `video.image_to_video`, `video.interpolate`, `video.extend`, `audio.generate`, `speech.generate`.

### Example

```json
// manifest.json
{
  "id": "portrait_gen",
  "name": "Portrait Generator",
  "menu": ["Image"],
  "icon": "camera",
  "function": {
    "description": "Generate a styled portrait",
    "inputSchema": {
      "type": "object",
      "properties": {
        "prompt": { "type": "string", "description": "Text prompt describing the portrait" },
        "style": { "type": "string", "description": "Art style", "default": "cinematic" },
        "model": { "type": "string", "description": "AI model to use" }
      },
      "required": ["prompt"]
    }
  }
}
```

```js
// run.js
await ai.image({
  prompt: `${context.input.style} portrait: ${context.input.prompt}`,
  aspectRatio: '3:4',
  provider: context.input.model || undefined,
});
```

```js
// estimate.js
const providerId = context.input.model || context.pricing.capabilityDefaults['image/generate'];
const provider = context.pricing.providers[providerId];
if (provider.pricing.type === 'per_image') {
  return provider.pricing.perImage * context.pricing.usdToCredits;
}
const rates = provider.pricing.token;
const outputTokens = context.pricing.imageOutputTokens['1K'];
return ((context.pricing.heuristics.tokenInputEstimate / 1_000_000) * rates.inputPer1M +
  (outputTokens / 1_000_000) * rates.imageOutputPer1M) * context.pricing.usdToCredits;
```

```html
<!-- view.html -->
<app-view>
  <app-row>
    <app-select name="model" label="$model" options="$providers.image.generate"></app-select>
    <app-select name="style" value="cinematic" label="$style">
      <option value="cinematic">Cinematic</option>
      <option value="anime">Anime</option>
      <option value="watercolor">Watercolor</option>
    </app-select>
  </app-row>
  <app-row>
    <app-input name="prompt" placeholder="Describe the portrait" required></app-input>
    <app-submit></app-submit>
  </app-row>
</app-view>
```
