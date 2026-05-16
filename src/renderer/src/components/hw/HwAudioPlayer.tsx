import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeHigh, faVolumeXmark } from '@fortawesome/free-solid-svg-icons';
import Waveform from '../ui/Waveform';
import CircleButton from './CircleButton';
import HwSlider from './HwSlider';
import VuMeter from './VuMeter';
import './hw.css';

const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

interface HwAudioPlayerProps {
  url: string;
  name?: string;
  meta?: string;
  autoPlay?: boolean;
}

export default function HwAudioPlayer({ url, name, meta, autoPlay = true }: HwAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [prevVolume, setPrevVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [bars] = useState(() => Array.from({ length: 200 }, (_, i) => 0.15 + Math.abs(Math.sin(i * 0.5 + Math.cos(i * 0.3) * 2)) * 0.85));

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!IS_MOBILE) setAudioEl(el);
    const onPlay = () => { setPlaying(true); setLoaded(true); };
    const onPause = () => setPlaying(false);
    const onTime = () => { setCurrentTime(el.currentTime); setProgress(el.duration ? el.currentTime / el.duration : 0); };
    const onLoaded = () => { setDuration(el.duration); setLoaded(true); };
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onLoaded);
    if (autoPlay) {
      if (el.readyState >= 1) { setLoaded(true); el.play().catch(() => {}); }
      else el.addEventListener('loadedmetadata', () => el.play().catch(() => {}), { once: true });
    }
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [autoPlay]);

  function togglePlay() { audioRef.current?.[playing ? 'pause' : 'play'](); }
  function toggleMute() {
    if (!audioRef.current) return;
    if (volume > 0) { setPrevVolume(volume); setVolume(0); audioRef.current.volume = 0; }
    else { setVolume(prevVolume); audioRef.current.volume = prevVolume; }
  }
  function fmt(s: number) { const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }

  return (
    <div className="hw-audio-player">
      <audio ref={audioRef} src={url} crossOrigin={IS_MOBILE ? undefined : 'anonymous'} preload="auto" />

      {/* Info */}
      {(name || meta) && (
        <div className="hw-audio-player__info">
          {name && <div className="hw-audio-player__name">{name}</div>}
          <div className="hw-audio-player__meta">
            {meta && <span>{meta}</span>}
            <span className="hw-audio-player__time">{fmt(currentTime)} / {duration ? fmt(duration) : '--:--'}</span>
          </div>
        </div>
      )}

      {/* Waveform in LCD */}
      <div className="app-lcd">
        <div className="app-lcd-screen hw-audio-player__lcd">
          <Waveform
            bars={bars}
            progress={progress}
            gap={1}
            activeColor="var(--hw-text-secondary, #999)"
            inactiveColor="color-mix(in srgb, var(--hw-text-secondary, #999) 15%, transparent)"
            onSeek={pct => { if (audioRef.current && loaded) audioRef.current.currentTime = pct * (audioRef.current.duration || 0); }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="hw-audio-player__controls">
        <div className="hw-audio-player__controls-left">
          <CircleButton icon="fa-solid fa-backward-step" onClick={() => { if (audioRef.current) audioRef.current.currentTime = 0; }} disabled={!loaded} />
          <CircleButton icon={!loaded ? 'fa-solid fa-spinner fa-spin' : playing ? 'fa-solid fa-pause' : 'fa-solid fa-play'} onClick={togglePlay} disabled={!loaded} />
        </div>
        {!IS_MOBILE && <VuMeter audioElement={audioEl} bars={16} />}
        <div className="hw-audio-player__controls-right">
          <button className="hw-audio-player__mute-btn" onClick={toggleMute}>
            <FontAwesomeIcon icon={volume === 0 ? faVolumeXmark : faVolumeHigh} />
          </button>
          <div className="hw-audio-player__volume-slider">
            <HwSlider min={0} max={100} value={Math.round(volume * 100)} onChange={v => { setVolume(v / 100); if (audioRef.current) audioRef.current.volume = v / 100; }} />
          </div>
        </div>
      </div>
    </div>
  );
}
