'use client';

import { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { transcribeWithWhisper } from '@/lib/whisper';

interface MicButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  disabled?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'transcribing';

export function MicButton({ onTranscript, className = '', disabled = false }: MicButtonProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastTapRef = useRef(0);

  // Check microphone support on mount
  useEffect(() => {
    const checkSupport = () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsSupported(false);
        return;
      }

      // Check for secure context (HTTPS or localhost)
      if (typeof window !== 'undefined' &&
          window.location.protocol !== 'https:' &&
          window.location.hostname !== 'localhost') {
        setIsSupported(false);
        return;
      }

      setIsSupported(true);
      setError(null);
    };

    checkSupport();
  }, []);

  // Clean up on unmount - MUST be before any conditional returns
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 마이크가 지원되지 않으면 아무것도 렌더링하지 않음
  if (!isSupported) {
    return null;
  }

  // Start recording
  const startRecording = async () => {
    try {
      setError(null);
      chunksRef.current = [];

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access not available');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });

        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Transcribe
        setState('transcribing');

        try {
          const text = await transcribeWithWhisper(blob);
          if (text && onTranscript) {
            onTranscript(text);
          }
        } catch (err) {
          console.error('Transcription error:', err);
          setError(err instanceof Error ? err.message : 'Transcription failed');
        } finally {
          setState('idle');
        }
      };

      recorder.start();
      setState('recording');
    } catch (err) {
      console.error('Failed to start recording:', err);

      let errorMessage = 'Microphone access failed';

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Microphone access denied';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'No microphone found';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Microphone in use';
        }
      }

      setError(errorMessage);
      setState('idle');
    }
  };

  // Stop recording
  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    } catch (err) {
      console.error('Error stopping recorder:', err);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Handle button click
  const handleClick = () => {
    if (disabled || !isSupported) return;

    // Debounce for mobile double-tap
    const now = Date.now();
    if (now - lastTapRef.current < 300) return;
    lastTapRef.current = now;

    if (state === 'idle') {
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
  };

  const getButtonState = () => {
    if (!isSupported || disabled) {
      return {
        icon: 'mic' as const,
        bgClass: 'bg-[var(--bg-tertiary)] cursor-not-allowed opacity-50',
        animate: false,
      };
    }

    switch (state) {
      case 'recording':
        return {
          icon: 'mic' as const,
          bgClass: 'bg-red-500 hover:bg-red-600',
          animate: true,
        };
      case 'transcribing':
        return {
          icon: 'loader' as const,
          bgClass: 'bg-blue-500',
          animate: true,
        };
      default:
        return {
          icon: 'mic' as const,
          bgClass: 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]',
          animate: false,
        };
    }
  };

  const { icon, bgClass, animate } = getButtonState();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || !isSupported || state === 'transcribing'}
        className={`
          flex items-center justify-center
          w-10 h-10 rounded-full
          text-[var(--text-primary)] transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2
          ${bgClass}
          ${animate ? 'animate-pulse' : ''}
          ${className}
        `}
        title={state === 'recording' ? 'Stop recording' : state === 'transcribing' ? 'Transcribing...' : 'Start voice input'}
      >
        <Icon name={icon} className={`w-5 h-5 ${state === 'transcribing' ? 'animate-spin' : ''}`} />
      </button>

      {error && (
        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2
                        bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
          {error}
        </div>
      )}

      {state === 'recording' && (
        <div className="absolute -inset-1 rounded-full border-2 border-red-500 animate-ping pointer-events-none" />
      )}
    </div>
  );
}
