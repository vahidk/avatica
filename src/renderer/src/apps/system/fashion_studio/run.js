const STYLES = {
  'editorial': 'high-fashion editorial photography, dramatic lighting, sharp focus, magazine-quality, Vogue-style',
  'streetwear': 'urban streetwear fashion photography, natural city lighting, candid feel, street style',
  'minimalist': 'clean minimalist fashion photography, neutral tones, simple composition, modern aesthetic',
  'haute-couture': 'haute couture fashion photography, avant-garde, dramatic poses, luxury fashion, high-end studio',
  'athleisure': 'athletic lifestyle fashion photography, dynamic poses, energetic, sporty chic',
  'y2k': 'Y2K aesthetic fashion photography, bold colors, nostalgic 2000s style, playful poses',
  'glam': 'glamorous evening fashion photography, sequins, sparkle, dramatic makeup, red carpet energy, luxury celebrity style',
  'techwear': 'techwear fashion photography, futuristic urban environment, cyberpunk tones, technical fabrics',
  'bohemian': 'bohemian fashion photography, warm golden light, flowing fabrics, natural outdoor setting',
};

const SETTINGS = {
  'studio-white': 'pure white studio backdrop, professional studio lighting, clean shadows',
  'urban-street': 'urban city street, graffiti walls, concrete, natural daylight, depth of field',
  'beach': 'sandy beach at sunset, warm natural light, ocean in background, gentle breeze',
  'indoor-lifestyle': 'stylish modern interior, natural window light, cozy atmosphere, designer furniture',
  'runway': 'fashion runway, dramatic spotlighting, audience blur in background, catwalk',
  'cafe': 'Parisian sidewalk café, ornate iron chairs, marble bistro table, cobblestone street, warm golden afternoon light, shallow depth of field, lifestyle editorial',
  'rooftop': 'rooftop terrace at dusk, city skyline background, twilight sky, urban elegance',
  'golden-hour': 'golden hour outdoor, warm backlit sun, lens flare, soft shadows, magic hour',
  'neon': 'neon-lit nighttime alley, vibrant pink and blue neon reflections, moody edgy atmosphere',
};

const SHOTS = {
  'full-body-front': 'full body front-facing shot, standing pose, head to toe visible',
  'waist-up': 'waist-up portrait, slight angle, confident pose',
  'close-up': 'close-up face and shoulders, shallow depth of field, detailed skin texture',
  'profile': 'side profile shot, elegant pose, dramatic lighting on face',
  'over-shoulder': 'over-the-shoulder look back, natural movement, candid feel',
  'walking': 'walking shot, mid-stride, dynamic movement, motion blur in background',
  'sitting': 'seated pose, relaxed and elegant, interesting composition',
  'low-angle': 'low angle shot from below, powerful dramatic perspective, elongated figure, bold stance',
  'back': 'from behind, looking away, elegant back silhouette, dramatic lighting',
};

const style = STYLES[context.input.style] || STYLES.editorial;
const setting = SETTINGS[context.input.setting] || SETTINGS['studio-white'];
const shotKeys = (context.input.shots || 'full-body-front').split(',').map(s => s.trim());
const gender = context.input.gender || 'female';
const subject = gender === 'male' ? 'male model, handsome man' : 'female model, beautiful woman';

const imageParams = {};
if (context.input.reference) {
  imageParams.images = context.input.reference;
}

for (const shotKey of shotKeys) {
  const shot = SHOTS[shotKey] || shotKey;
  const prompt = await app.prompt('prompts/shot.hbs', {
    subject, style, setting, shot, extra: context.input.prompt || '',
  });

  await ai.image({
    prompt,
    aspectRatio: context.input.aspectRatio || '3:4',
    imageSize: context.input.imageSize || '1K',
    provider: context.input.model || undefined,
    ...imageParams,
  });
}
