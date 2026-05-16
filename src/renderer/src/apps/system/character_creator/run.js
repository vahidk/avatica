var style = context.input.style || '';
var imageSize = context.input.imageSize || '1K';
var voicePitch = context.input.voicePitch || '';
var voiceTone = context.input.voiceTone || '';
var voicePace = context.input.voicePace || '';
var hasVoiceInput = voicePitch || voiceTone || voicePace;

var STYLE_PROMPTS = {
  'cinematic': 'Cinematic photorealistic character, shot on ARRI Alexa 35, Cooke S7/i 85mm prime lens, shallow depth of field, dramatic lighting',
  'anime': 'Anime style character art, vibrant colors, clean lines, expressive features',
  'comic-book': 'Comic book character illustration, bold outlines, dynamic shading, vivid colors',
  'watercolor': 'Watercolor character painting, soft washes, delicate brushstrokes, artistic',
  'oil-painting': 'Oil painting character portrait, rich textures, classical fine art style',
  'noir': 'Film noir character, shot on ARRI Alexa, high contrast black and white, moody shadows',
  '3d-render': '3D rendered character, stylized, clean lighting, Pixar-quality',
  'pixel-art': 'Pixel art character portrait, retro game style, detailed sprite work',
};

var stylePrompt = STYLE_PROMPTS[style] || '';

// Step 1: Generate character details from prompt
log('Generating character details...');

var charSchema = await schema.get('character.v1');

var profilePrompt = await app.prompt('prompts/profile.hbs', {
  concept: context.input.prompt,
  hasVoiceInput: hasVoiceInput,
});
var charJson = await ai.text({ prompt: profilePrompt, schema: charSchema });

var character = JSON.parse(charJson);
log('Character: ' + character.name);

// Step 2: Build appearance description for image prompt
var id = character.identity || {};
var ap = character.appearance || {};
var appearanceParts = [];
if (id.age) appearanceParts.push(id.age);
if (id.gender) appearanceParts.push(id.gender);
if (id.ethnicity) appearanceParts.push(id.ethnicity);
if (id.build) appearanceParts.push(id.build + ' build');
if (ap.hair) appearanceParts.push(ap.hair + ' hair');
if (ap.eyes) appearanceParts.push(ap.eyes + ' eyes');
if (ap.features) appearanceParts.push(ap.features);
if (ap.extra) appearanceParts.push(ap.extra);
var appearanceDesc = appearanceParts.join(', ');

log('Generating character portrait...');

var portraitPrompt = await app.prompt('prompts/portrait.hbs', {
  name: character.name,
  appearance: appearanceDesc,
  style: style,
  stylePrompt: stylePrompt,
});
var imageParams = {
  prompt: portraitPrompt,
  aspectRatio: '3:4',
  imageSize: imageSize,
  provider: context.input.model || undefined,
};
if (context.input.referenceImage) imageParams.image = context.input.referenceImage;

var imageId = await ai.image(imageParams);

// Step 3: Save character file
log('Saving character...');

var charData = {
  name: character.name,
  species: character.species || 'human',
  identity: character.identity || {},
  appearance: character.appearance || {},
  character: character.character || {},
  voice: {
    pitch: voicePitch || (character.voice && character.voice.pitch) || '',
    tone: voiceTone || (character.voice && character.voice.tone) || '',
    pace: voicePace || (character.voice && character.voice.pace) || '',
    extra: (character.voice && character.voice.extra) || '',
  },
  references: { front: imageId },
  tags: character.tags || [],
};

var charStr = JSON.stringify(charData, null, 2);


await file.save(charStr, {
  name: character.name + '.char',
  type: 'application/json',
  schema: 'character.v1',
});

log('Done! Created ' + character.name);
