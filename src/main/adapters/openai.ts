import { openaiPostJson, openaiPostForm } from '../clients'
import { detectImageMimeType } from '../utils/media'
import type { ImageRequest, ImageResult } from './types'

/**
 * Map (imageSize, aspectRatio) to an exact `size` string accepted by gpt-image-2.
 * All dimensions are multiples of 16 and fit the model's pixel-count constraints
 * (655,360 – 8,294,400 total, max edge 3840, aspect ≤ 3:1).
 */
function toOpenAISize(imageSize: string | undefined, aspect: string | undefined): string {
  const size = imageSize || '1K'
  const ratio = aspect || '1:1'

  if (size === '4K') {
    if (ratio === '9:16') return '2160x3840'
    return '3840x2160' // 16:9 (only valid 4K aspect ratios — others exceed pixel cap)
  }

  if (size === '2K') {
    switch (ratio) {
      case '3:2': return '2304x1536'
      case '2:3': return '1536x2304'
      case '16:9': return '2048x1152'
      case '9:16': return '1152x2048'
      default: return '2048x2048' // 1:1
    }
  }

  // 1K default
  switch (ratio) {
    case '3:2': return '1536x1024'
    case '2:3': return '1024x1536'
    case '16:9': return '1536x864'
    case '9:16': return '864x1536'
    default: return '1024x1024' // 1:1
  }
}

export async function openaiImage(req: ImageRequest): Promise<ImageResult> {
  const size = toOpenAISize(req.imageSize, req.aspectRatio)
  // Pin quality=medium so cost stays predictable (OpenAI's 'auto' can land on
  // 'high' which is ~4× the price). Users who want low/high can be supported
  // later by surfacing a `quality` option on the provider.
  const quality = 'medium'

  // Collect any input images: a source image (edit mode) plus any reference
  // images (generate-with-references). OpenAI takes both via /images/edits with
  // one or more `image[]` parts; /images/generations is text-only.
  const inputImages: { data: Uint8Array; mimeType: string }[] = []
  if (req.mode === 'edit' && req.sourceImage) inputImages.push(req.sourceImage)
  if (req.referenceImages?.length) inputImages.push(...req.referenceImages)

  if (inputImages.length > 0) {
    const form = new FormData()
    form.append('model', req.model)
    form.append('prompt', req.prompt)
    form.append('size', size)
    form.append('quality', quality)
    form.append('n', '1')
    inputImages.forEach((img, i) => {
      const ext = img.mimeType.split('/')[1] || 'png'
      const blob = new Blob([img.data as unknown as BlobPart], { type: img.mimeType })
      form.append('image[]', blob, `image-${i}.${ext}`)
    })

    const data = await openaiPostForm('/images/edits', form)
    const b64 = data.data?.[0]?.b64_json
    if (!b64) throw new Error('No image generated')
    const buffer = Buffer.from(b64, 'base64')
    return { buffer, mimeType: detectImageMimeType(undefined, buffer), usage: null }
  }

  const body: Record<string, any> = {
    model: req.model,
    prompt: req.prompt,
    size,
    quality,
    n: 1,
  }

  const data = await openaiPostJson('/images/generations', body)
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('No image generated')
  const buffer = Buffer.from(b64, 'base64')
  return { buffer, mimeType: detectImageMimeType(undefined, buffer), usage: null }
}
