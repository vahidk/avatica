import type { Provider, CapabilityConfig, OptionEntry } from './types'

const opt = (v: string, req?: Record<string, string[]>): OptionEntry =>
  ({ value: v, label: v, ...(req ? { requires: req } : {}) })

// gpt-image-2 accepts arbitrary resolutions under these constraints:
//   - max edge 3840px, both edges multiples of 16, aspect ratio ≤ 3:1
//   - total pixels between 655,360 and 8,294,400
// We expose a user-friendly (imageSize, aspectRatio) pair; the adapter translates
// it to exact pixel dimensions. Only 16:9/9:16 fit at 4K because square/3:2 at
// 4K would exceed the 8.3M pixel cap.
const gptImageOptions: CapabilityConfig = {
  options: {
    aspectRatio: [opt('1:1'), opt('3:2'), opt('2:3'), opt('4:3'), opt('3:4'), opt('5:4'), opt('4:5'), opt('16:9'), opt('9:16'), opt('21:9')],
    imageSize: [
      opt('1K'),
      opt('2K'),
      opt('4K', { aspectRatio: ['16:9', '9:16'] }),
    ],
  },
  defaults: { aspectRatio: '1:1', imageSize: '1K' },
}

const providers: Record<string, Provider> = {
  'gpt-image-2': {
    vendor: 'openai',
    enabled: true,
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    capabilities: {
      'image/generate': gptImageOptions,
      'image/edit': gptImageOptions,
    },
    model: 'gpt-image-2',
    // OpenAI bills gpt-image-2 per-token:
    //   text input  $5.00 / 1M
    //   image input $8.00 / 1M   (not separately modelled — edit-mode undercounts slightly)
    //   image out   $30.00 / 1M
    // The adapter pins quality="medium" so the token-based estimate stays predictable.
    // Real costs for larger sizes (2K/4K) scale more steeply than our shared token heuristic,
    // so the in-app meter will undercount 2K/4K runs.
    pricing: {
      type: 'token',
      token: {
        inputPer1M: 5.00,
        outputPer1M: 30.00,
        imageOutputPer1M: 30.00,
      },
    },
  },
}

export default providers
