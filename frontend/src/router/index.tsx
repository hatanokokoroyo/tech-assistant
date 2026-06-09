import {
  createBrowserRouter,
  Navigate,
  Outlet,
} from "react-router";
import { useAuthStore } from "@/stores/auth-store";
import LoginPage from "@/pages/login/login-page";
import RegisterPage from "@/pages/register/register-page";
import AppLayout from "@/pages/app/layout";
import ProjectList from "@/pages/app/project-list";
import FilePanel from "@/pages/app/file-panel";
import FileEditor from "@/pages/app/file-editor";
import ChatPanel from "@/pages/app/chat-panel";
import ChatView from "@/pages/app/chat-view";
import RepoPanel from "@/pages/app/repo-panel";

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
          { path: "projects", element: <ProjectList /> },
          {
            path: "projects/:projectId",
            children: [
              { index: true, element: null },
              { path: "files", element: <FilePanel /> },
              { path: "files/*", element: <FileEditor /> },
              { path: "chat", element: <ChatPanel /> },
              { path: "chat/:conversationId", element: <ChatView /> },
              { path: "repos", element: <RepoPanel /> },
            ],
          },
        ],
      },
    ],
  },
]);
