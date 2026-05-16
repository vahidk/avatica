var style = context.input.style || '';
var imageSize = context.input.imageSize || '1K';

var STYLE_PROMPTS = {
  'cinematic': 'Cinematic establishing shot, shot on ARRI Alexa 35, Cooke anamorphic lens, photorealistic, dramatic natural lighting',
  'anime': 'Anime style environment art, vibrant colors, detailed backgrounds',
  'comic-book': 'Comic book environment illustration, bold outlines, vivid colors',
  'watercolor': 'Watercolor landscape painting, soft washes, atmospheric',
  'oil-painting': 'Oil painting landscape, rich textures, classical fine art style',
  'noir': 'Film noir scene, shot on ARRI Alexa, high contrast black and white, moody shadows, wet streets',
  '3d-render': '3D rendered environment, stylized, clean lighting, Pixar-quality',
  'pixel-art': 'Pixel art environment, retro game style, detailed scenery',
};

var stylePrompt = STYLE_PROMPTS[style] || '';

// Step 1: Generate scene details from prompt
log('Generating scene details...');

var sceneSchema = await schema.get('scene.v1');

var profilePrompt = await app.prompt('prompts/profile.hbs', { concept: context.input.prompt });
var sceneJson = await ai.text({ prompt: profilePrompt, schema: sceneSchema });

var scene = JSON.parse(sceneJson);
log('Scene: ' + scene.name);

// Step 2: Build description from structured fields for image prompt
var s = scene.setting || {};
var e = scene.environment || {};
var descParts = [];
if (s.location) descParts.push(s.location);
if (s.era) descParts.push(s.era + ' era');
if (s.interior) descParts.push(s.interior);
if (e.timeOfDay) descParts.push(e.timeOfDay);
if (e.weather) descParts.push(e.weather);
if (e.lighting) descParts.push(e.lighting + ' lighting');
if (scene.mood) descParts.push(scene.mood + ' mood');
if (e.extra) descParts.push(e.extra);
var sceneDesc = descParts.join(', ');

log('Generating scene image...');

var imagePrompt = await app.prompt('prompts/establishing.hbs', {
  name: scene.name,
  description: sceneDesc,
  style: style,
  stylePrompt: stylePrompt,
});
var imageParams = {
  prompt: imagePrompt,
  aspectRatio: '16:9',
  imageSize: imageSize,
  provider: context.input.model || undefined,
};
if (context.input.referenceImage) imageParams.image = context.input.referenceImage;

var imageId = await ai.image(imageParams);

// Step 3: Save scene file
log('Saving scene...');

var sceneData = {
  name: scene.name,
  setting: scene.setting || {},
  environment: scene.environment || {},
  mood: scene.mood || '',
  references: { front: imageId },
  tags: scene.tags || [],
};

var sceneStr = JSON.stringify(sceneData, null, 2);


await file.save(sceneStr, {
  name: scene.name + '.scene',
  type: 'application/json',
  schema: 'scene.v1',
});

log('Done! Created ' + scene.name);
