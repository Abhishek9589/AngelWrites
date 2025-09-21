import React, { useEffect, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import FontFamily from "@tiptap/extension-font-family";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Palette,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * @typedef {{value: string, onChange: function(string):void, className?:string, placeholder?:string, toolbarExtras?:any}} RichEditorProps
 */

const FONT_MAP = {
  georgia: "Georgia, serif",
  garamond: "Garamond, serif",
  times: '"Times New Roman", Times, serif',
  calibri: 'Calibri, "Trebuchet MS", sans-serif',
  opensans: '"Open Sans", Arial, sans-serif',
  courier: '"Courier New", Courier, monospace',
};

export default function RichEditor({ value, onChange, className, placeholder, toolbarExtras }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      FontFamily,
      Color.configure({ types: ["textStyle"] }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
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
    if (value !== current) editor.commands.setContent(value || "", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const hasExtras = !!toolbarExtras;

  const sizeValue = useMemo(() => {
    if (!editor) return "normal";
    if (editor.isActive("heading", { level: 1 })) return "title";
    if (editor.isActive("heading", { level: 2 })) return "heading";
    if (editor.isActive("heading", { level: 3 })) return "subheading";
    return "normal";
  }, [editor, editor?.state]);

  const fontKey = useMemo(() => {
    if (!editor) return "";
    const fam = editor.getAttributes("textStyle").fontFamily;
    if (!fam) return "";
    const entry = Object.entries(FONT_MAP).find(([, stack]) => stack.toLowerCase() === String(fam).toLowerCase());
    return entry ? entry[0] : "";
  }, [editor, editor?.state]);

  if (!editor) return null;

  const btn = (active) => cn(
    "h-11 px-3 md:h-8 md:px-2 rounded-md",
    active ? "bg-primary text-primary-foreground" : "hover:bg-accent/60"
  );

  return (
    <div className={className}>
      <div className="sticky top-0 z-30 px-2 pt-2 mb-3 md:mb-4">
        <div className={cn(
          "mx-auto flex flex-nowrap items-center",
          hasExtras ? "justify-between" : "justify-start",
          "gap-1.5 whitespace-nowrap rounded-md border bg-background/80 px-2 py-1 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm overflow-x-auto no-scrollbar scroll-fade-x"
        )}>
          {hasExtras && <div className="flex items-center gap-3 min-w-0">{toolbarExtras}</div>}
          <TooltipProvider delayDuration={150}>
            <div className="flex items-center gap-1 shrink-0 pl-1 pr-2">
              {/* Text Styles */}
              <Tooltip><TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label="Bold" title="Bold" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>
                  <Bold className="h-4 w-4" />
                </Button>
              </TooltipTrigger><TooltipContent>Bold</TooltipContent></Tooltip>

              <Tooltip><TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label="Italic" title="Italic" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}>
                  <Italic className="h-4 w-4" />
                </Button>
              </TooltipTrigger><TooltipContent>Italic</TooltipContent></Tooltip>

              <Tooltip><TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label="Underline" title="Underline" className={btn(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                  <UnderlineIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger><TooltipContent>Underline</TooltipContent></Tooltip>

              <Tooltip><TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label="Strikethrough" title="Strikethrough" className={btn(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()}>
                  <Strikethrough className="h-4 w-4" />
                </Button>
              </TooltipTrigger><TooltipContent>Strikethrough</TooltipContent></Tooltip>

              <Separator orientation="vertical" className="mx-1 h-6" />

              {/* Font */}
              <div className="flex items-center gap-1">
                <Select value={fontKey || undefined} onValueChange={(k) => editor.chain().focus().setFontFamily(FONT_MAP[k]).run()}>
                  <SelectTrigger className="h-11 md:h-8 px-3 md:px-2 py-0 w-36 sm:w-[9.5rem] text-xs">
                    <SelectValue placeholder="Font Family" />
                  </SelectTrigger>
                  <SelectContent className="text-sm">
                    <SelectItem value="georgia">Georgia</SelectItem>
                    <SelectItem value="garamond">Garamond</SelectItem>
                    <SelectItem value="times">Times New Roman</SelectItem>
                    <SelectItem value="calibri">Calibri</SelectItem>
                    <SelectItem value="opensans">Open Sans</SelectItem>
                    <SelectItem value="courier">Courier New</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sizeValue} onValueChange={(v) => {
                  const chain = editor.chain().focus();
                  if (v === "normal") chain.setParagraph().run();
                  if (v === "title") chain.toggleHeading({ level: 1 }).run();
                  if (v === "heading") chain.toggleHeading({ level: 2 }).run();
                  if (v === "subheading") chain.toggleHeading({ level: 3 }).run();
                }}>
                  <SelectTrigger className="h-11 md:h-8 px-3 md:px-2 py-0 w-32 sm:w-[8.5rem] text-xs">
                    <SelectValue placeholder="Font Size" />
                  </SelectTrigger>
                  <SelectContent className="text-sm">
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="heading">Heading</SelectItem>
                    <SelectItem value="subheading">Subheading</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" aria-label="Text color" title="Text color" className="h-8 px-2 rounded-md hover:bg-accent/60">
                      <Palette className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40" align="start">
                    <input type="color" className="h-8 w-full cursor-pointer bg-transparent" aria-label="Text color" onChange={(e) => editor.chain().focus().setColor(e.currentTarget.value).run()} />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" aria-label="Highlight" title="Highlight" className="h-8 px-2 rounded-md hover:bg-accent/60">
                      <Highlighter className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40" align="start">
                    <input type="color" className="h-8 w-full cursor-pointer bg-transparent" aria-label="Highlight color" onChange={(e) => editor.chain().focus().setHighlight({ color: e.currentTarget.value }).run()} />
                  </PopoverContent>
                </Popover>
              </div>

              <Separator orientation="vertical" className="mx-1 h-6" />

              {/* Alignment */}
              <Tooltip><TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label="Align left" title="Align left" className={btn(editor.isActive({ textAlign: "left" }))} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
                  <AlignLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger><TooltipContent>Left</TooltipContent></Tooltip>

              <Tooltip><TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label="Align center" title="Align center" className={btn(editor.isActive({ textAlign: "center" }))} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
                  <AlignCenter className="h-4 w-4" />
                </Button>
              </TooltipTrigger><TooltipContent>Center</TooltipContent></Tooltip>

              <Tooltip><TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label="Align right" title="Align right" className={btn(editor.isActive({ textAlign: "right" }))} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
                  <AlignRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger><TooltipContent>Right</TooltipContent></Tooltip>

              <Tooltip><TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label="Justify" title="Justify" className={btn(editor.isActive({ textAlign: "justify" }))} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
                  <AlignJustify className="h-4 w-4" />
                </Button>
              </TooltipTrigger><TooltipContent>Justify</TooltipContent></Tooltip>

              <Separator orientation="vertical" className="mx-1 h-6" />

              {/* Lists */}
              <Tooltip><TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label="Bulleted list" title="Bulleted list" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                  <List className="h-4 w-4" />
                </Button>
              </TooltipTrigger><TooltipContent>Bulleted List</TooltipContent></Tooltip>

              <Tooltip><TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label="Numbered list" title="Numbered list" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                  <ListOrdered className="h-4 w-4" />
                </Button>
              </TooltipTrigger><TooltipContent>Numbered List</TooltipContent></Tooltip>

              <Separator orientation="vertical" className="mx-1 h-6" />

              {/* Insert */}
              <Tooltip><TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label="Quote block" title="Quote block" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                  <Quote className="h-4 w-4" />
                </Button>
              </TooltipTrigger><TooltipContent>Quote Block</TooltipContent></Tooltip>

              <Tooltip><TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label="Heading 1" title="Heading 1" className={btn(editor.isActive("heading", { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
                  <Heading1 className="h-4 w-4" />
                </Button>
              </TooltipTrigger><TooltipContent>H1</TooltipContent></Tooltip>

              <Tooltip><TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label="Heading 2" title="Heading 2" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                  <Heading2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger><TooltipContent>H2</TooltipContent></Tooltip>

              <Tooltip><TooltipTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label="Heading 3" title="Heading 3" className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                  <Heading3 className="h-4 w-4" />
                </Button>
              </TooltipTrigger><TooltipContent>H3</TooltipContent></Tooltip>
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
