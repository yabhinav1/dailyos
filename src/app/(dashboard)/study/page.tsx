"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { getStudyDataAction, createSubject, deleteSubject, createTopic, toggleTopicCompleted, logStudySession } from "@/features/study/actions";
import { BookOpen, Plus, Trash2, CheckCircle2, Circle, Clock, Play, Pause, RotateCcw, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonCards } from "@/components/ui/skeleton";
import type { StudyData, StudySubject } from "@/lib/types";
import { getWebkitAudioContext } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";

// ── Pomodoro Timer ──
const ALARM_STORAGE_KEY = "dailyos-pomodoro-alarm";

function PomodoroTimer({ subjects, onSessionEnd }: { subjects: StudySubject[]; onSessionEnd: (subjectId: string | null, duration: number) => void }) {
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [customSoundName, setCustomSoundName] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load any previously-saved custom alarm sound. localStorage is unreadable
  // during SSR, so this cannot move into a lazy useState initializer without a
  // hydration mismatch — reading it once after mount is the intended pattern.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ALARM_STORAGE_KEY);
      if (saved) {
        const { name, dataUrl } = JSON.parse(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
        setCustomSoundName(name);
        audioRef.current = new Audio(dataUrl);
      }
    } catch {
      // ignore corrupted storage
    }
  }, []);

  const playBeep = useCallback(() => {
    try {
      const Ctx = window.AudioContext || getWebkitAudioContext();
      const ctx = audioCtxRef.current || new Ctx();
      audioCtxRef.current = ctx;
      const now = ctx.currentTime;
      [0, 0.35, 0.7].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.3, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.32);
      });
    } catch {
      // Web Audio unsupported — silently skip
    }
  }, []);

  const playAlarm = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => playBeep());
    } else {
      playBeep();
    }
  }, [playBeep]);

  const handleUploadSound = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      alert("Please choose an audio file (mp3, wav, etc).");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      alert("Please choose a file under 3MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      localStorage.setItem(ALARM_STORAGE_KEY, JSON.stringify({ name: file.name, dataUrl }));
      audioRef.current = new Audio(dataUrl);
      setCustomSoundName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const removeCustomSound = () => {
    localStorage.removeItem(ALARM_STORAGE_KEY);
    audioRef.current = null;
    setCustomSoundName(null);
  };

  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = startTimeRef.current || Date.now();
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev === 0) {
            setMinutes((m) => {
              if (m === 0) {
                // Timer finished
                setIsRunning(false);
                if (intervalRef.current) clearInterval(intervalRef.current);
                playAlarm();
                const elapsed = Math.round((Date.now() - (startTimeRef.current || Date.now())) / 60000);
                onSessionEnd(selectedSubjectId, Math.max(elapsed, 1));
                startTimeRef.current = null;
                setMinutes(durationMinutes);
                return durationMinutes;
              }
              return m - 1;
            });
            return 59;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, selectedSubjectId, onSessionEnd, durationMinutes, playAlarm]);

  const toggleTimer = () => setIsRunning(!isRunning);
  const resetTimer = () => {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    // Log partial session if ran for at least 1 min
    if (startTimeRef.current) {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 60000);
      if (elapsed >= 1) onSessionEnd(selectedSubjectId, elapsed);
    }
    startTimeRef.current = null;
    setMinutes(durationMinutes);
    setSeconds(0);
  };

  const handleDurationChange = (val: string) => {
    const n = Math.min(180, Math.max(1, parseInt(val, 10) || 1));
    setDurationMinutes(n);
    if (!isRunning) {
      setMinutes(n);
      setSeconds(0);
    }
  };

  const progress = 1 - (minutes * 60 + seconds) / (durationMinutes * 60);
  const circumference = 2 * Math.PI * 80;

  return (
    <Card className="border-zinc-850 bg-[#0C0C0E]/40">
      <CardContent className="p-6 flex flex-col items-center gap-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Pomodoro Timer</h2>

        <div className="relative w-48 h-48 flex items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r="80" fill="none" stroke="#1c1c1e" strokeWidth="6" />
            <circle cx="90" cy="90" r="80" fill="none" stroke={isRunning ? "#3b82f6" : "#27272a"}
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)}
              className="transition-all duration-1000" />
          </svg>
          <div className="text-center z-10">
            {isRunning ? (
              <div className="text-4xl font-bold text-white font-mono">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={durationMinutes}
                  onChange={(e) => handleDurationChange(e.target.value)}
                  className="w-16 bg-transparent text-4xl font-bold text-white font-mono text-right focus:outline-none"
                />
                <span className="text-4xl font-bold text-white font-mono">:00</span>
              </div>
            )}
            <div className="text-[11px] text-zinc-400 mt-1">{isRunning ? "Focusing..." : "Ready — edit minutes above"}</div>
          </div>
        </div>

        <select value={selectedSubjectId || ""} onChange={(e) => setSelectedSubjectId(e.target.value || null)}
          className="w-full max-w-[200px] h-8 px-3 rounded-lg border border-zinc-800 bg-[#1f1f1f] text-xs text-white">
          <option value="">No subject</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={toggleTimer}
            className={`gap-1 text-xs h-8 ${isRunning ? "bg-amber-600 hover:bg-amber-500" : "bg-blue-600 hover:bg-blue-500"} text-white`}>
            {isRunning ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Start</>}
          </Button>
          <Button size="sm" variant="outline" onClick={resetTimer}
            className="border-zinc-800 text-zinc-300 text-xs h-8 gap-1">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>

        {/* Alarm sound settings */}
        <div className="w-full pt-3 border-t border-zinc-900 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Alarm sound</span>
            <button onClick={playAlarm} className="text-[11px] text-blue-500 hover:text-blue-400">Test</button>
          </div>
          <p className="text-[11px] text-zinc-400 truncate">
            {customSoundName ? `Custom: ${customSoundName}` : "Default beep"}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}
              className="border-zinc-800 text-zinc-300 text-xs h-7 flex-1">
              Upload MP3
            </Button>
            {customSoundName && (
              <Button size="sm" variant="outline" onClick={removeCustomSound}
                className="border-zinc-800 text-zinc-400 hover:text-red-400 text-xs h-7">
                Remove
              </Button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleUploadSound} />
        </div>
      </CardContent>
    </Card>
  );
}

function FlashcardWidget() {
  const [cards] = useState([
    { question: "What is the time complexity of QuickSort in the average case?", answer: "O(n log n)" },
    { question: "What is a Closure in JavaScript?", answer: "A function bundled together with references to its surrounding state (lexical environment)." },
    { question: "What does ACID stand for in Database Transactions?", answer: "Atomicity, Consistency, Isolation, Durability." },
    { question: "What is the HTTP status code 403?", answer: "403 Forbidden (Server understood request but refuses to authorize it)." },
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const card = cards[currentIndex];

  return (
    <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/80 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-zinc-300" /> Interactive Flashcards Deck
        </h3>
        <span className="text-[11px] font-mono text-zinc-400">Card {currentIndex + 1} of {cards.length}</span>
      </div>

      {/* 3D Flip Card Container */}
      <button
        type="button"
        onClick={() => setIsFlipped(!isFlipped)}
        aria-pressed={isFlipped}
        aria-label={isFlipped ? "Show the question" : "Show the answer"}
        className="flex h-32 w-full select-none flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/90 p-5 text-center shadow-lg transition-all duration-200 hover:border-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
          {isFlipped ? "Answer" : "Question (Click to flip)"}
        </span>
        <p className="text-sm font-semibold text-zinc-200 leading-snug">
          {isFlipped ? card.answer : card.question}
        </p>
      </button>

      <div className="flex justify-between items-center pt-1">
        <Button
          variant="outline"
          size="sm"
          disabled={currentIndex === 0}
          onClick={() => { setCurrentIndex((i) => Math.max(0, i - 1)); setIsFlipped(false); }}
          className="text-xs border-zinc-800 text-zinc-300 h-7"
        >
          Previous
        </Button>

        <Button
          size="sm"
          disabled={currentIndex === cards.length - 1}
          onClick={() => { setCurrentIndex((i) => Math.min(cards.length - 1, i + 1)); setIsFlipped(false); }}
          className="text-xs font-semibold h-7"
        >
          Next Card
        </Button>
      </div>
    </div>
  );
}

export default function StudyPage() {
  const confirm = useConfirm();
  const [data, setData] = useState<StudyData>({ subjects: [], recentSessions: [], totalMinutesThisWeek: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showAddTopic, setShowAddTopic] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [topicTitle, setTopicTitle] = useState("");

  const [reloadToken, setReloadToken] = useState(0);
  const reloadData = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await getStudyDataAction();
      if (cancelled) return;
      if (res.success && res.data) setData(res.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) return;
    await createSubject({ name: subjectName, code: subjectCode || undefined });
    setSubjectName(""); setSubjectCode(""); setShowAddSubject(false);
    reloadData();
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicTitle.trim() || !showAddTopic) return;
    await createTopic({ subjectId: showAddTopic, title: topicTitle });
    setTopicTitle(""); setShowAddTopic(null);
    reloadData();
  };

  const handleToggleTopic = async (topicId: string, current: boolean) => {
    await toggleTopicCompleted(topicId, !current);
    reloadData();
  };

  const handleSessionEnd = useCallback(async (subjectId: string | null, duration: number) => {
    await logStudySession(subjectId, duration);
    reloadData();
  }, [reloadData]);

  const hours = Math.floor(data.totalMinutesThisWeek / 60);
  const mins = data.totalMinutesThisWeek % 60;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <GraduationCap className="h-5.5 w-5.5 text-indigo-400" /> Study Mode
          </h1>
          <p className="text-xs text-zinc-300 mt-1">
            {hours}h {mins}m studied this week · {data.subjects.length} subjects
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddSubject(true)}
          className="gap-1 text-xs font-semibold h-8 shrink-0">
          <Plus className="h-3.5 w-3.5" /> Add Subject
        </Button>
      </div>

      {/* Interactive Flashcard Deck */}
      <FlashcardWidget />

      {loading ? (
        <SkeletonCards cards={3} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timer Column */}
          <div className="lg:col-span-1 space-y-4">
            <PomodoroTimer subjects={data.subjects} onSessionEnd={handleSessionEnd} />

            {/* Recent Sessions */}
            {data.recentSessions.length > 0 && (
              <Card className="border-zinc-850 bg-[#0C0C0E]/40">
                <CardContent className="p-4 space-y-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Recent Sessions</h3>
                  {data.recentSessions.slice(0, 5).map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-zinc-900 last:border-0">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-zinc-400" />
                        <span className="text-xs text-zinc-300">{s.subject?.name || "General"}</span>
                      </div>
                      <span className="text-xs font-semibold text-zinc-200">{s.duration}m</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Subjects Column */}
          <div className="lg:col-span-2 space-y-4">
            {data.subjects.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-zinc-850 rounded-xl">
                <BookOpen className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm font-semibold text-zinc-300">No subjects yet</p>
                <p className="text-xs text-zinc-400 mt-1">Add your first subject to start tracking topics</p>
              </div>
            ) : (
              data.subjects.map((subject) => {
                const completedTopics = subject.topics.filter((t) => t.isCompleted).length;
                const totalTopics = subject.topics.length;
                const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

                return (
                  <Card key={subject.id} className="border-zinc-850 bg-[#0C0C0E]/40 hover:border-zinc-800 transition-all">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ background: subject.color || "#6366f1" }} />
                          <h3 className="text-sm font-semibold text-zinc-100">{subject.name}</h3>
                          {subject.code && <span className="text-[11px] text-zinc-400 px-1.5 py-0.5 bg-zinc-900 rounded">{subject.code}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-zinc-400">{completedTopics}/{totalTopics} topics</span>
                          <button
                            onClick={async () => {
                              const ok = await confirm({
                                title: `Delete "${subject.name}"?`,
                                body: "Its topics and logged study sessions go with it.",
                                confirmLabel: "Delete subject",
                                destructive: true,
                              });
                              if (ok) {
                                await deleteSubject(subject.id);
                                reloadData();
                              }
                            }}
                            aria-label={`Delete ${subject.name}`}
                            className="text-zinc-400 hover:text-red-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      {totalTopics > 0 && (
                        <div className="h-1.5 w-full rounded-full bg-zinc-900">
                          <div className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
                            style={{ width: `${progress}%` }} />
                        </div>
                      )}

                      {/* Topics */}
                      <div className="space-y-1">
                        {subject.topics.map((topic) => (
                          <div key={topic.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-zinc-900/40 transition-colors group">
                            <button onClick={() => handleToggleTopic(topic.id, topic.isCompleted)}
                              className="shrink-0">
                              {topic.isCompleted
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                : <Circle className="h-4 w-4 text-zinc-400 hover:text-indigo-400" />}
                            </button>
                            <span className={`text-xs flex-1 ${topic.isCompleted ? "line-through text-zinc-400" : "text-zinc-200"}`}>
                              {topic.title}
                            </span>
                            {topic.revisionCount > 0 && (
                              <span className="text-[11px] text-zinc-400 px-1 bg-zinc-900 rounded">×{topic.revisionCount}</span>
                            )}
                          </div>
                        ))}
                      </div>

                      <Button size="sm" variant="outline" onClick={() => setShowAddTopic(subject.id)}
                        className="border-zinc-800 text-zinc-400 text-xs h-7 gap-1 hover:text-zinc-200 w-full">
                        <Plus className="h-3 w-3" /> Add Topic
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Add Subject Dialog */}
      <Dialog open={showAddSubject} onOpenChange={setShowAddSubject}>
        <DialogContent className="max-w-sm bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
          <DialogHeader><DialogTitle className="text-sm font-bold text-white">Add Subject</DialogTitle></DialogHeader>
          <form onSubmit={handleAddSubject} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">Subject Name</Label>
              <Input autoFocus placeholder="e.g. Data Structures" value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                className="bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-400 text-xs" required />
            </div>
            <div className="space-y-1">
              <Label className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">Code (optional)</Label>
              <Input placeholder="e.g. CS201" value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
                className="bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-400 text-xs" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
              <Button type="button" variant="outline" onClick={() => setShowAddSubject(false)}
                className="border-zinc-800 text-zinc-300 text-xs h-8">Cancel</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold h-8">Add Subject</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Topic Dialog */}
      <Dialog open={!!showAddTopic} onOpenChange={() => setShowAddTopic(null)}>
        <DialogContent className="max-w-sm bg-[#171717] border border-zinc-800 p-6 shadow-2xl">
          <DialogHeader><DialogTitle className="text-sm font-bold text-white">Add Topic</DialogTitle></DialogHeader>
          <form onSubmit={handleAddTopic} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-zinc-300 text-[11px] uppercase font-bold tracking-wider">Topic Title</Label>
              <Input autoFocus placeholder="e.g. Binary Trees" value={topicTitle}
                onChange={(e) => setTopicTitle(e.target.value)}
                className="bg-zinc-900/50 border-zinc-800 text-white placeholder-zinc-400 text-xs" required />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
              <Button type="button" variant="outline" onClick={() => setShowAddTopic(null)}
                className="border-zinc-800 text-zinc-300 text-xs h-8">Cancel</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold h-8">Add Topic</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
