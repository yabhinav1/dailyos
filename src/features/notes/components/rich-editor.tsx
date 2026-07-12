"use client";

import React, { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Image from "@tiptap/extension-image";
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Quote, Code, Undo, Redo, Highlighter, ImagePlus,
} from "lucide-react";

interface RichEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

function ToolbarButton({
  onClick,
  isActive,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors text-xs ${
        isActive
          ? "bg-blue-600 text-white"
          : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

export default function RichEditor({ content, onChange, placeholder = "Start writing..." }: RichEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: false }),
      Typography,
      Image.configure({ inline: false, HTMLAttributes: { class: "rounded-lg max-w-full" } }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none min-h-[300px] h-full px-4 py-3 text-sm leading-relaxed text-zinc-300",
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

  const insertImageFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      alert("Please choose an image under 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      editor?.chain().focus().setImage({ src: reader.result as string }).run();
    };
    reader.readAsDataURL(file);
  };

  const handleImageButtonClick = () => fileInputRef.current?.click();

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) insertImageFile(file);
    e.target.value = "";
  };

  // Clicking anywhere in the editor's card — including empty space below
  // or beside the last line — should drop the cursor in and let you keep
  // typing, instead of only working when you click exactly on a character.
  const handleSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editor) return;
    if (e.target === e.currentTarget) {
      editor.chain().focus("end").run();
    }
  };

  // Keep editor content in sync when prop changes externally (e.g. note switched)
  const lastContent = useRef(content);
  useEffect(() => {
    if (editor && content !== lastContent.current && content !== editor.getHTML()) {
      editor.commands.setContent(content || "");
      lastContent.current = content;
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full border border-zinc-800 rounded-xl bg-[#171717] overflow-hidden">
      {/* Toolbar */}
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
        <ToolbarButton onClick={handleImageButtonClick} title="Insert image">
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
            <span className="text-[10px] font-bold">H{level}</span>
          </ToolbarButton>
        ))}
      </div>

      {/* Editor Content — click anywhere in this area, not just directly on
          existing text, to place your cursor and start typing. */}
      <div className="flex-1 min-h-[300px] cursor-text" onClick={handleSurfaceClick}>
        <EditorContent editor={editor} className="h-full" />
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
        .ProseMirror img { border-radius: 0.5rem; margin: 0.5rem 0; max-width: 100%; height: auto; }
      `}</style>
    </div>
  );
}
