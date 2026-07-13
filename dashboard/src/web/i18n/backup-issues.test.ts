import { describe, expect, it } from "vitest";

import type { BackupIssue } from "../../core/config-backup";
import { backupIssueMessage } from "./backup-issues";
import { en } from "./en";
import { ko } from "./ko";

describe("backupIssueMessage", () => {
  it("uses translated backup issue messages when code is available", () => {
    const issue: BackupIssue = {
      path: "config.zones",
      line: 12,
      message: "legacy fallback",
      detail: "legacy detail",
      code: "backup_config_zones_too_many",
      params: { max: 6, actual: 9 }
    };

    expect(backupIssueMessage(en, issue)).toBe("line 12 · config.zones: Software zones can import up to 6 items. This file has 9.");
    expect(backupIssueMessage(ko, issue)).toBe("12번째 줄 · config.zones: software zone은 최대 6개까지만 가져올 수 있습니다. 현재 파일에는 9개가 들어 있습니다.");
  });

  it("falls back to the legacy message when code is unknown", () => {
    const issue: BackupIssue = {
      path: "config.zones[0].points",
      line: 18,
      message: "points 값은 배열이어야 합니다.",
      code: "unknown_backup_issue"
    };

    expect(backupIssueMessage(en, issue)).toBe("line 18 · config.zones[0].points: points 값은 배열이어야 합니다.");
  });

  it("falls back to the legacy detail when no code is provided", () => {
    const issue: BackupIssue = {
      path: "checksum",
      message: "체크섬이 일치하지 않습니다.",
      detail: "백업 파일이 수동으로 수정되었을 수 있습니다."
    };

    expect(backupIssueMessage(en, issue)).toBe("checksum: 체크섬이 일치하지 않습니다. 백업 파일이 수동으로 수정되었을 수 있습니다.");
  });
});
