import {
  createBrowserRouter,
  Navigate,
  Outlet,
} from "react-router";
import { useAuthStore } from "@/stores/auth-store";
import LoginPage from "@/pages/login/login-page";
import RegisterPage from "@/pages/register/register-page";
import AppLayout from "@/pages/app/layout";
import FilePanel from "@/pages/app/file-panel";
import ChatPanel from "@/pages/app/chat-panel";
import RepoPanel from "@/pages/app/repo-panel";
import SettingsPage from "@/pages/settings/settings-page";

function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function PublicRoute() {
  const token = useAuthStore((s) => s.token);
  if (token) return <Navigate to="/" replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/projects" replace /> },
          { path: "projects", element: null },
          { path: "settings", element: <SettingsPage /> },
          {
            path: "projects/:projectId",
            children: [
              { index: true, element: <Navigate to="files" replace /> },
              { path: "files", element: <FilePanel /> },
              { path: "files/*", element: <FilePanel /> },
              { path: "chat", element: <ChatPanel /> },
              { path: "chat/:conversationId", element: <ChatPanel /> },
              { path: "repos", element: <RepoPanel /> },
            ],
          },
        ],
      },
    ],
  },
]);
