export const queryKeys = {
  projects: ["projects"] as const,
  project: (id: number) => ["projects", id] as const,
  files: (projectId: number) => ["projects", projectId, "files"] as const,
  file: (projectId: number, path: string) =>
    ["projects", projectId, "files", path] as const,
  conversations: (projectId: number) =>
    ["projects", projectId, "conversations"] as const,
  conversation: (id: number) => ["conversations", id] as const,
  messages: (id: number) => ["conversations", id, "messages"] as const,
  repos: (projectId: number) => ["projects", projectId, "repos"] as const,
  branches: (projectId: number, repoId: number) =>
    ["projects", projectId, "repos", repoId, "branches"] as const,
  sshKeys: ["ssh-keys"] as const,
};
