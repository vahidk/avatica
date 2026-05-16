var prompt = context.input.prompt;
var duration = context.input.duration || '';
var style = context.input.style || '';
var method = context.input.method || '';
var genre = context.input.genre || '';

// Load method-specific approach
var METHOD_FILES = {
  'classic': 'prompts/methods/classic.hbs',
  'image-first': 'prompts/methods/image-first.hbs',
  'character-first': 'prompts/methods/character-first.hbs',
  'theme-first': 'prompts/methods/theme-first.hbs',
};

var methodInstruction = '';
if (!method) {
  var allMethods = '';
  var names = ['classic', 'image-first', 'character-first', 'theme-first'];
  for (var i = 0; i < names.length; i++) {
    allMethods += '\n---\n## ' + names[i] + '\n' + await app.prompt(METHOD_FILES[names[i]]);
  }
  methodInstruction = 'Available approaches:\n' + allMethods + '\n---';
} else {
  methodInstruction = await app.prompt(METHOD_FILES[method] || METHOD_FILES['classic']);
}

// Duration context
var DURATION_GUIDE = {
  '15s': '1-2 scenes. One moment, one emotion.',
  '30s': '2-3 scenes. Minimal setup, quick turn, strong ending.',
  '1min': '3-4 scenes. Brief setup, clear conflict, resolution.',
  '2min': '5-7 scenes. Room for character development and a turn.',
  '5min': '8-12 scenes. Full three-act structure.',
};

// Style context
var STYLE_GUIDE = {
  'cinematic': 'Cinematic — anamorphic framing, dramatic lighting, film grain, shallow DOF.',
  'noir': 'Film noir — high contrast, deep shadows, rain-slicked streets, low-key lighting.',
  'dreamy': 'Dreamy — soft diffused light, slow motion, overexposed highlights, pastel tones.',
  'gritty-realism': 'Gritty realism — handheld feel, natural light, muted desaturated palette.',
  'surreal': 'Surreal — impossible geometry, unnatural colors, dream logic over narrative logic.',
  'minimalist': 'Minimalist — clean compositions, negative space, restrained palette.',
  'anime': 'Anime — vibrant saturated colors, dynamic angles, stylized rim lighting.',
  'retro': 'Retro — period-appropriate grain, color shift, vintage texture.',
  'neon-cyberpunk': 'Neon cyberpunk — saturated neon (pink, cyan, purple), wet reflective surfaces.',
  'documentary': 'Documentary — observational, natural light, longer takes, authentic framing.',
};

// Build context string for template substitution
var contextInfo = 'CONCEPT: ' + prompt;
if (genre) contextInfo += '\nGENRE: ' + genre;
if (duration) contextInfo += '\nDURATION: ' + duration + '. ' + (DURATION_GUIDE[duration] || '');
if (style) contextInfo += '\nSTYLE: ' + (STYLE_GUIDE[style] || style);

var chat = ai.chat({ provider: context.input.model || 'gemini-3.1-pro' });

// Step 1: Creative directions
log('Exploring ideas...');
var guide = await app.prompt('prompts/guide.hbs');
await chat.send(await app.prompt('prompts/steps/explore.hbs', { guide: guide, context: contextInfo }));

// Step 2: Pick direction and outline
log('Building outline...');
await chat.send(await app.prompt('prompts/steps/outline.hbs', { method: methodInstruction }));

// Step 3: Write full script
log('Writing script...');
var script = await chat.send(await app.prompt('prompts/steps/write.hbs'));

// Step 4: Review
log('Reviewing...');
var review = await chat.send(await app.prompt('prompts/steps/review.hbs'));

var lines = review.trim().split('\n');
var verdict = '';
for (var i = 0; i < lines.length; i++) {
  if (lines[i].trim().indexOf('VERDICT:') === 0) {
    verdict = lines[i].trim().substring(8).trim();
    break;
  }
}

if (verdict.indexOf('REVISE') >= 0) {
  log('Applying edits...');
  // Find where the actual script starts (# Characters header)
  var scriptStart = -1;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line.indexOf('# Characters') === 0) {
      scriptStart = i;
      break;
    }
  }
  if (scriptStart >= 0) {
    script = lines.slice(scriptStart).join('\n').trim();
  }
}

log('Saving script...');
var scriptName = await app.assetName(script.slice(0, 200), 'script');
await file.save(script, { name: scriptName + '.md', type: 'text/markdown' });

log('Done!');
