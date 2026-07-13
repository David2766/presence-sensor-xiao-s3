import { render } from "svelte/server";
import { describe, expect, it } from "vitest";
import { messages, type LanguageCode } from "../i18n";
import SetupMockPanel from "./SetupMockPanel.svelte";

const languages: LanguageCode[] = ["en", "ko"];

describe("SetupMockPanel", () => {
  it.each(languages)("renders %s setup copy from the shared catalog", (language) => {
    const catalog = messages[language];
    const { body } = render(SetupMockPanel, {
      props: {
        messages: catalog,
        language,
        onLanguageChange: () => {}
      }
    });

    expect(body).toContain(catalog.setup.title);
    expect(body).toContain(catalog.setup.initialWifiSetup);
    expect(body).toContain(catalog.setup.wifiListLoaded);
    expect(body).toContain(catalog.language.name);
    expect(body).not.toContain("Presence Sensor Demo");
  });

  it("renders the language control as a collapsed menu button", () => {
    const { body } = render(SetupMockPanel, {
      props: {
        messages: messages.en,
        language: "en",
        onLanguageChange: () => {}
      }
    });

    expect(body).toMatch(/class="language-menu-button(?:\s[^"]*)?"/);
    expect(body).toContain('aria-haspopup="menu"');
    expect(body).toContain('aria-expanded="false"');
  });
});
