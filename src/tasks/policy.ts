import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type { TaskMode } from "./types.js";

const SENSITIVE_READ_PATTERNS: Array<[RegExp, string]> = [
  [/(?:^|\s|[/\\])\.env(?:$|\s|[/\\])|密钥|密码|secret|token/i, "凭证、密钥或 .env 操作"],
];

const WRITE_RISK_PATTERNS: Array<[RegExp, string]> = [
  [/\b(delete|remove|rm|reset|restore|rebase|push|tag|release)\b|删除|移除|回滚|推送|发布/, "删除或高风险 Git／发布操作"],
  [/database|schema|migration|数据库|数据迁移/i, "数据库结构或迁移操作"],
  [/global dependency|global package|system config|全局依赖|系统配置/i, "全局依赖或系统配置操作"],
  [/cloudflare|部署|deploy|publish/i, "Cloudflare、部署或公开发布操作"],
];

export interface ResolvedProject {
  name: string;
  path: string;
}

export async function resolveProject(
  workspacePath: string,
  projectInput: string,
): Promise<ResolvedProject> {
  if (!projectInput || isAbsolute(projectInput)) throw new Error("项目必须使用工作区内的相对路径");
  const workspace = await realpath(workspacePath);
  const candidate = resolve(workspace, projectInput);
  const relativePath = relative(workspace, candidate);
  if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
    throw new Error("项目路径越出工作区边界");
  }
  const actual = await realpath(candidate).catch(() => undefined);
  const actualRelative = actual ? relative(workspace, actual) : undefined;
  if (
    !actual ||
    actualRelative === ".." ||
    actualRelative?.startsWith(`..${sep}`)
  ) {
    throw new Error("项目不存在或指向工作区外部");
  }
  if (!(await stat(actual)).isDirectory()) throw new Error("目标项目不是目录");
  return { name: relativePath, path: actual };
}

export function confirmationReason(
  project: string,
  currentProject: string,
  mode: TaskMode,
  instruction: string,
): string | undefined {
  if (mode === "write" && project !== currentProject) return "跨项目写入";
  for (const [pattern, reason] of SENSITIVE_READ_PATTERNS) {
    if (pattern.test(instruction)) return reason;
  }
  if (mode === "write") {
    for (const [pattern, reason] of WRITE_RISK_PATTERNS) {
      if (pattern.test(instruction)) return reason;
    }
  }
  return undefined;
}
