import type { Clip, MediaClip } from './types';
import type { ClipPreview } from './useClipPreviews';

interface ClipContentProps {
  clip: Clip;
  trackType: string;
  preview?: ClipPreview;
  mediaDuration?: number;
}

export default function ClipContent({ clip, trackType, preview, mediaDuration }: ClipContentProps) {
  if (clip.kind !== 'media') return null;
  return <MediaPreview clip={clip} trackType={trackType} preview={preview} mediaDuration={mediaDuration} />;
}

function MediaPreview({ clip, trackType, preview, mediaDuration }: { clip: MediaClip; trackType: string; preview?: ClipPreview; mediaDuration?: number }) {
  if (preview?.thumbnailUrl && trackType === 'video') {
    return <img className="timeline__clip-thumb" src={preview.thumbnailUrl} alt="" />;
  }

  if (preview?.waveform && trackType === 'audio') {
    const totalDur = mediaDuration ?? clip.duration;
    const numPeaks = preview.waveform.length;
    const viewX = ((clip.trimIn ?? 0) / totalDur) * numPeaks;
    const viewW = (clip.duration / totalDur) * numPeaks;
    return (
      <svg className="timeline__clip-waveform" viewBox={`${viewX} 0 ${viewW} 34`} preserveAspectRatio="none">
        {preview.waveform.map((p, i) => (
          <rect key={i} x={i} y={17 - p * 15} width={1} height={p * 30 || 0.5} fill="rgba(255,255,255,0.6)" />
        ))}
      </svg>
    );
  }

  return null;
}
