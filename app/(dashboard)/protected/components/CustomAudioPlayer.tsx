'use client';

import React, { useState, useRef, useEffect } from 'react';

const PlayIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
  </svg>
);

const PauseIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5zm6.5 0a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
  </svg>
);

interface CustomAudioPlayerProps {
  src: string;
}

const CustomAudioPlayer: React.FC<CustomAudioPlayerProps> = ({ src }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
    };
  }, []);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Number(e.target.value);
      setCurrentTime(Number(e.target.value));
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/70 border border-slate-600/50 w-full">
      <audio ref={audioRef} src={src} onEnded={() => setIsPlaying(false)} hidden />
      
      <button
        onClick={togglePlayPause}
        className="flex-shrink-0 p-2 rounded-full hover:bg-slate-700 transition-colors"
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className="flex-grow flex items-center gap-2">
        <span className="text-xs text-gray-400 w-10 text-center">{formatTime(currentTime)}</span>
        <input
          type="range"
          value={currentTime}
          max={duration || 0}
          onChange={handleProgressChange}
          className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer custom-audio-thumb"
          style={{
            background: `linear-gradient(to right, #8b5cf6 ${
              (currentTime / duration) * 100
            }%, #475569 ${(currentTime / duration) * 100}%)`,
          }}
        />
        <span className="text-xs text-gray-400 w-10 text-center">{formatTime(duration)}</span>
      </div>

      <style jsx global>{`
        .custom-audio-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          margin-top: 0px; /* Finely tuned for vertical alignment */
          background-color: #a78bfa;
          height: 14px;
          width: 14px;
          border-radius: 9999px;
          box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.2), 0 1px 2px -1px rgb(0 0 0 / 0.2);
        }
        .custom-audio-thumb::-moz-range-thumb {
          background-color: #a78bfa;
          height: 14px;
          width: 14px;
          border-radius: 9999px;
          border: none;
          box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.2), 0 1px 2px -1px rgb(0 0 0 / 0.2);
        }
      `}</style>
    </div>
  );
};

export default CustomAudioPlayer; 