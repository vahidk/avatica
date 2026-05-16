const LOOKS = {
  'natural': 'natural no-makeup makeup look, flawless skin, subtle enhancement, soft blush, nude tones, effortless beauty',
  'glam': 'full glamorous makeup, shimmering eyeshadow, winged eyeliner, sculpted contour, highlighted cheekbones, statement lashes',
  'sculpted': 'heavily sculpted and contoured face, dramatically reshaped nose and jawline with makeup, chiseled cheekbones, face-transforming contouring, completely different facial structure through makeup artistry',
  'dewy': 'dewy glass skin makeup, luminous glowing finish, light coverage, fresh and hydrated look, subtle highlight',
  'bold-lip': 'bold statement lip color, perfectly lined and filled, striking red or deep berry, minimal eye makeup to balance',
  'editorial': 'avant-garde editorial makeup, creative artistic colors, high-fashion runway look, unconventional beauty',
  'age-defying': 'youthful age-defying makeup, lifted eyes, fuller lips with overlining, smoothed skin, brightened under-eyes, face looks 10 years younger through expert makeup techniques',
  'smoky-eye': 'dramatic smoky eye makeup, dark blended eyeshadow gradient, smudged liner, sultry and intense, defined lashes',
  'vintage': 'classic vintage Hollywood makeup, red lip, winged cat-eye liner, arched brows, old Hollywood glamour',
};

const SKINS = {
  'fair': 'very fair porcelain skin tone, cool pink undertones',
  'light': 'light skin tone, neutral undertones, subtle warmth',
  'medium': 'medium skin tone, warm golden undertones',
  'olive': 'olive skin tone, warm green undertones, Mediterranean complexion',
  'tan': 'tan sun-kissed skin tone, warm bronze undertones',
  'caramel': 'caramel skin tone, rich warm golden-brown undertones',
  'brown': 'brown skin tone, deep warm undertones, rich complexion',
  'dark': 'dark skin tone, deep chocolate undertones, rich melanin',
  'deep': 'deep ebony skin tone, cool blue-black undertones, stunning dark complexion',
};

const VIEWS = {
  'front': 'front-facing beauty portrait, direct eye contact, symmetrical composition, full makeup visible, studio lighting',
  'three-quarter': 'three-quarter angle beauty portrait, showing contour and highlight dimension, makeup depth visible, studio lighting',
  'profile': 'side profile beauty shot, showing cheekbone contour and lip shape, elegant angle, studio lighting',
  'full-face': 'full face beauty shot, soft diffused lighting, all makeup elements visible, beauty campaign style',
  'dramatic': 'dramatic side lighting beauty shot, strong shadows revealing makeup dimension, chiaroscuro studio effect',
  'soft-glow': 'soft glowing beauty portrait, diffused ring light, radiant luminous skin, ethereal beauty lighting, studio',
  'high-contrast': 'high contrast sharp studio lighting, crisp makeup details visible, product precision highlighted, editorial studio beauty',
  'butterfly': 'butterfly lighting beauty portrait, overhead light casting shadow under nose, classic beauty lighting setup, flawless skin, studio',
  'warm-tone': 'warm-toned studio beauty portrait, amber warm lighting, cozy intimate mood, makeup tones enhanced by warm light',
};

const look = LOOKS[context.input.look] || LOOKS.natural;
const skin = SKINS[context.input.skin] || SKINS.medium;
const viewKeys = (context.input.views || 'front').split(',').map(s => s.trim());
const gender = context.input.gender || 'female';
const subject = gender === 'male' ? 'Handsome man' : 'Beautiful woman';

const imageParams = {};
if (context.input.reference) {
  imageParams.images = context.input.reference;
}

for (const viewKey of viewKeys) {
  const view = VIEWS[viewKey] || viewKey;
  const prompt = await app.prompt('prompts/shot.hbs', {
    subject, skin, look, view, extra: context.input.prompt || '',
  });

  await ai.image({
    prompt,
    aspectRatio: context.input.aspectRatio || '1:1',
    imageSize: context.input.imageSize || '1K',
    provider: context.input.model || undefined,
    ...imageParams,
  });
}
