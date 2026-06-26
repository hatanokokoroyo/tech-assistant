import { useState } from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Sparkles, ShieldCheck, GitBranch, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { authApi } from "@/api/auth";

const loginSchema = z.object({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
});

type LoginForm = z.infer<typeof loginSchema>;

const highlights = [
  {
    icon: GitBranch,
    title: "仓库与分支视图",
    description: "统一管理代码仓库、远程分支与项目来源。",
  },
  {
    icon: MessageSquare,
    title: "AI 协作工作台",
    description: "围绕任务连续对话、审批工具调用并查看用量。",
  },
  {
    icon: ShieldCheck,
    title: "受控执行环境",
    description: "在受控权限与审计上下文中完成开发辅助操作。",
  },
] as const;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const res = await authApi.login(data);
      setToken(res.token);
      setUser(res.user);
      toast.success("登录成功");
    } catch (err) {
      toast.error((err as Error).message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl overflow-hidden rounded-[28px] border border-border/80 bg-panel shadow-lg">
        <section className="relative hidden flex-1 overflow-hidden border-r border-border/70 bg-sidebar text-sidebar-foreground lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.07),transparent_22%)]" />
          <div className="relative flex w-full flex-col justify-between p-10 xl:p-12">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-sidebar-foreground/88 backdrop-blur-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                Developer Workspace
              </div>
              <div className="mt-8 max-w-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sidebar-foreground/50">
                  Tech Assistant
                </p>
                <h1 className="mt-4 text-4xl font-semibold leading-tight text-white xl:text-5xl">
                  为 AI 协作开发而设计的现代工作台
                </h1>
                <p className="mt-5 max-w-lg text-base leading-7 text-sidebar-foreground/68 xl:text-lg">
                  在统一的文件、对话与仓库面板中组织你的开发任务，让 AI 在更清晰、更可控的上下文里协助你推进工作。
                </p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {highlights.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[20px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/8 text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-sm font-semibold text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-sidebar-foreground/62">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex w-full items-center justify-center bg-panel-elevated px-6 py-10 lg:max-w-[32rem] lg:px-10 xl:px-12">
          <div className="w-full max-w-md">
            <div className="rounded-[24px] border border-border/80 bg-panel p-8 shadow-md">
              <div className="mb-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-primary-soft text-primary shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/80">
                  Sign in
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  登录 Tech Assistant
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  进入你的开发工作区，继续处理文件、对话与仓库任务。
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username">用户名</Label>
                  <Input
                    id="username"
                    placeholder="请输入用户名"
                    autoComplete="username"
                    {...register("username")}
                  />
                  {errors.username && (
                    <p className="text-xs text-destructive">
                      {errors.username.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    {...register("password")}
                  />
                  {errors.password && (
                    <p className="text-xs text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="mt-2 w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  登录并进入工作台
                </Button>
              </form>

              <div className="mt-6 rounded-[16px] border border-border/70 bg-panel-elevated px-4 py-3 text-xs leading-6 text-muted-foreground">
                登录后可直接进入项目工作区，使用统一的三栏布局浏览文件、管理仓库并与 AI 保持连续协作。
              </div>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                还没有账号？{" "}
                <Link to="/register" className="font-medium text-primary hover:underline">
                  注册
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
