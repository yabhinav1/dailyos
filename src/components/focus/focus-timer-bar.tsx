"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Clock, Music } from "lucide-react";

import { getWebkitAudioContext } from "@/lib/utils";

/**
 * Fills an audio buffer with pink noise (the "rain" ambience).
 *
 * Lives outside the component on purpose: it calls Math.random(), and React
 * Compiler treats any impure call reachable from a component body as a render
 * hazard even when it only ever runs from an event handler.
 */
function fillWithPinkNoise(buffer: AudioBuffer) {
  const output = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < buffer.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    output[i] *= 0.11;
    b6 = white * 0.115926;
  }
}

export default function FocusTimerBar() {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 min in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<"work" | "break">("work");
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorNodeRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Timer countdown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      if (mode === "work") {
        setMode("break");
        setTimeLeft(5 * 60);
      } else {
        setMode("work");
        setTimeLeft(25 * 60);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft, mode]);

  // Ambient sound synthesizer generator using Web Audio API
  const startAmbientSound = (soundType: string) => {
    stopAmbientSound();
    try {
      const AudioCtx = window.AudioContext || getWebkitAudioContext();
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(isMuted ? 0 : 0.15, ctx.currentTime);
      gain.connect(ctx.destination);
      gainNodeRef.current = gain;

      if (soundType === "rain") {
        // Pink noise generator for rain
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        fillWithPinkNoise(noiseBuffer);
        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;
        whiteNoise.connect(gain);
        whiteNoise.start();
      } else if (soundType === "waves" || soundType === "space") {
        const osc = ctx.createOscillator();
        osc.type = soundType === "waves" ? "sine" : "triangle";
        osc.frequency.setValueAtTime(soundType === "waves" ? 110 : 60, ctx.currentTime);
        osc.connect(gain);
        osc.start();
        oscillatorNodeRef.current = osc;
      }
      setActiveSound(soundType);
    } catch (e) {
      console.error("Audio synth error", e);
    }
  };

  const stopAmbientSound = () => {
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {
        // context was already closed
      }
      audioCtxRef.current = null;
    }
    setActiveSound(null);
  };

  const toggleSound = (type: string) => {
    if (activeSound === type) {
      stopAmbientSound();
    } else {
      startAmbientSound(type);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(!isMuted ? 0 : 0.15, audioCtxRef.current.currentTime);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(mode === "work" ? 25 * 60 : 5 * 60);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Timer Bar Pill */}
      <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-1 text-xs shadow-md">
        <Clock className="h-3.5 w-3.5 text-zinc-400" />
        <span className="font-mono font-bold text-white text-xs">{formatTime(timeLeft)}</span>
        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
          {mode === "work" ? "Focus" : "Break"}
        </span>

        <button
          onClick={() => setIsRunning(!isRunning)}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
          title={isRunning ? "Pause timer" : "Start timer"}
        >
          {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </button>

        <button
          onClick={resetTimer}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          title="Reset timer"
        >
          <RotateCcw className="h-3 w-3" />
        </button>

        <div className="w-px h-3.5 bg-zinc-800 mx-0.5" />

        {/* Ambient Sound Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className={`flex items-center gap-1 p-1 rounded transition-colors text-[11px] font-medium ${
              activeSound ? "text-white font-semibold" : "text-zinc-400 hover:text-white"
            }`}
            title="Ambient Focus Sounds"
          >
            <Music className="h-3 w-3" />
            <span className="hidden md:inline">{activeSound ? activeSound : "Sounds"}</span>
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 z-50 w-44 rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl space-y-1 text-xs animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1 text-[10px] uppercase font-bold text-zinc-500 tracking-wider border-b border-zinc-900 mb-1">
                Ambient Focus Sounds
              </div>
              <button
                onClick={() => { toggleSound("rain"); setShowMenu(false); }}
                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs transition-colors ${
                  activeSound === "rain" ? "bg-zinc-800 text-white font-medium" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                }`}
              >
                <span>🌧️ Rain Storm</span>
                {activeSound === "rain" && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
              </button>
              <button
                onClick={() => { toggleSound("waves"); setShowMenu(false); }}
                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs transition-colors ${
                  activeSound === "waves" ? "bg-zinc-800 text-white font-medium" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                }`}
              >
                <span>🌊 Ocean Waves</span>
                {activeSound === "waves" && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
              </button>
              <button
                onClick={() => { toggleSound("space"); setShowMenu(false); }}
                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs transition-colors ${
                  activeSound === "space" ? "bg-zinc-800 text-white font-medium" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                }`}
              >
                <span>🪐 Deep Space Ambient</span>
                {activeSound === "space" && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
              </button>

              {activeSound && (
                <button
                  onClick={() => { stopAmbientSound(); setShowMenu(false); }}
                  className="w-full text-center px-2 py-1 rounded text-[11px] text-red-400 hover:bg-red-500/10 mt-1"
                >
                  Turn Off Sound
                </button>
              )}
            </div>
          )}
        </div>

        {activeSound && (
          <button onClick={toggleMute} className="p-1 rounded text-zinc-400 hover:text-white">
            {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
          </button>
        )}
      </div>
    </div>
  );
}
