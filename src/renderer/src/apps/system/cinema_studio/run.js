var cameraMovement = context.input.cameraMovement || '';
var motionPrompt = (context.input.prompt || '').trim();

var MOVEMENT_LABELS = {
  'static': 'static camera (subject moves, camera holds)',
  'pan-left': 'camera pans left',
  'pan-right': 'camera pans right',
  'tilt-up': 'camera tilts up',
  'tilt-down': 'camera tilts down',
  'dolly-in': 'camera dollies in slowly',
  'dolly-out': 'camera dollies out slowly',
  'tracking': 'tracking shot following the subject',
  'crane-up': 'crane shot rising up',
  'crane-down': 'crane shot descending',
  'handheld': 'handheld camera with natural movement',
  'orbit': 'camera orbits around subject',
};

// Step 1: Read the shot file
if (!context.input.shot) {
  throw new Error('A .shot file is required');
}

log('Reading shot...');
var shotFile = await file.read(context.input.shot);
if (!shotFile.content) {
  throw new Error('Could not read shot file');
}
var shot = JSON.parse(shotFile.content);

if (!shot.references || !shot.references.frame) {
  throw new Error('Shot has no generated frame');
}

// Step 2: Build shot context summary for the LLM — only include fields that influence motion/pacing.
// Composition (framing, angle, lens) is already baked into the starting frame, so we omit it.
var contextParts = [];
if (shot.style) {
  if (shot.style.genre) contextParts.push('genre: ' + shot.style.genre);
  if (shot.style.mood) contextParts.push('mood: ' + shot.style.mood);
}

// Step 3: Determine the action — use the user's motion prompt if given, otherwise fall back to the shot's description
var action = motionPrompt || shot.description || '';
if (!action) {
  throw new Error('No action provided — either the shot needs a description or the prompt must be set');
}

// Step 4: Build the motion direction line + detect extra references
var movementLabel = MOVEMENT_LABELS[cameraMovement] || '';
var movementLine = movementLabel ? ('CAMERA MOVEMENT: ' + movementLabel) : '';

var refIds = String(context.input.references || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);

// Step 5: Compose the video prompt via the LLM
var brief = await app.prompt('prompts/motion.hbs', {
  movement: movementLine,
  shotContext: contextParts.join(', '),
  action: action,
});

log('Composing motion prompt...');
var videoPrompt = await ai.text({ prompt: brief, provider: 'gemini-3.1-pro' });

// Append tail directives (continuous shot, grain, color grading) — guaranteed regardless of LLM output
var tail = await app.prompt('prompts/motion-tail.hbs');
videoPrompt = videoPrompt.trim() + '\n\n' + tail.trim();

// Step 6: Generate the video using the shot's frame as the starting image
log('Generating video from frame...');
var videoParams = {
  prompt: videoPrompt,
  mode: 'image_to_video',
  startImage: shot.references.frame,
  resolution: context.input.resolution || '720p',
  duration: Number(context.input.durationSeconds) || 4,
  provider: context.input.model || undefined,
};

if (refIds.length > 0) {
  videoParams.images = refIds.join(',');
}

await ai.video(videoParams);

log('Done!');
