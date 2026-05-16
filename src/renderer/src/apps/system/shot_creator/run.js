var mode = context.input.mode === 'continue' ? 'continue' : 'create';
var framing = context.input.framing || '';
var cameraAngle = context.input.cameraAngle || '';
var lens = context.input.lens || '';
var depthOfField = context.input.depthOfField || '';
var action = context.input.prompt;

// Style fields (only used in create mode; continue mode inherits from the source shot)
var genre = context.input.genre || '';
var mood = context.input.mood || '';
var colorPalette = context.input.colorPalette || '';
var lighting = context.input.lighting || '';

var GENRE_LABELS = {
  'drama': 'drama', 'horror': 'horror', 'thriller': 'thriller', 'sci-fi': 'sci-fi',
  'fantasy': 'fantasy', 'romance': 'romance', 'western': 'western', 'noir': 'film noir',
  'comedy': 'comedy', 'action': 'action', 'documentary': 'documentary',
  'period': 'period/historical', 'animation': 'animation', 'experimental': 'experimental',
};

var MOOD_LABELS = {
  'tense': 'tense', 'serene': 'serene', 'melancholic': 'melancholic', 'euphoric': 'euphoric',
  'ominous': 'ominous', 'chaotic': 'chaotic', 'intimate': 'intimate', 'epic': 'epic',
  'dreamlike': 'dreamlike', 'mysterious': 'mysterious', 'nostalgic': 'nostalgic',
  'playful': 'playful', 'gritty': 'gritty', 'ethereal': 'ethereal',
};

var COLOR_LABELS = {
  'natural': 'natural color palette', 'warm': 'warm tones (ambers, oranges)',
  'cool': 'cool tones (blues, teals)', 'desaturated': 'desaturated color',
  'high-contrast': 'high contrast', 'neon': 'neon/saturated colors',
  'monochrome': 'monochrome/black and white', 'vintage': 'vintage/faded color',
  'teal-orange': 'teal and orange color grading', 'pastel': 'pastel tones',
  'bleach-bypass': 'bleach bypass look', 'cross-processed': 'cross-processed color',
};

var LENS_LABELS = {
  '16mm': '16mm ultra-wide lens', '24mm': '24mm wide-angle lens', '35mm': '35mm standard lens',
  '50mm': '50mm normal lens', '85mm': '85mm portrait lens', '100mm-macro': '100mm macro lens',
  '135mm': '135mm telephoto lens', '200mm': '200mm+ long telephoto lens',
  'anamorphic': 'anamorphic lens with horizontal flares', 'tilt-shift': 'tilt-shift lens',
  'fisheye': 'fisheye lens',
};

var DOF_LABELS = {
  'deep': 'deep focus (everything sharp)', 'moderate': 'moderate depth of field',
  'shallow': 'shallow depth of field (background soft)', 'very-shallow': 'very shallow depth of field (extreme bokeh)',
  'rack-focus': 'rack focus shifting during shot', 'split-diopter': 'split diopter (two focal planes)',
};

var LIGHTING_LABELS = {
  'natural': 'natural lighting', 'golden-hour': 'golden hour warm light',
  'blue-hour': 'blue hour cool twilight', 'harsh': 'harsh midday sunlight',
  'soft': 'soft overcast lighting', 'backlit': 'backlit with rim light',
  'silhouette': 'silhouette lighting', 'chiaroscuro': 'chiaroscuro dramatic contrast',
  'neon': 'neon/practical light sources', 'moonlit': 'moonlit night',
  'candlelit': 'candlelit warm glow', 'fluorescent': 'fluorescent/industrial lighting',
  'volumetric': 'volumetric god rays', 'low-key': 'low-key dark lighting',
  'high-key': 'high-key bright lighting',
};

var FRAMING_LABELS = {
  'extreme-close-up': 'extreme close-up',
  'close-up': 'close-up shot',
  'medium-close-up': 'medium close-up',
  'medium': 'medium shot',
  'medium-wide': 'medium wide shot',
  'wide': 'wide shot',
  'establishing': 'establishing wide shot',
};

var ANGLE_LABELS = {
  'eye-level': 'eye-level angle',
  'low-angle': 'low angle looking up',
  'high-angle': 'high angle looking down',
  'birds-eye': "bird's eye view from above",
  'dutch-angle': 'dutch angle tilted frame',
  'over-the-shoulder': 'over-the-shoulder shot',
};

// ---- Shared helpers ----

var referenceImageIds = [];

async function readScene(fileId) {
  var r = await file.read(fileId);
  if (!r.content) return null;
  var data = JSON.parse(r.content);
  var parts = [];
  var s = data.setting || {};
  var e = data.environment || {};
  if (s.location) parts.push(s.location);
  if (s.era) parts.push(s.era);
  if (s.interior) parts.push(s.interior);
  if (e.timeOfDay) parts.push(e.timeOfDay);
  if (e.weather) parts.push(e.weather);
  if (e.lighting) parts.push(e.lighting + ' lighting');
  if (data.mood) parts.push(data.mood + ' mood');
  if (e.extra) parts.push(e.extra);
  return {
    name: data.name || '',
    desc: parts.join(', ') || data.description || '',
    frontId: data.references && data.references.front,
  };
}

async function readCharacters(csv) {
  var ids = String(csv || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  var descs = [];
  for (var i = 0; i < ids.length; i++) {
    log('Reading character ' + (i + 1) + '/' + ids.length + '...');
    var r = await file.read(ids[i]);
    if (!r.content) continue;
    var data = JSON.parse(r.content);
    var name = data.name || 'Unknown';
    var ch = data.character || {};
    var d = '';
    if (ch.personality) d += ch.personality;
    if (ch.backstory) d += (d ? '. ' : '') + ch.backstory;
    descs.push(name + (d ? ' (' + d + ')' : ''));
    if (data.references && data.references.front) {
      referenceImageIds.push(data.references.front);
    }
  }
  return descs;
}

async function readObjects(csv) {
  var ids = String(csv || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  var descs = [];
  for (var i = 0; i < ids.length; i++) {
    log('Reading object ' + (i + 1) + '/' + ids.length + '...');
    var r = await file.read(ids[i]);
    if (!r.content) continue;
    var data = JSON.parse(r.content);
    descs.push((data.name || 'Unknown') + (data.description ? ' (' + data.description + ')' : ''));
    if (data.references && data.references.front) {
      referenceImageIds.push(data.references.front);
    }
  }
  return descs;
}

function buildCameraLines() {
  var framingLabel = FRAMING_LABELS[framing] || '';
  var angleLabel = ANGLE_LABELS[cameraAngle] || '';
  var lensLabel = LENS_LABELS[lens] || '';
  var dofLabel = DOF_LABELS[depthOfField] || '';
  var out = [];
  if (framingLabel || angleLabel) out.push('CAMERA: ' + [framingLabel, angleLabel].filter(Boolean).join(', '));
  if (!framingLabel) out.push('FRAMING: Choose the best framing for this action.');
  if (!angleLabel) out.push('ANGLE: Choose the best angle for this action.');
  if (lensLabel) out.push('LENS: ' + lensLabel);
  if (dofLabel) out.push('DEPTH OF FIELD: ' + dofLabel);
  return out.join('\n');
}

// ---- Mode branches ----

var brief;
// Inherited style (continue mode copies these from source shot so they persist on the new shot)
var inheritedGenre = '';
var inheritedMood = '';
var inheritedColorPalette = '';
var inheritedLighting = '';

if (mode === 'create') {
  // Read scene + any char/obj assets
  var sceneInfo = null;
  if (context.input.scene) {
    log('Reading scene...');
    sceneInfo = await readScene(context.input.scene);
    if (sceneInfo && sceneInfo.frontId) referenceImageIds.push(sceneInfo.frontId);
  }
  var characterDescs = await readCharacters(context.input.characters);
  var objectDescs = await readObjects(context.input.objects);

  var genreLabel = GENRE_LABELS[genre] || '';
  var moodLabel = MOOD_LABELS[mood] || '';
  var colorLabel = COLOR_LABELS[colorPalette] || '';
  var lightingLabel = LIGHTING_LABELS[lighting] || '';

  var directionLines = [];
  if (genreLabel) directionLines.push('GENRE: ' + genreLabel);
  if (moodLabel) directionLines.push('MOOD: ' + moodLabel);
  if (colorLabel) directionLines.push('COLOR: ' + colorLabel);

  var cameraLines = buildCameraLines();
  if (lightingLabel) cameraLines += '\nLIGHTING: ' + lightingLabel;

  var contextLines = [];
  if (sceneInfo && sceneInfo.name) contextLines.push('LOCATION: ' + sceneInfo.name + '. ' + sceneInfo.desc);
  if (characterDescs.length > 0) contextLines.push('CHARACTERS IN FRAME: ' + characterDescs.join('; '));
  if (objectDescs.length > 0) contextLines.push('OBJECTS IN FRAME: ' + objectDescs.join('; '));
  contextLines.push('ACTION: ' + action);

  brief = await app.prompt('prompts/frame.hbs', {
    hasReferences: referenceImageIds.length > 0,
    direction: directionLines.join('\n'),
    camera: cameraLines,
    context: contextLines.join('\n'),
  });
} else {
  // continue mode
  if (!context.input.shot) throw new Error('In continue mode, a source shot is required');

  log('Reading source shot...');
  var srcFile = await file.read(context.input.shot);
  if (!srcFile.content) throw new Error('Could not read source shot');
  var src = JSON.parse(srcFile.content);
  if (!src.references || !src.references.frame) throw new Error('Source shot has no frame');

  // Use the source shot's frame as the primary visual reference
  referenceImageIds.push(src.references.frame);

  // Inherit style from source shot (saved on the new shot; not needed for the image prompt)
  var srcStyle = src.style || {};
  inheritedGenre = srcStyle.genre || '';
  inheritedMood = srcStyle.mood || '';
  inheritedColorPalette = srcStyle.colorPalette || '';
  inheritedLighting = srcStyle.lighting || '';

  // Read any additional characters/objects the user wants to add
  var addedCharDescs = await readCharacters(context.input.characters);
  var addedObjDescs = await readObjects(context.input.objects);

  // Build natural-language pieces for the image prompt
  var framingLabel = FRAMING_LABELS[framing] || 'cinematic shot';
  var angleLabel = ANGLE_LABELS[cameraAngle] || '';
  var lensLabel = LENS_LABELS[lens] || '';
  var dofLabel = DOF_LABELS[depthOfField] || '';

  var compositionParts = [];
  compositionParts.push(framingLabel);
  if (angleLabel) compositionParts.push(angleLabel);
  if (lensLabel) compositionParts.push('shot with ' + lensLabel);
  if (dofLabel) compositionParts.push(dofLabel);
  var composition = compositionParts.join(', ');

  var addedParts = [];
  if (addedCharDescs.length > 0) addedParts.push(addedCharDescs.join(' and '));
  if (addedObjDescs.length > 0) addedParts.push(addedObjDescs.join(' and '));
  var addedSubjects = addedParts.join(', ');

  brief = await app.prompt('prompts/continue.hbs', {
    sourceDescription: src.description || src.name || 'the scene depicted',
    composition: composition,
    addedSubjects: addedSubjects,
    action: action,
  });
}

log('Composing frame prompt...');
var framePrompt = await ai.text({ prompt: brief, provider: 'gemini-3.1-pro' });

// Append mode-specific tail (hard directives like screen direction or grain) directly
// to the image prompt so the image model receives them regardless of LLM output.
var tailName = mode === 'continue' ? 'prompts/continue-tail.hbs' : 'prompts/frame-tail.hbs';
var tail = await app.prompt(tailName);
framePrompt = framePrompt.trim() + '\n\n' + tail.trim();

log('Generating frame...');
var imageParams = {
  prompt: framePrompt,
  aspectRatio: context.input.aspectRatio || '16:9',
  imageSize: context.input.imageSize || '1K',
  provider: context.input.model || undefined,
};
if (referenceImageIds.length > 0) {
  imageParams.images = referenceImageIds.join(',');
}
var frameId = await ai.image(imageParams);

log('Naming shot...');
var metaPrompt = await app.prompt('prompts/metadata.hbs', {
  brief: brief,
  framePrompt: framePrompt,
});
var metaJson = await ai.text({
  prompt: metaPrompt,
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['name', 'description'],
  },
});
var meta = JSON.parse(metaJson);
var shotName = (meta.name || 'Shot').trim().slice(0, 60);
var shotDescription = (meta.description || action).trim();

log('Saving shot...');
function stripEmpty(obj) {
  var out = {};
  for (var k in obj) {
    if (obj[k]) out[k] = obj[k];
  }
  return out;
}

// Composition always reflects the current shot's new angle
var composition = stripEmpty({ framing: framing, cameraAngle: cameraAngle, lens: lens, depthOfField: depthOfField });
// Style: create mode uses user inputs; continue mode inherits from source
var effGenre = mode === 'continue' ? inheritedGenre : genre;
var effMood = mode === 'continue' ? inheritedMood : mood;
var effColor = mode === 'continue' ? inheritedColorPalette : colorPalette;
var effLighting = mode === 'continue' ? inheritedLighting : lighting;
var style = stripEmpty({ genre: effGenre, mood: effMood, colorPalette: effColor, lighting: effLighting });

var shotData = {
  name: shotName,
  description: shotDescription,
  references: { frame: frameId },
  tags: [],
};
if (Object.keys(composition).length) shotData.composition = composition;
if (Object.keys(style).length) shotData.style = style;

await file.save(JSON.stringify(shotData, null, 2), {
  name: shotName + '.shot',
  type: 'application/json',
  schema: 'shot.v1',
});

log('Done! Created ' + shotName);
