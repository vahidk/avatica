var shotId = context.input.shot;
var text = context.input.prompt;
var chunkSize = Number(context.input.chunkSize || 8);
var model = context.input.model || 'veo-3.1-lite';
var resolution = context.input.resolution || '720p';
var aspectRatio = context.input.aspectRatio || '16:9';

// Approximate target words per chunk at ~2.5 words/second natural pace
var wordsPerChunk = Math.round(chunkSize * 2.5);

// ---- Step 1: Read the shot ----
log('Reading shot...');
var shotFile = await file.read(shotId);
if (!shotFile.content) throw new Error('Could not read shot file');
var shot = JSON.parse(shotFile.content);
if (!shot.references || !shot.references.frame) throw new Error('Shot has no frame reference');
var frameId = shot.references.frame;
var shotDescription = shot.description || '';

// ---- Step 2: Split the monologue text into chunks ----
log('Splitting monologue into chunks...');
var chunkPrompt = await app.prompt('prompts/chunk.hbs', {
  text: text,
  seconds: String(chunkSize),
  words: String(wordsPerChunk),
});
var chunkJson = await ai.text({
  prompt: chunkPrompt,
  schema: {
    type: 'object',
    properties: {
      chunks: { type: 'array', items: { type: 'string' } },
    },
    required: ['chunks'],
  },
  provider: 'gemini-3.1-flash-lite',
});
var chunks = JSON.parse(chunkJson).chunks || [];
if (chunks.length === 0) throw new Error('Monologue produced no chunks — check the input text');
log('Produced ' + chunks.length + ' chunk(s). Generating videos in parallel...');

// ---- Step 3: Generate each chunk's video in parallel ----
var tail = await app.prompt('prompts/deliver-tail.hbs');

var videoPromises = chunks.map(function(line, i) {
  return app.prompt('prompts/deliver.hbs', {
    line: line,
    shotDescription: shotDescription,
  }).then(function(deliverPrompt) {
    var fullPrompt = deliverPrompt.trim() + '\n\n' + tail.trim();
    return ai.video({
      prompt: fullPrompt,
      mode: 'image_to_video',
      startImage: frameId,
      duration: chunkSize,
      resolution: resolution,
      aspectRatio: aspectRatio,
      provider: model,
    }).then(function(videoId) {
      log('Chunk ' + (i + 1) + '/' + chunks.length + ' ready');
      return videoId;
    });
  });
});

var videoIds = await Promise.all(videoPromises);

// ---- Step 4: Build the sequence ----
log('Assembling sequence...');

// Simple UUID-ish generator — not crypto, just for track/clip ids
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Look up metadata for each generated video so the sequence has file names and mime types
var clips = [];
var cursor = 0;
for (var i = 0; i < videoIds.length; i++) {
  var info = await file.read(videoIds[i]);
  var durationMs = chunkSize * 1000;
  clips.push({
    kind: 'media',
    id: uuid(),
    fileId: videoIds[i],
    fileName: info.name || '',
    mimeType: info.type || 'video/mp4',
    start: cursor,
    duration: durationMs,
    trimIn: 0,
    trimOut: durationMs,
  });
  cursor += durationMs;
}

var sequence = {
  $schema: 'sequence.v1',
  settings: {
    width: aspectRatio === '9:16' ? 1080 : 1920,
    height: aspectRatio === '9:16' ? 1920 : 1080,
    fps: 30,
  },
  tracks: [
    {
      id: uuid(),
      type: 'video',
      name: 'Video 1',
      disabled: false,
      muted: false,
      volume: 1,
      clips: clips,
    },
  ],
};

log('Saving sequence...');
var sequenceName = await app.assetName(text, 'sequence');
await file.save(JSON.stringify(sequence, null, 2), {
  name: sequenceName + '.seq',
  type: 'application/json',
  schema: 'sequence.v1',
});

log('Done! ' + chunks.length + ' chunk(s) assembled.');
