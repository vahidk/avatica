var style = context.input.style || '';
var imageSize = context.input.imageSize || '1K';

var STYLE_PROMPTS = {
  'cinematic': 'Cinematic photorealistic object, shot on ARRI Alexa 35, macro lens, shallow depth of field, dramatic lighting, film quality',
  'product-photo': 'Professional product photography, clean white background, softbox lighting, commercial quality, advertising ready',
  'anime': 'Anime style object art, vibrant colors, clean lines, stylized rendering',
  'comic-book': 'Comic book object illustration, bold outlines, dynamic shading, vivid colors',
  'watercolor': 'Watercolor object painting, soft washes, delicate brushstrokes, artistic',
  'oil-painting': 'Oil painting still life, rich textures, classical fine art style, dramatic chiaroscuro',
  '3d-render': '3D rendered object, clean studio lighting, soft shadows, product visualization quality',
  'pixel-art': 'Pixel art object sprite, retro game style, detailed pixel work',
};

var stylePrompt = STYLE_PROMPTS[style] || '';

// Step 1: Generate object details from prompt
log('Generating object details...');

var objSchema = await schema.get('object.v1');

var profilePrompt = await app.prompt('prompts/profile.hbs', { concept: context.input.prompt });
var objJson = await ai.text({ prompt: profilePrompt, schema: objSchema });

var object = JSON.parse(objJson);
log('Object: ' + object.name);

// Step 2: Build appearance description for image prompt
var ph = object.physical || {};
var parts = [];
if (ph.material) parts.push(ph.material);
if (ph.color) parts.push(ph.color);
if (ph.size) parts.push(ph.size);
if (ph.shape) parts.push(ph.shape);
if (ph.texture) parts.push(ph.texture + ' texture');
if (ph.extra) parts.push(ph.extra);
if (object.description) parts.push(object.description);
var appearanceDesc = parts.join(', ');

log('Generating object image...');

var imagePrompt = await app.prompt('prompts/portrait.hbs', {
  name: object.name,
  description: appearanceDesc,
  style: style,
  stylePrompt: stylePrompt,
});
var imageParams = {
  prompt: imagePrompt,
  aspectRatio: '1:1',
  imageSize: imageSize,
  provider: context.input.model || undefined,
};
if (context.input.referenceImage) imageParams.image = context.input.referenceImage;

var imageId = await ai.image(imageParams);

// Step 3: Save object file
log('Saving object...');

var objData = {
  name: object.name,
  category: object.category || 'other',
  description: object.description || '',
  physical: object.physical || {},
  context: object.context || {},
  references: { front: imageId },
  tags: object.tags || [],
};

var objStr = JSON.stringify(objData, null, 2);


await file.save(objStr, {
  name: object.name + '.obj',
  type: 'application/json',
  schema: 'object.v1',
});

log('Done! Created ' + object.name);
