import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, UserPlus, BadgeCheck, KeyRound, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/api/auth";

const registerSchema = z
  .object({
    username: z.string().min(2, "用户名至少 2 个字符").max(32, "用户名最多 32 个字符"),
    alias_name: z.string().max(64, "别名最多 64 个字符").optional(),
    password: z.string().min(6, "密码至少 6 个字符"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

const hints = [
  { icon: UserPlus, text: "创建个人开发工作区" },
  { icon: BadgeCheck, text: "统一管理项目、对话与仓库" },
  { icon: KeyRound, text: "后续可在设置页配置 SSH Key" },
] as const;

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    try {
      await authApi.register({
        username: data.username,
        password: data.password,
        alias_name: data.alias_name || undefined,
      });
      toast.success("注册成功，请登录");
      navigate("/login");
    } catch (err) {
      toast.error((err as Error).message || "注册失败");
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
                New Workspace Access
              </div>
              <div className="mt-8 max-w-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sidebar-foreground/50">
                  Create Account
                </p>
                <h1 className="mt-4 text-4xl font-semibold leading-tight text-white xl:text-5xl">
                  建立你的 AI 开发协作工作区
                </h1>
                <p className="mt-5 max-w-lg text-base leading-7 text-sidebar-foreground/68 xl:text-lg">
                  注册后，你可以创建项目、维护代码仓库、与 AI 持续对话，并在统一工作台内推进日常开发任务。
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {hints.map((hint) => (
                <div
                  key={hint.text}
                  className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white/8 text-primary">
                    <hint.icon className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-sm text-sidebar-foreground/76">{hint.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex w-full items-center justify-center bg-panel-elevated px-6 py-10 lg:max-w-[34rem] lg:px-10 xl:px-12">
          <div className="w-full max-w-md">
            <div className="rounded-[24px] border border-border/80 bg-panel p-8 shadow-md">
              <div className="mb-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-primary-soft text-primary shadow-sm">
                  <UserPlus className="h-5 w-5" />
                </div>
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/80">
                  Create account
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  注册新的工作区账号
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  创建账号后即可进入项目工作台，统一管理文件、仓库和 AI 协作流程。
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
                  <Label htmlFor="alias_name">
                    别名 <span className="text-muted-foreground">(可选)</span>
                  </Label>
                  <Input
                    id="alias_name"
                    placeholder="显示名称"
                    {...register("alias_name")}
                  />
                  {errors.alias_name && (
                    <p className="text-xs text-destructive">
                      {errors.alias_name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="至少 6 个字符"
                    autoComplete="new-password"
                    {...register("password")}
                  />
                  {errors.password && (
                    <p className="text-xs text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">确认密码</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="再次输入密码"
                    autoComplete="new-password"
                    {...register("confirmPassword")}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="mt-2 w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  创建账号
                </Button>
              </form>

              <div className="mt-6 rounded-[16px] border border-border/70 bg-panel-elevated px-4 py-3 text-xs leading-6 text-muted-foreground">
                注册后可以继续在设置页补充个人配置与 SSH Key，随后将仓库与工作流统一接入当前工作区。
              </div>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                已有账号？{" "}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  登录
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
