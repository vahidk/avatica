await ai.speech({
  prompt: context.input.prompt,
  voice: context.input.voice,
  languageCode: context.input.language || undefined,
  provider: context.input.model || undefined,
});
