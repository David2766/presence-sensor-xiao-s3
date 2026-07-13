import { backupValidationMessage, type BackupIssue } from "../../core/config-backup";
import type { Messages } from "./types";

export function backupIssueMessage(messages: Messages, issue: BackupIssue): string {
  const translated = issue.code ? messages.backup.issueMessages[issue.code]?.(issue.params ?? {}) : "";
  if (!translated) return backupValidationMessage(issue);

  const line = issue.line ? messages.backup.issueLine(issue.line) : "";
  return `${line}${issue.path}: ${translated}`;
}
