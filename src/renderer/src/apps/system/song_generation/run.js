let prompt = context.input.prompt;
if (context.input.genre) prompt += `, ${context.input.genre} genre`;
if (context.input.mood) prompt += `, ${context.input.mood} mood`;
if (context.input.tempo) prompt += `, ${context.input.tempo} tempo`;
if (context.input.instruments) prompt += `, featuring ${context.input.instruments}`;

const duration = Number(context.input.duration);
if (duration) prompt += `. Duration: approximately ${duration} seconds.`;

await ai.audio({
  prompt,
  format: context.input.format || undefined,
  provider: context.input.model || undefined,
});
