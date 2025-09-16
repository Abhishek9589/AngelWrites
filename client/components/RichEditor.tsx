import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Bold, Italic, Strikethrough, List, ListOrdered, Undo2, Redo2, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";

export type RichEditorProps = {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  placeholder?: string;
  toolbarExtras?: React.ReactNode;
};


export default function RichEditor({ value, onChange, className, placeholder, toolbarExtras }: RichEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    editorProps: {
      attributes: {
        class: "prose prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[320px] p-4 md:p-6",
        spellcheck: "true",
        role: "textbox",
        "aria-multiline": "true",
        "data-placeholder": placeholder || "Start writing…",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) editor.commands.setContent(value || "", { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const btn = (active: boolean) => `h-9 px-2 rounded-full ${active ? "bg-primary text-primary-foreground" : "glass-soft"}`;

  const hasExtras = !!toolbarExtras;

  return (
    <div className={className}>
      <div className="sticky top-0 z-30 px-2 pt-2 mb-4 md:mb-6">
        <div className={`mx-auto flex flex-nowrap items-center ${hasExtras ? "justify-between" : "justify-start"} gap-1.5 whitespace-nowrap rounded-full border border-white/30 dark:border-white/10 bg-white/50 dark:bg-white/10 px-3 py-1 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.06)] overflow-x-auto no-scrollbar`}>
          {hasExtras && <div className="flex items-center gap-3 min-w-0">{toolbarExtras}</div>}
          <TooltipProvider delayDuration={150}>
            <div className="flex items-center gap-1 shrink-0 pl-2 pr-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Bold"
                    title="Bold"
                    className={btn(editor.isActive("bold"))}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bold</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Italic"
                    title="Italic"
                    className={btn(editor.isActive("italic"))}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Italic</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Strikethrough"
                    title="Strikethrough"
                    className={btn(editor.isActive("strike"))}
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                  >
                    <Strikethrough className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Strikethrough</TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="mx-1 h-6" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Bullet list"
                    title="Bullet list"
                    className={btn(editor.isActive("bulletList"))}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bullet list</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Ordered list"
                    title="Ordered list"
                    className={btn(editor.isActive("orderedList"))}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  >
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ordered list</TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="mx-1 h-6" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Undo"
                    title="Undo"
                    className="h-9 px-2 rounded-full glass-soft"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Redo"
                    title="Redo"
                    className="h-9 px-2 rounded-full glass-soft"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Redo</TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="mx-1 h-6" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Clear formatting"
                    title="Clear formatting"
                    className="h-9 px-2 rounded-full glass-soft"
                    onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
                  >
                    <Eraser className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear formatting</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </div>
      <div className={cn("glass rounded-3xl border-0")}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
