"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Minus,
  Loader2,
} from "lucide-react";
import { uploadMediaAsset } from "@/lib/media-upload";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  /**
   * Out-of-band content update (e.g. from Supabase Realtime co-editing).
   *
   * When this string changes AND differs from the editor's current HTML
   * AND the editor is not focused, we replace the editor content and
   * preserve the user's cursor. If the editor IS focused we ignore it —
   * the other user's edit will be applied on the next idle moment. This
   * prevents a remote broadcast from stomping on the user's in-progress
   * keystroke. Concurrent conflicting edits are resolved at save time by
   * the optimistic-locking ConflictResolutionDialog.
   */
  remoteContent?: string | null;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-lg transition ${
        active
          ? "bg-foreground text-white"
          : "text-muted-foreground hover:bg-gray-100 hover:text-foreground"
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-0.5" />;
}

function Toolbar({
  editor,
  onChooseImage,
  imageUploading,
}: {
  editor: Editor;
  onChooseImage: () => void;
  imageUploading: boolean;
}) {
  const addLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  const iconSize = "w-4 h-4";

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-border bg-gray-50/50 rounded-t-xl">
      {/* Undo / Redo */}
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <Undo className={iconSize} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <Redo className={iconSize} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
        <Heading1 className={iconSize} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
        <Heading2 className={iconSize} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
        <Heading3 className={iconSize} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Inline formatting */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
        <Bold className={iconSize} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
        <Italic className={iconSize} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
        <UnderlineIcon className={iconSize} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
        <Strikethrough className={iconSize} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline Code">
        <Code className={iconSize} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
        <List className={iconSize} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Ordered List">
        <ListOrdered className={iconSize} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
        <Quote className={iconSize} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
        <Minus className={iconSize} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Alignment */}
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align Left">
        <AlignLeft className={iconSize} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align Center">
        <AlignCenter className={iconSize} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align Right">
        <AlignRight className={iconSize} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Insert */}
      <ToolbarButton onClick={addLink} active={editor.isActive("link")} title="Add Link">
        <LinkIcon className={iconSize} />
      </ToolbarButton>
      <ToolbarButton
        onClick={onChooseImage}
        disabled={imageUploading}
        title="Upload Image"
      >
        {imageUploading ? (
          <Loader2 className={`${iconSize} animate-spin`} />
        ) : (
          <ImageIcon className={iconSize} />
        )}
      </ToolbarButton>
    </div>
  );
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = "Start writing...",
  editable = true,
  remoteContent = null,
}: RichTextEditorProps) {
  // Track what we last applied to the editor so we can tell when a new
  // remote broadcast actually disagrees with the current content. Without
  // this we'd loop (edit → broadcast → remote arrives → setContent → edit).
  const lastAppliedRef = useRef<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  const editor = useEditor({
    // Tiptap v2.10+ requires this in SSR frameworks (Next.js App Router)
    // to prevent hydration mismatches — render only after mount on client.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      Placeholder.configure({ placeholder }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-stevie-green underline" },
      }),
      Image.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full mx-auto" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
    ],
    content,
    editable,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none px-4 py-3 min-h-[200px] focus:outline-none [&_p.is-editor-empty:first-child::before]:text-muted-foreground [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:pointer-events-none",
      },
    },
  });

  // Apply remote content when it changes out-of-band. Deferred until the
  // editor loses focus so we never interrupt local typing. `emitUpdate:
  // false` prevents this setContent from firing onUpdate, which would
  // echo the remote change straight back onto the broadcast channel.
  useEffect(() => {
    if (!editor) return;
    if (remoteContent == null) return;
    if (remoteContent === lastAppliedRef.current) return;
    if (remoteContent === editor.getHTML()) {
      lastAppliedRef.current = remoteContent;
      return;
    }
    if (editor.isFocused) return;
    editor.commands.setContent(remoteContent, { emitUpdate: false });
    lastAppliedRef.current = remoteContent;
  }, [editor, remoteContent]);

  if (!editor) return null;

  const handleImageFile = async (file: File) => {
    setImageUploading(true);
    setImageUploadError(null);
    try {
      const asset = await uploadMediaAsset(file, {
        assetType: "image",
        context: "editor-image",
      });
      editor.chain().focus().setImage({ src: asset.deliveryUrl }).run();
    } catch (err) {
      setImageUploadError(
        err instanceof Error ? err.message : "Image upload failed",
      );
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  return (
    <div className="border border-border rounded-xl bg-white overflow-hidden">
      {editable && (
        <>
          <Toolbar
            editor={editor}
            onChooseImage={() => imageInputRef.current?.click()}
            imageUploading={imageUploading}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImageFile(file);
            }}
          />
          {imageUploadError && (
            <p className="border-b border-border bg-red-50 px-4 py-2 text-xs text-red-700">
              {imageUploadError}
            </p>
          )}
        </>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
