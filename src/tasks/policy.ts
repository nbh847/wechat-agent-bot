import { realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type { TaskMode, TaskProposal } from "./types.js";

const SENSITIVE_READ_PATTERNS: Array<[RegExp, string]> = [
  [/(?:^|\s|[/\\])(?:\.env|\.ssh|\.gnupg)(?:$|\s|[/\\])|凭证|密钥|私钥|密码|credential|secret|token/i, "凭证、密钥或 .env 操作"],
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
  readPaths?: string[];
}

export interface ValidatedTaskProposal {
  project: ResolvedProject;
  mode: TaskMode;
  instruction: string;
  sensitiveAccess: boolean;
  readPaths: string[];
  writePaths: string[];
}

export async function resolveLocalReadPath(
  pathInput: string,
  homePath = homedir(),
): Promise<ResolvedProject> {
  const home = await realpath(homePath);
  const normalized = pathInput.replace(/^～/, "~");
  const candidate = normalized === "~"
    ? home
    : normalized.startsWith("~/")
      ? resolve(home, normalized.slice(2))
      : normalized;
  if (!isAbsolute(candidate)) throw new Error("本机读取路径必须使用 ~/... 或绝对路径");
  const actual = await realpath(candidate).catch(() => undefined);
  if (!actual) throw new Error("本机读取路径不存在");
  const relativePath = relative(home, actual);
  if (!relativePath) throw new Error("不能把整个用户主目录作为读取范围，请指定具体子目录");
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
    throw new Error("本机读取路径必须位于当前用户主目录内");
  }
  return {
    name: relativePath ? `~/${relativePath}` : "~",
    path: actual,
  };
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

/**
 * Validate an Agent-produced plan without trying to understand the user's
 * natural-language request in the Bot.  Paths are resolved again here so a
 * plan cannot smuggle a symlink or an arbitrary write destination through the
 * process protocol.
 */
export async function validateTaskProposal(
  proposal: TaskProposal,
  workspacePath: string,
  homePath = homedir(),
): Promise<ValidatedTaskProposal> {
  if (!proposal || !isTaskMode(proposal.mode)) throw new Error("Agent 计划缺少有效的读写模式");
  if (!proposal.action?.trim() || proposal.action.length > 4_000) {
    throw new Error("Agent 计划缺少有效的具体动作");
  }
  if (
    !proposal.target?.path
    || typeof proposal.sensitiveAccess !== "boolean"
    || !Array.isArray(proposal.readPaths)
    || !Array.isArray(proposal.writePaths)
  ) {
    throw new Error("Agent 计划缺少有效的目标或权限范围");
  }

  const workspace = await realpath(workspacePath);
  const home = await realpath(homePath);
  const target = await resolveExistingDirectory(proposal.target.path, workspace, home);
  const project = describeTarget(target, workspace, home);
  if (!project) throw new Error("Agent 计划的目标必须位于工作区或当前用户主目录内");
  if (!project.name || project.name === "~") {
    throw new Error("Agent 计划不能把工作区或用户主目录作为项目目标");
  }

  const readPaths = await resolvePlanPaths(proposal.readPaths, workspace, home);
  if (!readPaths.includes(target)) readPaths.push(target);
  const writePaths = await resolvePlanPaths(proposal.writePaths, workspace, home);

  if (proposal.mode === "read" && writePaths.length > 0) {
    throw new Error("只读 Agent 计划不能包含写入范围");
  }
  if (proposal.mode === "write") {
    if (!isWithin(workspace, target)) throw new Error("工作区之外的 Agent 写入计划不被允许");
    if (writePaths.length !== 1 || writePaths[0] !== target) {
      throw new Error("写入 Agent 计划必须把写入范围严格绑定到目标项目");
    }
  }

  return {
    project,
    mode: proposal.mode,
    instruction: proposal.action.trim(),
    sensitiveAccess: proposal.sensitiveAccess,
    readPaths,
    writePaths,
  };
}

export function proposalConfirmationReason(
  project: string,
  currentProject: string,
  proposal: Pick<ValidatedTaskProposal, "mode" | "instruction" | "sensitiveAccess" | "readPaths">,
): string | undefined {
  if (proposal.mode === "write" && project !== currentProject) return "跨项目写入";
  const pathSummary = [project, ...proposal.readPaths].join(" ");
  if (proposal.sensitiveAccess || SENSITIVE_READ_PATTERNS.some(([pattern]) => pattern.test(pathSummary))) {
    return "凭证、密钥或 .env 操作";
  }
  if (proposal.mode === "write") {
    for (const [pattern, reason] of WRITE_RISK_PATTERNS) {
      if (pattern.test(proposal.instruction)) return reason;
    }
  }
  return undefined;
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

function isTaskMode(value: unknown): value is TaskMode {
  return value === "read" || value === "write";
}

async function resolveExistingDirectory(pathInput: string, workspace: string, home: string): Promise<string> {
  if (!isAbsolute(pathInput)) throw new Error("Agent 计划路径必须是绝对路径");
  const actual = await realpath(pathInput).catch(() => undefined);
  if (!actual || !(await stat(actual)).isDirectory()) {
    throw new Error("Agent 计划目标不存在或不是目录");
  }
  if (!isWithin(workspace, actual) && !isWithin(home, actual)) {
    throw new Error("Agent 计划路径越出允许范围");
  }
  return actual;
}

async function resolvePlanPaths(paths: string[], workspace: string, home: string): Promise<string[]> {
  if (paths.length > 10) throw new Error("Agent 计划读取范围过大");
  const resolved: string[] = [];
  for (const pathInput of paths) {
    if (typeof pathInput !== "string" || !isAbsolute(pathInput)) {
      throw new Error("Agent 计划权限范围必须使用绝对路径");
    }
    const actual = await realpath(pathInput).catch(() => undefined);
    if (!actual) throw new Error("Agent 计划权限范围包含不存在的路径");
    if (!isWithin(workspace, actual) && !isWithin(home, actual)) {
      throw new Error("Agent 计划权限范围越出允许范围");
    }
    if (actual === workspace || actual === home) {
      throw new Error("Agent 计划不能把整个工作区或用户主目录作为读取范围");
    }
    if (!resolved.includes(actual)) resolved.push(actual);
  }
  return resolved;
}

function describeTarget(path: string, workspace: string, home: string): ResolvedProject | undefined {
  if (isWithin(workspace, path)) {
    const relativePath = relative(workspace, path);
    return { name: relativePath, path };
  }
  if (isWithin(home, path)) {
    const relativePath = relative(home, path);
    return { name: `~/${relativePath}`, path };
  }
  return undefined;
}

function isWithin(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  return relativePath === "" || (relativePath !== ".." && !relativePath.startsWith(`..${sep}`));
}
