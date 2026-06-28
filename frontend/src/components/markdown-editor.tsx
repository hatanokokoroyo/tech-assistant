import { useCallback, useMemo, useRef, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView } from "@codemirror/view";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// ── CodeMirror 主题（与 shadcn/ui 颜色对齐） ──

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.75",
  },
  ".cm-content": {
    padding: "16px 0",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRight: "1px solid var(--color-border)",
    color: "var(--color-muted-foreground)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
  ".cm-activeLine": {
    backgroundColor: "oklch(0.965 0.004 255 / 0.5)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "oklch(0.56 0.18 251 / 0.15) !important",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--color-primary)",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "oklch(0.56 0.18 251 / 0.2) !important",
  },
});

// ── 主组件 ──

export default function MarkdownEditor({
  value,
  onChange,
  className,
}: MarkdownEditorProps) {
  const cmContainerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollingFrom = useRef<"editor" | "preview" | null>(null);

  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
      baseTheme,
    ],
    [],
  );

  const handleChange = useCallback(
    (val: string) => {
      onChange(val);
    },
    [onChange],
  );

  // ── 同步滚动：编辑器 ↔ 预览 ──
  useEffect(() => {
    const cmContainer = cmContainerRef.current;
    const preview = previewRef.current;
    if (!cmContainer || !preview) return;

    // CodeMirror 渲染 .cm-scroller 需要时间，用 polling 等待
    let scroller: HTMLElement | null = null;
    let attempts = 0;

    const tryAttach = () => {
      scroller = cmContainer.querySelector(".cm-scroller");
      if (!scroller && attempts < 10) {
        attempts++;
        requestAnimationFrame(tryAttach);
        return;
      }
      if (!scroller) return;

      const handleEditorScroll = () => {
        if (scrollingFrom.current === "preview") return;
        scrollingFrom.current = "editor";

        const editorMax = scroller!.scrollHeight - scroller!.clientHeight;
        const previewMax = preview.scrollHeight - preview.clientHeight;
        if (editorMax > 0 && previewMax > 0) {
          const ratio = scroller!.scrollTop / editorMax;
          preview.scrollTop = ratio * previewMax;
        }

        requestAnimationFrame(() => {
          scrollingFrom.current = null;
        });
      };

      scroller.addEventListener("scroll", handleEditorScroll, {
        passive: true,
      });
      cleanupRef.current = () =>
        scroller!.removeEventListener("scroll", handleEditorScroll);
    };

    const cleanupRef = { current: null as (() => void) | null };

    const handlePreviewScroll = () => {
      if (scrollingFrom.current === "editor") return;
      scrollingFrom.current = "preview";

      if (!scroller) return;

      const editorMax = scroller.scrollHeight - scroller.clientHeight;
      const previewMax = preview.scrollHeight - preview.clientHeight;
      if (editorMax > 0 && previewMax > 0) {
        const ratio = preview.scrollTop / previewMax;
        scroller.scrollTop = ratio * editorMax;
      }

      requestAnimationFrame(() => {
        scrollingFrom.current = null;
      });
    };

    preview.addEventListener("scroll", handlePreviewScroll, { passive: true });

    // 启动 polling 等待 cm-scroller 出现
    tryAttach();

    return () => {
      cleanupRef.current?.();
      preview.removeEventListener("scroll", handlePreviewScroll);
    };
  }, []);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 divide-x divide-border/70",
        className,
      )}
    >
      {/* 左侧：CodeMirror 编辑器 */}
      <div
        ref={cmContainerRef}
        className="flex flex-1 flex-col overflow-hidden bg-panel-elevated"
      >
        <div className="border-b border-border/70 px-4 py-2 text-xs font-medium text-muted-foreground">
          编辑
        </div>
        <div className="min-h-0 flex-1">
          <CodeMirror
            value={value}
            onChange={handleChange}
            extensions={extensions}
            theme="light"
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightActiveLine: true,
              foldGutter: true,
              dropCursor: true,
              allowMultipleSelections: true,
              indentOnInput: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
              rectangularSelection: true,
              crosshairCursor: false,
              highlightSelectionMatches: true,
              closeBracketsKeymap: true,
              searchKeymap: true,
              foldKeymap: true,
              completionKeymap: true,
              lintKeymap: true,
            }}
            className="h-full"
          />
        </div>
      </div>

      {/* 右侧：Markdown 预览 */}
      <div className="flex flex-1 flex-col overflow-hidden bg-panel">
        <div className="border-b border-border/70 px-4 py-2 text-xs font-medium text-muted-foreground">
          预览
        </div>
        <div ref={previewRef} className="min-h-0 flex-1 overflow-auto">
          <div className="prose prose-sm dark:prose-invert max-w-none px-5 py-4">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {value}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
