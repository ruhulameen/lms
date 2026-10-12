"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { MediaPicker } from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isSafeUrl, type RichTextDocument } from "@/lib/rich-text";
import { richTextClasses } from "@/lib/rich-text-styles";
import { cn } from "@/lib/utils";

// Image node that also remembers which media item it came from.
const MediaImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), mediaId: { default: null } };
  },
});

type TiptapEditorProps = {
  initial: RichTextDocument;
  onChange: (doc: RichTextDocument) => void;
  labelledBy: string;
  invalid?: boolean;
};

export default function TiptapEditor({ initial, onChange, labelledBy, invalid }: TiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: false, isAllowedUri: (url) => isSafeUrl(url) },
      }),
      MediaImage,
    ],
    content: initial,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelledBy,
        class: cn("min-h-64 px-4 py-3 outline-none", richTextClasses),
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON() as RichTextDocument),
  });

  return (
    <div
      className={cn(
        "rounded-lg border bg-white focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive",
      )}
    >
      {editor ? <Toolbar editor={editor} /> : <div className="h-10 border-b" />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      paragraph: e.isActive("paragraph"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      h4: e.isActive("heading", { level: 4 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      link: e.isActive("link"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      code: e.isActive("codeBlock"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  // Roving focus: one tab stop, arrow keys move between buttons.
  function onKeyDown(event: KeyboardEvent) {
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>("[data-toolbar-item]:not([disabled])") ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    items[next].focus();
    setActive(Array.from(ref.current!.querySelectorAll("[data-toolbar-item]")).indexOf(items[next]));
  }

  let counter = -1;
  const item = (props: {
    label: string;
    icon: ReactNode;
    pressed?: boolean;
    disabled?: boolean;
    run: () => void;
  }) => {
    const index = ++counter;
    return (
      <Button
        key={props.label}
        type="button"
        size="icon-sm"
        variant={props.pressed ? "secondary" : "ghost"}
        aria-label={props.label}
        aria-pressed={props.pressed}
        title={props.label}
        disabled={props.disabled}
        data-toolbar-item
        tabIndex={index === active ? 0 : -1}
        onFocus={() => setActive(index)}
        onClick={props.run}
        className="focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {props.icon}
      </Button>
    );
  };
  const chain = () => editor.chain().focus();

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Text formatting"
      onKeyDown={onKeyDown}
      className="flex flex-wrap items-center gap-0.5 border-b p-1.5"
    >
      {item({ label: "Paragraph", icon: <Pilcrow />, pressed: state.paragraph, run: () => chain().setParagraph().run() })}
      {item({ label: "Heading 2", icon: <Heading2 />, pressed: state.h2, run: () => chain().toggleHeading({ level: 2 }).run() })}
      {item({ label: "Heading 3", icon: <Heading3 />, pressed: state.h3, run: () => chain().toggleHeading({ level: 3 }).run() })}
      {item({ label: "Heading 4", icon: <Heading4 />, pressed: state.h4, run: () => chain().toggleHeading({ level: 4 }).run() })}
      <Divider />
      {item({ label: "Bold", icon: <Bold />, pressed: state.bold, run: () => chain().toggleBold().run() })}
      {item({ label: "Italic", icon: <Italic />, pressed: state.italic, run: () => chain().toggleItalic().run() })}
      {item({ label: "Underline", icon: <UnderlineIcon />, pressed: state.underline, run: () => chain().toggleUnderline().run() })}
      {item({ label: "Strikethrough", icon: <Strikethrough />, pressed: state.strike, run: () => chain().toggleStrike().run() })}
      <LinkControl editor={editor} pressed={state.link} index={++counter} active={active} setActive={setActive} />
      <Divider />
      {item({ label: "Bulleted list", icon: <List />, pressed: state.bullet, run: () => chain().toggleBulletList().run() })}
      {item({ label: "Numbered list", icon: <ListOrdered />, pressed: state.ordered, run: () => chain().toggleOrderedList().run() })}
      {item({ label: "Quote", icon: <Quote />, pressed: state.quote, run: () => chain().toggleBlockquote().run() })}
      {item({ label: "Code block", icon: <Code />, pressed: state.code, run: () => chain().toggleCodeBlock().run() })}
      {item({ label: "Horizontal rule", icon: <Minus />, run: () => chain().setHorizontalRule().run() })}
      <ImageControl editor={editor} />
      <Divider />
      {item({ label: "Undo", icon: <Undo2 />, disabled: !state.canUndo, run: () => chain().undo().run() })}
      {item({ label: "Redo", icon: <Redo2 />, disabled: !state.canRedo, run: () => chain().redo().run() })}
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-slate-200" />;
}

function ImageControl({ editor }: { editor: Editor }) {
  return (
    <MediaPicker
      kind="IMAGE"
      triggerVariant="ghost"
      triggerLabel="Insert image"
      trigger={<ImagePlus aria-hidden />}
      onSelect={(media) => {
        if (!media.url) {
          toast.error("This image has no public URL. Check that storage is configured.");
          return;
        }
        editor
          .chain()
          .focus()
          .insertContent({
            type: "image",
            attrs: {
              src: media.url,
              alt: media.altText ?? "",
              mediaId: media.id,
              width: media.width,
              height: media.height,
            },
          })
          .run();
      }}
    />
  );
}

// Bare domains get https://; anything not http(s), mailto, tel or relative is refused.
function normaliseUrl(input: string) {
  const value = input.trim();
  if (!value) return null;
  const candidate = /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(value) ? value : `https://${value}`;
  return isSafeUrl(candidate) ? candidate : null;
}

function LinkControl({
  editor,
  pressed,
  index,
  active,
  setActive,
}: {
  editor: Editor;
  pressed: boolean;
  index: number;
  active: number;
  setActive: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function apply() {
    const url = normaliseUrl(value);
    if (!url) {
      setError("Enter a web address (https://...), an email (mailto:...), a phone (tel:...) or a path starting with /.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setValue((editor.getAttributes("link").href as string | undefined) ?? "");
          setError(null);
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant={pressed ? "secondary" : "ghost"}
            aria-label="Link"
            aria-pressed={pressed}
            title="Link"
            data-toolbar-item
            tabIndex={index === active ? 0 : -1}
            onFocus={() => setActive(index)}
          />
        }
      >
        <LinkIcon aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <label htmlFor="editor-link-url" className="text-sm font-medium">
            Link address
          </label>
          <Input
            id="editor-link-url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "editor-link-error" : undefined}
            placeholder="https://example.com"
            autoComplete="off"
          />
          {error && (
            <p id="editor-link-error" role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm">Apply</Button>
            {pressed && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  setOpen(false);
                }}
              >
                Remove link
              </Button>
            )}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
