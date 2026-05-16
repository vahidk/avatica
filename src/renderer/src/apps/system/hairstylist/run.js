const STYLES = {
  'bob': 'sleek modern bob haircut, chin-length, blunt ends, smooth straight texture, professional salon finish',
  'pixie': 'chic pixie cut, short textured layers, tapered sides, modern and bold, effortless styling',
  'long-layers': 'long layered haircut, face-framing layers, voluminous movement, flowing and elegant',
  'braids': 'intricate braided hairstyle, detailed woven patterns, neat and polished, artful braiding',
  'updo': 'elegant updo hairstyle, sophisticated twisted bun, refined and formal, salon-quality pinning',
  'curly': 'natural curly hairstyle, defined bouncy curls, voluminous and lively, healthy shine',
  'beach-waves': 'effortless beach waves, soft tousled texture, relaxed undone look, sun-kissed movement',
  'bangs': 'stylish fringe bangs with long hair, curtain bangs face-framing, soft and modern',
  'ponytail': 'sleek high ponytail, smooth pulled-back hair, polished and clean, glossy finish',
};

const COLORS = {
  'blonde': 'warm golden blonde hair color, natural highlights, sun-kissed tones',
  'brunette': 'rich chocolate brunette hair color, glossy deep brown, warm undertones',
  'red': 'vibrant copper red hair color, fiery warm tones, striking and bold',
  'black': 'jet black hair color, sleek and glossy, deep raven-black shine',
  'platinum': 'icy platinum blonde hair color, bright near-white, cool silver undertones',
  'balayage': 'hand-painted balayage highlights, seamless dark-to-light gradient, dimensional color',
  'pastel-pink': 'soft pastel pink hair color, dreamy rose gold tones, fashion-forward',
  'auburn': 'warm auburn hair color, rich reddish-brown, autumn-inspired tones',
  'silver': 'metallic silver-grey hair color, cool smoky tones, modern and edgy',
};

const VIEWS = {
  'front': 'front-facing portrait, direct eye contact, hair framing face symmetrically',
  'side-profile': 'side profile view, elegant silhouette, hair texture and layers visible',
  'back': 'back view of hairstyle, full hair visible from behind, showing style structure',
  'three-quarter': 'three-quarter angle portrait, slight head turn, showing hair dimension and depth',
  'close-up': 'extreme close-up of hair texture and detail, individual strands visible, macro hair photography',
  'updo-detail': 'close-up detail of updo styling, pins and twists visible, intricate arrangement',
  'wind-blown': 'wind-blown dynamic shot, hair in motion, flowing movement captured mid-air',
  'tousled': 'messy tousled bedhead hair, effortlessly undone textured look, casual and relaxed, natural morning light',
  'half-up': 'half-up half-down styling, top section pinned with lower hair flowing, balanced look',
};

const style = STYLES[context.input.style] || STYLES.bob;
const color = COLORS[context.input.color] || COLORS.brunette;
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
    subject, color, style, view, extra: context.input.prompt || '',
  });

  await ai.image({
    prompt,
    aspectRatio: context.input.aspectRatio || '3:4',
    imageSize: context.input.imageSize || '1K',
    provider: context.input.model || undefined,
    ...imageParams,
  });
}
