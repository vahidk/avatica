var prompt = context.input.prompt;
var form = context.input.form || '';
var tone = context.input.tone || '';
var duration = context.input.duration || '';

// Load form-specific recipe
var FORM_FILES = {
  'standup': 'prompts/forms/standup.hbs',
  'storytelling': 'prompts/forms/storytelling.hbs',
  'ted-talk': 'prompts/forms/ted-talk.hbs',
  'dramatic': 'prompts/forms/dramatic.hbs',
  'observational': 'prompts/forms/observational.hbs',
  'pitch': 'prompts/forms/pitch.hbs',
  'vlog': 'prompts/forms/vlog.hbs',
  'spoken-word': 'prompts/forms/spoken-word.hbs',
};

var formInstruction = '';
if (!form) {
  var allForms = '';
  var names = ['standup', 'storytelling', 'ted-talk', 'dramatic', 'observational', 'pitch', 'vlog', 'spoken-word'];
  for (var i = 0; i < names.length; i++) {
    allForms += '\n---\n## ' + names[i] + '\n' + await app.prompt(FORM_FILES[names[i]]);
  }
  formInstruction = 'Available forms:\n' + allForms + '\n---';
} else {
  formInstruction = await app.prompt(FORM_FILES[form] || FORM_FILES['storytelling']);
}

// Duration context — target spoken length and beat count
var DURATION_GUIDE = {
  '30s': '2-3 beats. One small thought, one clear turn.',
  '1min': '3-5 beats. Setup, turn, landing.',
  '3min': '6-10 beats. Room for a full arc with a couple of callbacks.',
  '5min': '10-15 beats. Full arc, multiple turns, one or two callbacks.',
  '10min': '20-30 beats. Extended arc, multiple premises or stories that thread together.',
};

var TONE_GUIDE = {
  'funny': 'Funny — built around laughs. Punchlines land, misdirection works, nothing is treated too preciously.',
  'inspiring': 'Inspiring — the audience should leave energized. Earn the uplift; don\'t skip to it.',
  'reflective': 'Reflective — thinking out loud, letting the audience sit with an idea.',
  'angry': 'Angry — controlled heat. Specific targets, not general complaint.',
  'absurd': 'Absurd — internal logic is strict, but the premise is impossible. Play it straight.',
  'sincere': 'Sincere — no irony, no wink. Say what is meant.',
  'melancholic': 'Melancholic — soft weight. Small specific losses rather than big grief.',
  'dry': 'Dry — flat delivery, the humor or weight comes from what is not emphasized.',
  'warm': 'Warm — generous, inviting. The performer likes the audience.',
};

// Build context string
var contextInfo = 'CONCEPT: ' + prompt;
if (tone) contextInfo += '\nTONE: ' + (TONE_GUIDE[tone] || tone);
if (duration) contextInfo += '\nDURATION: ' + duration + '. ' + (DURATION_GUIDE[duration] || '');

var chat = ai.chat({ provider: context.input.model || 'gemini-3.1-pro' });

// Step 1: Creative angles
log('Exploring angles...');
var guide = await app.prompt('prompts/guide.hbs');
await chat.send(await app.prompt('prompts/steps/explore.hbs', { guide: guide, context: contextInfo }));

// Step 2: Pick angle and outline beats
log('Building outline...');
await chat.send(await app.prompt('prompts/steps/outline.hbs', { form: formInstruction }));

// Step 3: Write full monologue
log('Writing monologue...');
var monologue = await chat.send(await app.prompt('prompts/steps/write.hbs'));

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
  var scriptStart = -1;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line.indexOf('# Characters') === 0) {
      scriptStart = i;
      break;
    }
  }
  if (scriptStart >= 0) {
    monologue = lines.slice(scriptStart).join('\n').trim();
  }
}

log('Saving monologue...');
var monologueName = await app.assetName(monologue.slice(0, 200), 'monologue');
await file.save(monologue, { name: monologueName + '.md', type: 'text/markdown' });

log('Done!');
