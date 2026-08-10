import { execFileSync } from "node:child_process";
import { normalizeGithubUsername } from "../src/plugins/github-follow-link.ts";

export function resolveCurrentGithubUsername(): string | null {
  const remotes = runGit(["remote"])
    ?.split(/\r?\n/gu)
    .map((remote) => remote.trim())
    .filter((remote) => remote.length > 0) ?? [];

  for (const remote of remotes) {
    const remoteUrl = runGit(["remote", "get-url", remote]);
    const match = remoteUrl === null
      ? null
      : /github\.com[/:]([^/\s]+)\/[^/\s]+(?:\.git)?$/iu.exec(remoteUrl);
    const username = match?.[1];
    if (username !== undefined) {
      return normalizeGithubUsername(username);
    }
  }

  return null;
}

export function resolveCurrentGitEmail(): string | null {
  const email = runGit(["config", "--get", "user.email"]);
  return email === null || email.length === 0 ? null : email;
}

function runGit(arguments_: string[]): string | null {
  try {
    return execFileSync("git", arguments_, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return null;
  }
}
