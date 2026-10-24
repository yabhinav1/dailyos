"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Image from "@tiptap/extension-image";
import { AudioNode } from "./audio-node";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo,
  Redo,
  Highlighter,
  ImagePlus,
  Crop,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  Mic,
  MicOff,
  CheckSquare,
  Wand2,
  FileText,
  Languages,
  Eye,
  Edit3,
} from "lucide-react";
import { aiSummarizeAction, aiExtractTasksAction, aiTranslateAction, type ExtractedTask } from "@/features/notes/ai-actions";
import ExtractTasksDialog from "./extract-tasks-dialog";
import ImageCropModal from "./image-crop-modal";
import ToolbarButton from "./toolbar-button";
import { uploadMedia, type MediaTarget } from "./upload-media";
import { toast } from "@/stores/toast-store";

/** Recordings stop here so they stay under the 4MB upload limit. */
const MAX_RECORDING_MS = 4 * 60 * 1000;
import { localDateKey } from "@/lib/dates";

interface RichEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  /** False renders the note read-only with no toolbar (shared "can view"). */
  editable?: boolean;
  /** The AI menu needs a signed-in user; hidden for anonymous editors. */
  aiTools?: boolean;
  /** Where pasted images and voice notes are stored. */
  mediaTarget?: MediaTarget;
}

export default function RichEditor({
  content,
  onChange,
  placeholder = "Start writing...",
  editable = true,
  aiTools = true,
  mediaTarget = {},
}: RichEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const [selectedImgSrc, setSelectedImgSrc] = useState<string | null>(null);
  // The live <img> node is held in a ref, not state: every image control below
  // mutates it directly (style/src/remove), and React Compiler forbids mutating
  // values that came out of useState. `selectedImgSrc` is the render-visible
  // "is an image selected" signal.
  const selectedImgRef = useRef<HTMLImageElement | null>(null);
  const [croppingImgSrc, setCroppingImgSrc] = useState<string | null>(null);
  const [imgRect, setImgRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  // Voice note & AI state
  const [isRecording, setIsRecording] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
        setIsRecording(false);
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
        // Uploaded to file storage; a blob: URL only lives as long as the tab.
        let src: string;
        try {
          src = await uploadMedia(audioBlob, "voice-note.webm", mediaTarget);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Couldn't save the recording.");
          return;
        }
        insertAfterSelection([
          { type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "🎙️ Voice note" }] },
          { type: "audio", attrs: { src } },
          { type: "paragraph" },
        ]);
      };
      mediaRecorder.start();
      setIsRecording(true);
      recordingTimerRef.current = setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
          toast.success("Recording stopped at the 4 minute limit.");
        }
      }, MAX_RECORDING_MS);
    } catch {
      alert("Microphone permission is required to record voice notes.");
    }
  };
  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  const [targetLang, setTargetLang] = useState("English");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const handleAiSummarize = async () => {
    if (!editor) return;
    const text = editor.getHTML();
    if (!text.trim()) return;
    setAiError(null);
    setIsAiLoading(true);
    const res = await aiSummarizeAction(text, targetLang);
    setIsAiLoading(false);
    if (!res.success) return setAiError(res.error);
    editor.chain().focus("start").insertContent(res.summary).run();
    setShowAiMenu(false);
  };
  // Opens a review dialog of real tasks to create; nothing goes into the note.
  const [extracted, setExtracted] = useState<{ tasks: ExtractedTask[]; usedAi: boolean } | null>(null);
  const handleAiExtractTasks = async () => {
    if (!editor) return;
    const text = editor.getHTML();
    if (!text.trim()) return;
    setAiError(null);
    setIsAiLoading(true);
    const res = await aiExtractTasksAction(text, localDateKey());
    setIsAiLoading(false);
    if (!res.success) return setAiError(res.error);
    setExtracted({ tasks: res.tasks, usedAi: res.usedAi });
    setShowAiMenu(false);
  };
  const handleAiTranslate = async () => {
    if (!editor) return;
    const text = editor.getHTML();
    if (!text.trim()) return;
    setAiError(null);
    setIsAiLoading(true);
    const res = await aiTranslateAction(text, targetLang);
    setIsAiLoading(false);
    if (!res.success) return setAiError(res.error);
    editor.chain().focus("end").insertContent(res.translated).run();
    setShowAiMenu(false);
  };
  const handleAiRefineText = () => {
    if (!editor) return;
    let text = editor.getText();
    if (!text.trim()) return;
    text = text.replace(/\s+/g, " ").trim();
    editor.chain().focus().selectAll().insertContent(`<p>${text}</p>`).run();
    setShowAiMenu(false);
  };
  const updateImgRect = useCallback(() => {
    const el = selectedImgRef.current;
    if (el && editorContainerRef.current) {
      const parent = editorContainerRef.current.getBoundingClientRect();
      const child = el.getBoundingClientRect();
      setImgRect({
        left: child.left - parent.left,
        top: child.top - parent.top,
        width: child.width,
        height: child.height,
      });
    } else {
      setImgRect(null);
    }
  }, []);

  useEffect(() => {
    updateImgRect();
    window.addEventListener("resize", updateImgRect);
    return () => window.removeEventListener("resize", updateImgRect);
  }, [selectedImgSrc, updateImgRect]);

  const handleHandlePointerDown = (e: React.PointerEvent, mode: string) => {
    e.stopPropagation();
    e.preventDefault();
    const el = selectedImgRef.current;
    if (!el || !imgRect) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = imgRect.width;
    const startH = imgRect.height;

    const handlePointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let newW = startW;
      let newH = startH;

      if (mode === "se") {
        newW = Math.max(40, startW + dx);
        newH = Math.max(40, startH + dy);
      } else if (mode === "sw") {
        newW = Math.max(40, startW - dx);
        newH = Math.max(40, startH + dy);
      } else if (mode === "ne") {
        newW = Math.max(40, startW + dx);
        newH = Math.max(40, startH - dy);
      } else if (mode === "nw") {
        newW = Math.max(40, startW - dx);
        newH = Math.max(40, startH - dy);
      } else if (mode === "e") {
        newW = Math.max(40, startW + dx);
      } else if (mode === "w") {
        newW = Math.max(40, startW - dx);
      } else if (mode === "s") {
        newH = Math.max(40, startH + dy);
      } else if (mode === "n") {
        newH = Math.max(40, startH - dy);
      }
      el.style.width = `${newW}px`;
      el.style.height = `${newH}px`;
      updateImgRect();
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      if (editor) onChange(editor.getHTML());
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handleAlignImage = (align: "left" | "center" | "right") => {
    const el = selectedImgRef.current;
    if (!el) return;
    el.style.display = "block";
    el.style.marginLeft = align === "left" ? "0" : "auto";
    el.style.marginRight = align === "right" ? "0" : "auto";
    updateImgRect();
    if (editor) onChange(editor.getHTML());
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: false }),
      Typography,
      Image.configure({ inline: false, HTMLAttributes: { class: "rounded-lg max-w-full cursor-pointer hover:ring-2 hover:ring-white/50 transition-all" } }),
      AudioNode,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none min-h-[300px] h-full px-4 py-3 text-sm leading-relaxed text-zinc-200",
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              insertImageFile(file);
              event.preventDefault();
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const imageFile = Array.from(files).find((f) => f.type.startsWith("image/"));
        if (imageFile) {
          insertImageFile(imageFile);
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
  });

  // Media goes after whatever is selected, never over it: a just-inserted
  // image stays selected, so the next recording used to replace it. The
  // trailing paragraph leaves the cursor below, ready to keep typing.
  const insertAfterSelection = (content: JSONContent[]) => {
    if (!editor) return;
    editor.chain().focus().insertContentAt(editor.state.selection.to, content).run();
  };

  const insertImageFile = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Please choose an image under 25MB.");
      return;
    }
    try {
      const src = await uploadMedia(file, file.name || "image", mediaTarget);
      insertAfterSelection([{ type: "image", attrs: { src } }, { type: "paragraph" }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add the image.");
    }
  };

  const handleImageButtonClick = () => fileInputRef.current?.click();

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) insertImageFile(file);
    e.target.value = "";
  };

  // Listen for clicks on images in the editor to activate Canva-style image toolbar
  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      const img = target as HTMLImageElement;
      selectedImgRef.current = img;
      setSelectedImgSrc(img.src);
      setTimeout(updateImgRect, 50);
    } else {
      selectedImgRef.current = null;
      setSelectedImgSrc(null);
      setImgRect(null);
    }

    if (editor && e.target === e.currentTarget) {
      editor.chain().focus("end").run();
    }
  };

  const handleCropComplete = (croppedDataUrl: string) => {
    if (!editor || !selectedImgSrc) return;
    if (selectedImgRef.current) {
      selectedImgRef.current.src = croppedDataUrl;
      onChange(editor.getHTML());
      setTimeout(updateImgRect, 50);
    } else {
      editor.chain().focus().setImage({ src: croppedDataUrl }).run();
    }
    setSelectedImgSrc(croppedDataUrl);
  };

  const handleResizeImage = (widthPercent: number) => {
    const el = selectedImgRef.current;
    if (!el || !editor) return;
    el.style.width = `${widthPercent}%`;
    el.style.height = "auto";
    updateImgRect();
    onChange(editor.getHTML());
  };

  const handleDeleteSelectedImage = () => {
    const el = selectedImgRef.current;
    if (!el) return;
    el.remove();
    selectedImgRef.current = null;
    setSelectedImgSrc(null);
    setImgRect(null);
    if (editor) onChange(editor.getHTML());
  };

  // Keep editor content in sync when prop changes externally (e.g. note switched)
  const lastContent = useRef(content);
  useEffect(() => {
    if (editor && content !== lastContent.current && content !== editor.getHTML()) {
      // Not an edit: Tiptap v3 emits an update by default, which made merely
      // opening a note save it (and bump it to the top of the list).
      editor.commands.setContent(content || "", { emitUpdate: false });
      lastContent.current = content;
    }
  }, [content, editor]);

  // Access can change while open (an owner downgrades someone to viewer).
  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable, false);
  }, [editor, editable]);

  if (!editor) return null;

  return (
    <div ref={editorContainerRef} className="flex flex-col h-full border border-zinc-800 rounded-xl bg-[#171717] overflow-hidden relative">
      <ExtractTasksDialog tasks={extracted?.tasks ?? null} usedAi={extracted?.usedAi ?? false} onClose={() => setExtracted(null)} />

      {/* Crop Modal */}
      {croppingImgSrc && (
        <ImageCropModal
          imageSrc={croppingImgSrc}
          onClose={() => setCroppingImgSrc(null)}
          onCropComplete={handleCropComplete}
        />
      )}

      {/* Canva 8-Handle Bounding Box Overlay for Selected Editor Image */}
      {imgRect && selectedImgSrc && (
        <div
          className="absolute border-2 border-white pointer-events-none z-30 ring-1 ring-black/50"
          style={{
            left: `${imgRect.left}px`,
            top: `${imgRect.top}px`,
            width: `${imgRect.width}px`,
            height: `${imgRect.height}px`,
          }}
        >
          {/* 4 Corner Circular Handles */}
          <div
            onPointerDown={(e) => handleHandlePointerDown(e, "nw")}
            className="absolute -top-2 -left-2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform"
          />
          <div
            onPointerDown={(e) => handleHandlePointerDown(e, "ne")}
            className="absolute -top-2 -right-2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform"
          />
          <div
            onPointerDown={(e) => handleHandlePointerDown(e, "sw")}
            className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform"
          />
          <div
            onPointerDown={(e) => handleHandlePointerDown(e, "se")}
            className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform"
          />

          {/* 4 Side Handles */}
          <div
            onPointerDown={(e) => handleHandlePointerDown(e, "n")}
            className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-ns-resize pointer-events-auto hover:scale-125 transition-transform"
          />
          <div
            onPointerDown={(e) => handleHandlePointerDown(e, "s")}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-ns-resize pointer-events-auto hover:scale-125 transition-transform"
          />
          <div
            onPointerDown={(e) => handleHandlePointerDown(e, "w")}
            className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-ew-resize pointer-events-auto hover:scale-125 transition-transform"
          />
          <div
            onPointerDown={(e) => handleHandlePointerDown(e, "e")}
            className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-zinc-900 bg-white shadow-md cursor-ew-resize pointer-events-auto hover:scale-125 transition-transform"
          />
        </div>
      )}

      {/* Canva-style Floating Image Action Toolbar */}
      {selectedImgSrc && (
        <div className="absolute top-12 right-4 z-40 flex items-center gap-1.5 p-1.5 rounded-lg border border-zinc-800 bg-zinc-950/90 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          <span className="text-[11px] font-bold text-zinc-300 px-1.5 uppercase tracking-wider">Image Options</span>
          <div className="w-px h-3.5 bg-zinc-800" />
          <button
            onClick={() => setCroppingImgSrc(selectedImgSrc)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
            title="Crop this image"
          >
            <Crop className="h-3.5 w-3.5" />
            <span>Crop</span>
          </button>

          <div className="w-px h-3.5 bg-zinc-800" />

          {/* Alignment */}
          <div className="flex items-center gap-0.5">
            <button onClick={() => handleAlignImage("left")} className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white" title="Align Left">
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => handleAlignImage("center")} className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white" title="Align Center">
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => handleAlignImage("right")} className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white" title="Align Right">
              <AlignRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="w-px h-3.5 bg-zinc-800" />

          {/* Size presets */}
          <div className="flex items-center gap-1 text-[11px] font-medium text-zinc-300">
            <button onClick={() => handleResizeImage(33)} className="px-1.5 py-0.5 rounded hover:bg-zinc-800 hover:text-white">33%</button>
            <button onClick={() => handleResizeImage(50)} className="px-1.5 py-0.5 rounded hover:bg-zinc-800 hover:text-white">50%</button>
            <button onClick={() => handleResizeImage(100)} className="px-1.5 py-0.5 rounded hover:bg-zinc-800 hover:text-white">100%</button>
          </div>

          <div className="w-px h-3.5 bg-zinc-800" />

          <button
            onClick={handleDeleteSelectedImage}
            className="p-1 rounded hover:bg-red-500/20 text-zinc-300 hover:text-red-400 transition-colors"
            title="Delete Image"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Toolbar */}
      {editable && (
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-2 border-b border-zinc-900 bg-zinc-950/60">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic (Ctrl+I)">
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Strikethrough">
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive("highlight")} title="Highlight">
          <Highlighter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-zinc-800 mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Bullet list">
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Numbered list">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive("blockquote")} title="Quote">
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive("code")} title="Inline code">
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={handleImageButtonClick} title="Insert / Paste image">
          <ImagePlus className="h-3.5 w-3.5" />
        </ToolbarButton>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
        <div className="w-px h-4 bg-zinc-800 mx-1" />
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)">
          <Undo className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)">
          <Redo className="h-3.5 w-3.5" />
        </ToolbarButton>

        {/* Heading shortcuts */}
        <div className="w-px h-4 bg-zinc-800 mx-1" />
        {[1, 2, 3].map((level) => (
          <ToolbarButton
            key={level}
            onClick={() => editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()}
            isActive={editor.isActive("heading", { level })}
            title={`Heading ${level}`}
          >
            <span className="text-[11px] font-bold">H{level}</span>
          </ToolbarButton>
        ))}
        <div className="w-px h-4 bg-zinc-800 mx-1" />
        {/* Voice Note Recorder Button */}
        <button
          type="button"
          onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
          title={isRecording ? "Stop recording voice note" : "Record voice note"}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
            isRecording
              ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse"
              : "text-zinc-300 hover:text-white hover:bg-zinc-800"
          }`}
        >
          {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          <span>{isRecording ? "Stop Rec" : "Voice"}</span>
        </button>
        {/* Reader Mode Toggle */}
        <button
          type="button"
          onClick={() => setIsPreviewMode(!isPreviewMode)}
          title={isPreviewMode ? "Switch to Editor" : "Reader / Preview Mode"}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
            isPreviewMode ? "bg-zinc-800 text-white font-semibold" : "text-zinc-300 hover:text-white hover:bg-zinc-800"
          }`}
        >
          {isPreviewMode ? <Edit3 className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          <span>{isPreviewMode ? "Edit Mode" : "Reader Mode"}</span>
        </button>
        {/* AI Smart Assistant & Translation Menu */}
        {aiTools && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAiMenu(!showAiMenu)}
            title="AI Smart Assistant & Language Translator"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-zinc-200" />
            <span>{isAiLoading ? "Processing..." : "AI & Language"}</span>
          </button>
          {showAiMenu && (
            <div className="absolute right-0 top-8 z-50 w-56 rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 shadow-2xl space-y-2 text-xs animate-in fade-in zoom-in-95 duration-150">
              {/* Language Selector */}
              <div className="space-y-1 pb-1.5 border-b border-zinc-800">
                <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
                  <Languages className="h-3 w-3 text-zinc-300" /> Target Language
                </label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full rounded bg-zinc-900 border border-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                >
                  {["English", "Spanish", "French", "German", "Japanese", "Chinese", "Hindi", "Arabic", "Russian", "Portuguese", "Italian", "Korean"].map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>
              {aiError && (
                <p className="rounded bg-red-950/50 border border-red-900/60 px-2 py-1.5 text-[11px] leading-snug text-red-300">
                  {aiError}
                </p>
              )}
              <div className="space-y-1 pt-0.5">
                <button
                  onClick={handleAiSummarize}
                  disabled={isAiLoading}
                  className="w-full text-left px-2 py-1.5 rounded flex items-center gap-2 text-zinc-200 hover:bg-zinc-900 hover:text-white transition-colors"
                >
                  <Wand2 className="h-3.5 w-3.5 text-zinc-300" />
                  <span>Executive Summary</span>
                </button>
                <button
                  onClick={handleAiExtractTasks}
                  disabled={isAiLoading}
                  className="w-full text-left px-2 py-1.5 rounded flex items-center gap-2 text-zinc-200 hover:bg-zinc-900 hover:text-white transition-colors"
                >
                  <CheckSquare className="h-3.5 w-3.5 text-zinc-300" />
                  <span>Turn into Tasks</span>
                </button>
                <button
                  onClick={handleAiTranslate}
                  disabled={isAiLoading}
                  className="w-full text-left px-2 py-1.5 rounded flex items-center gap-2 text-zinc-200 hover:bg-zinc-900 hover:text-white transition-colors"
                >
                  <Languages className="h-3.5 w-3.5 text-zinc-300" />
                  <span>Translate Document</span>
                </button>
                <button
                  onClick={handleAiRefineText}
                  disabled={isAiLoading}
                  className="w-full text-left px-2 py-1.5 rounded flex items-center gap-2 text-zinc-200 hover:bg-zinc-900 hover:text-white transition-colors border-t border-zinc-900 pt-1.5"
                >
                  <FileText className="h-3.5 w-3.5 text-zinc-300" />
                  <span>Refine & Clean Text</span>
                </button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
      )}
      {/* Editor / Reader Mode Content */}
      <div className="flex-1 min-h-[300px] cursor-text" onClick={handleEditorClick}>
        {isPreviewMode ? (
          <div
            className="prose prose-invert max-w-none px-6 py-5 text-sm leading-relaxed text-zinc-200"
            dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
          />
        ) : (
          <EditorContent editor={editor} className="h-full" />
        )}
      </div>

      <style jsx global>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #52525b;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .ProseMirror h1 { font-size: 1.5rem; font-weight: 700; color: #f4f4f5; margin: 0.75rem 0 0.25rem; }
        .ProseMirror h2 { font-size: 1.2rem; font-weight: 700; color: #e4e4e7; margin: 0.75rem 0 0.25rem; }
        .ProseMirror h3 { font-size: 1rem; font-weight: 600; color: #d4d4d8; margin: 0.75rem 0 0.25rem; }
        .ProseMirror ul { list-style: disc; padding-left: 1.25rem; }
        .ProseMirror ol { list-style: decimal; padding-left: 1.25rem; }
        .ProseMirror li { margin: 0.15rem 0; }
        .ProseMirror blockquote { border-left: 3px solid #3f3f46; padding-left: 1rem; color: #71717a; margin: 0.5rem 0; }
        .ProseMirror code { background: #18181b; border: 1px solid #3f3f46; border-radius: 4px; padding: 1px 5px; font-size: 0.8em; color: #a78bfa; }
        .ProseMirror mark { background: rgba(234, 179, 8, 0.25); border-radius: 2px; color: #fde047; padding: 0 2px; }
        .ProseMirror strong { font-weight: 700; color: #e4e4e7; }
        .ProseMirror em { font-style: italic; color: #a1a1aa; }
        .ProseMirror s { text-decoration: line-through; color: #71717a; }
        .ProseMirror p { margin: 0.25rem 0; }
        .ProseMirror img { border-radius: 0.5rem; margin: 0.5rem 0; max-width: 100%; height: auto; transition: all 0.15s ease; }
      `}</style>
    </div>
  );
}
