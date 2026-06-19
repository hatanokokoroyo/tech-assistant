import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface MarkdownContentProps {
  content: string;
}

/**
 * Markdown 渲染组件
 *
 * 为表格和代码块添加横向滚动容器，防止内容溢出对话气泡。
 */
export default function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none overflow-x-hidden">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={MARKDOWN_COMPONENTS}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ── 自定义组件 ──

const MARKDOWN_COMPONENTS: Partial<Components> = {
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2">
      <table className="prose-table">{children}</table>
    </div>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto whitespace-pre">
      {children}
    </pre>
  ),
  code: ({ children, ...props }) => {
    // 内联代码：允许换行断词，防止长单词溢出气泡
    if (!props.className) {
      return (
        <code className="break-all" {...props}>
          {children}
        </code>
      );
    }
    return <code {...props}>{children}</code>;
  },
};
