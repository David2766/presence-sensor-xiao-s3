import { describe, expect, it } from "vitest";
import setupCatalogJson from "./setup-messages.json";
import { createSetupMessages } from "./setup-messages";
import type { LanguageCode } from "./types";

const languages: LanguageCode[] = ["en", "ko"];
const sections = ["shared", "device", "demo"] as const;
const setupCatalog = setupCatalogJson as Record<
  LanguageCode,
  Record<(typeof sections)[number], Record<string, string>>
>;

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();
}

describe("shared setup translations", () => {
  it("keeps section keys and placeholders aligned between languages", () => {
    for (const section of sections) {
      const english = setupCatalog.en[section];
      const korean = setupCatalog.ko[section];
      expect(Object.keys(korean).sort(), section).toEqual(Object.keys(english).sort());

      for (const key of Object.keys(english)) {
        expect(korean[key].trim(), `ko.${section}.${key}`).not.toBe("");
        expect(english[key].trim(), `en.${section}.${key}`).not.toBe("");
        expect(placeholders(korean[key]), `${section}.${key}`).toEqual(placeholders(english[key]));
      }
    }
  });

  it("builds dashboard setup messages from the shared catalog", () => {
    for (const language of languages) {
      const messages = createSetupMessages(language);
      const { shared, demo } = setupCatalog[language];

      expect(messages.title).toBe(demo.title);
      expect(messages.connect).toBe(shared.connect);
      expect(messages.wifiPassword).toBe(shared.password);
      expect(messages.openWifiUnsupportedMessage).toBe(shared.openWifiUnsupportedMessage);
      expect(messages.demoDescription).toBe(demo.demoDescription);
      expect(messages.apiKeyWarning).toBe(shared.apiKeyContinueWithKey);
    }
  });

  it("formats parameterized setup messages without leaking placeholders", () => {
    for (const language of languages) {
      const messages = createSetupMessages(language);
      expect(messages.showMore(7)).toContain("7");
      expect(messages.showMore(7)).not.toMatch(/\{count\}/);
      expect(messages.finishingCountdown(3)).toContain("3");
      expect(messages.finishingCountdown(3)).not.toMatch(/\{seconds\}/);
    }
  });

  it("keeps device-only and demo-only keys out of the shared section", () => {
    for (const language of languages) {
      const { shared, device, demo } = setupCatalog[language];
      expect(Object.keys(device).filter((key) => key in shared)).toEqual([]);
      expect(Object.keys(demo).filter((key) => key in shared)).toEqual([]);
    }
  });

  it("reuses the shared Wi-Fi password message instead of duplicating a placeholder key", () => {
    for (const language of languages) {
      expect(setupCatalog[language].device).not.toHaveProperty("passwordPlaceholder");
      expect(createSetupMessages(language).wifiPassword).toBe(setupCatalog[language].shared.password);
    }
  });
});
