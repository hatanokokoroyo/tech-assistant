import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { UsageInfo } from "@/api/conversations";

interface UsagePanelProps {
  usage: UsageInfo | null;
  onClose: () => void;
}

/**
 * 右侧对话用量面板
 *
 * 展示实时更新的 token / 费用 / 缓存命中等信息，
 * 数据来源为 SSE 流中的 usage_info 事件。
 */
export default function UsagePanel({ usage, onClose }: UsagePanelProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l bg-muted/20">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          对话统计
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={onClose}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-3">
        {usage ? (
          <div className="space-y-4 text-xs">
            {/* 模型信息 */}
            <Section title="模型">
              <StatRow label="模型" value={_displayModel(usage.model)} />
              <StatRow label="API 调用" value={`${usage.api_rounds} 轮`} />
            </Section>

            <Separator />

            {/* 本轮用量 */}
            <Section title="本轮">
              <StatRow
                label="输入 Token"
                value={usage.round_prompt_tokens.toLocaleString()}
              />
              <StatRow
                label="输出 Token"
                value={usage.round_completion_tokens.toLocaleString()}
              />
              <StatRow
                label="总 Token"
                value={usage.round_total_tokens.toLocaleString()}
              />
              {usage.round_cache_hit_tokens != null && (
                <StatRow
                  label="缓存命中"
                  value={`${usage.round_cache_hit_tokens.toLocaleString()} (${_cacheRate(usage.round_cache_hit_tokens, usage.round_prompt_tokens)})`}
                />
              )}
              <StatRow
                label="费用"
                value={`¥${usage.round_cost.toFixed(6)}`}
              />
            </Section>

            <Separator />

            {/* 累计用量 */}
            <Section title="累计">
              <StatRow
                label="输入 Token"
                value={usage.total_prompt_tokens.toLocaleString()}
              />
              <StatRow
                label="输出 Token"
                value={usage.total_completion_tokens.toLocaleString()}
              />
              <StatRow
                label="总 Token"
                value={usage.total_tokens.toLocaleString()}
              />
              {usage.total_cache_hit_tokens > 0 && (
                <StatRow
                  label="缓存命中"
                  value={`${usage.total_cache_hit_tokens.toLocaleString()} (${_cacheRate(usage.total_cache_hit_tokens, usage.total_prompt_tokens)})`}
                />
              )}
              <StatRow
                label="总费用"
                value={`¥${usage.total_cost.toFixed(4)}`}
              />
            </Section>

            <Separator />

            {/* 上下文窗口 */}
            <Section title="上下文">
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all"
                  style={{
                    width: `${Math.min((usage.total_tokens / (usage.context_length || 1_000_000)) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="mt-0.5 text-right text-[10px] text-muted-foreground">
                {usage.total_tokens.toLocaleString()} / {(usage.context_length || 1_000_000).toLocaleString()}
                {" "}({_contextPercent(usage.total_tokens, usage.context_length || 1_000_000)})
              </p>
            </Section>
          </div>
        ) : (
          <EmptyState />
        )}
      </ScrollArea>
    </aside>
  );
}

// ── 子组件 ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular-nums">{value}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-32 items-center justify-center">
      <p className="text-center text-[11px] text-muted-foreground">
        发送消息后<br />用量信息将在此显示
      </p>
    </div>
  );
}

// ── 工具函数 ──

function _cacheRate(hit: number, total: number): string {
  if (total === 0) return "0%";
  return `${((hit / total) * 100).toFixed(1)}%`;
}

function _displayModel(model: string | undefined): string {
  if (!model) return "DeepSeek";
  const map: Record<string, string> = {
    "deepseek-v4-flash": "DeepSeek V4 Flash",
    "deepseek-v4-pro": "DeepSeek V4 Pro",
    "deepseek-chat": "DeepSeek V4 Flash",
    "deepseek-reasoner": "DeepSeek V4 Pro",
  };
  return map[model] || model;
}

function _contextPercent(used: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.min((used / total) * 100, 100).toFixed(1)}%`;
}
