import { X, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { UsageInfo } from "@/api/conversations";

interface UsagePanelProps {
  usage: UsageInfo | null;
  onClose: () => void;
}

export default function UsagePanel({ usage, onClose }: UsagePanelProps) {
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border/70 bg-panel backdrop-blur-sm">
      <div className="border-b border-border/70 px-4 py-3">
        <div className="flex items-center justify-between rounded-[14px] border border-border/70 bg-panel-elevated px-3 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-primary-soft text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
                Usage
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">对话统计</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-[10px]"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 py-4">
        {usage ? (
          <div className="space-y-4 text-xs">
            <Section title="模型">
              <StatRow label="模型" value={_displayModel(usage.model)} />
              <StatRow label="API 调用" value={`${usage.api_rounds} 轮`} />
            </Section>

            <Separator />

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
              <StatRow label="费用" value={`¥${usage.round_cost.toFixed(6)}`} />
            </Section>

            <Separator />

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
              <StatRow label="总费用" value={`¥${usage.total_cost.toFixed(4)}`} />
            </Section>

            <Separator />

            <Section title="上下文">
              <div className="mt-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary/70 transition-all"
                  style={{
                    width: `${Math.min((usage.total_tokens / (usage.context_length || 1_000_000)) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground">
                {usage.total_tokens.toLocaleString()} / {(usage.context_length || 1_000_000).toLocaleString()} ({_contextPercent(usage.total_tokens, usage.context_length || 1_000_000)})
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] border border-border/70 bg-panel-elevated p-4 shadow-sm">
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/85">
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[18px] border border-dashed border-border/80 bg-panel-elevated px-5 py-8 text-center shadow-sm">
      <p className="text-sm font-medium text-foreground">暂无统计数据</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        发送消息后，这里会展示当前轮次与累计的 token、费用和上下文占用情况。
      </p>
    </div>
  );
}

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
