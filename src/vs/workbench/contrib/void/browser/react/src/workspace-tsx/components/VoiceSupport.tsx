/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

interface VoiceSupportProps {
  isListening: boolean;
  onToggle: () => void;
  onTranscript?: (text: string) => void;
  disabled?: boolean;
}

export const VoiceSupport: React.FC<VoiceSupportProps> = ({
  isListening,
  onToggle,
  onTranscript,
  disabled = false,
}) => {
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      if (finalTranscript && onTranscript) {
        onTranscript(finalTranscript);
      }
      setTranscript(interimTranscript || finalTranscript);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      if (isListening) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [isListening, onTranscript]);

  if (!isSupported) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      data-action="voice-toggle"
      className={`p-1.5 rounded-full transition-colors shrink-0 cursor-pointer ${
        isListening
          ? 'bg-red-600 text-white animate-pulse'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
      title={isListening ? 'Stop Voice Input' : 'Voice Input'}
    >
      {isListening ? <MicOff size={15} /> : <Mic size={15} />}
    </button>
  );
};