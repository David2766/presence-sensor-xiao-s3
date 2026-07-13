import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, "..");
const repoDir = resolve(projectDir, "..");
const catalogPath = resolve(projectDir, "src", "web", "i18n", "setup-messages.json");
const outputPath = resolve(repoDir, "components", "radar_api_server", "setup_page_i18n.h");
const dashboardOutputPath = resolve(projectDir, "src", "web", "i18n", "setup-messages.generated.ts");
const setupPagePath = resolve(repoDir, "components", "radar_api_server", "setup_page.cpp");
const checkOnly = process.argv.includes("--check");
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--check");

if (unknownArgs.length) {
  throw new Error(`Unknown option: ${unknownArgs.join(", ")}`);
}

function fail(message) {
  throw new Error(`setup i18n: ${message}`);
}

function placeholderKeys(value) {
  return [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();
}

function validateSectionParity(catalog, sectionName) {
  const english = catalog.en[sectionName];
  const korean = catalog.ko[sectionName];
  if (!english || !korean) fail(`missing ${sectionName} section`);

  const englishKeys = Object.keys(english).sort();
  const koreanKeys = Object.keys(korean).sort();
  if (JSON.stringify(englishKeys) !== JSON.stringify(koreanKeys)) {
    fail(`${sectionName} keys differ between en and ko`);
  }

  for (const key of englishKeys) {
    if (typeof english[key] !== "string" || !english[key].trim()) {
      fail(`en.${sectionName}.${key} must be a non-empty string`);
    }
    if (typeof korean[key] !== "string" || !korean[key].trim()) {
      fail(`ko.${sectionName}.${key} must be a non-empty string`);
    }
    if (JSON.stringify(placeholderKeys(english[key])) !== JSON.stringify(placeholderKeys(korean[key]))) {
      fail(`${sectionName}.${key} placeholders differ between en and ko`);
    }
  }
}

function mergeDeviceMessages(languageCatalog, language) {
  const duplicateKeys = Object.keys(languageCatalog.shared).filter((key) => key in languageCatalog.device);
  if (duplicateKeys.length) fail(`${language} shared/device keys overlap: ${duplicateKeys.join(", ")}`);
  return { ...languageCatalog.shared, ...languageCatalog.device };
}

function validateSetupPage(serializedMessages, messageKeys) {
  const source = readFileSync(setupPagePath, "utf8");
  const marker = /const TEXT=\)HTML"\s+RADAR_SETUP_PAGE_I18N\s+R"HTML\(;/;
  if (!marker.test(source)) fail("setup_page.cpp does not contain the generated i18n marker");

  const reconstructed = source.replace(marker, `const TEXT=${serializedMessages};`);
  const htmlStart = reconstructed.indexOf('R"HTML(');
  const htmlEnd = reconstructed.lastIndexOf(')HTML";');
  if (htmlStart < 0 || htmlEnd < 0 || htmlEnd <= htmlStart) {
    fail("could not reconstruct setup page HTML");
  }
  const html = reconstructed.slice(htmlStart + 'R"HTML('.length, htmlEnd);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!script) fail("setup page script is missing");
  if (/TEXT\.en\s*\[\s*key\s*\]|\?\?\s*key/.test(script)) {
    fail("setup page translation lookup must not hide missing keys with fallbacks");
  }

  const staticHtml = html.slice(0, html.indexOf("<script>"));
  const titleText = staticHtml.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim();
  if (titleText) fail("setup page title must come from the translation catalog");

  for (const match of staticHtml.matchAll(
    /<([a-z][a-z0-9-]*)\b[^>]*\sdata-i18n="([a-zA-Z0-9_]+)"[^>]*>([\s\S]*?)<\/\1>/gi
  )) {
    if (match[3].trim()) fail(`data-i18n element contains fallback text: ${match[2]}`);
  }
  for (const match of staticHtml.matchAll(/<[^>]+\sdata-i18n-placeholder="([a-zA-Z0-9_]+)"[^>]*>/gi)) {
    if (/(?:^|\s)placeholder\s*=/i.test(match[0])) {
      fail(`data-i18n-placeholder element contains a fallback placeholder: ${match[1]}`);
    }
  }
  for (const match of staticHtml.matchAll(
    /<button\b[^>]*\sdata-language="([a-zA-Z0-9_-]+)"[^>]*>([\s\S]*?)<\/button>/gi
  )) {
    if (match[2].trim()) fail(`language option contains fallback text: ${match[1]}`);
  }

  try {
    new Function(script);
  } catch (error) {
    fail(`generated setup page JavaScript is invalid: ${error.message}`);
  }

  const domIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const referencedIds = new Set([...script.matchAll(/\$\('([^']+)'\)/g)].map((match) => match[1]));
  const missingIds = [...referencedIds].filter((id) => !domIds.has(id)).sort();
  if (missingIds.length) fail(`setup page references missing DOM ids: ${missingIds.join(", ")}`);

  const expectedApiPaths = [
    "/api/setup/apply-wifi",
    "/api/setup/connected",
    "/api/setup/finish",
    "/api/setup/networks",
    "/api/setup/ping",
    "/api/setup/prepare",
    "/api/setup/scan",
    "/api/setup/status"
  ];
  const actualApiPaths = [
    ...new Set([...script.matchAll(/fetch\('([^']+)'/g)].map((match) => match[1]))
  ].sort();
  if (JSON.stringify(actualApiPaths) !== JSON.stringify(expectedApiPaths)) {
    fail(`setup API paths changed: ${actualApiPaths.join(", ")}`);
  }
  const expectedPostPaths = [
    "/api/setup/apply-wifi",
    "/api/setup/connected",
    "/api/setup/finish",
    "/api/setup/prepare",
    "/api/setup/scan"
  ];
  const actualPostPaths = [
    ...new Set(
      [...script.matchAll(/fetch\('([^']+)',\{method:'POST'/g)].map((match) => match[1])
    )
  ].sort();
  if (JSON.stringify(actualPostPaths) !== JSON.stringify(expectedPostPaths)) {
    fail(`setup POST paths changed: ${actualPostPaths.join(", ")}`);
  }
  for (const requiredFragment of [
    "fd.set('ssid',pendingSsid)",
    "fd.set('psk',pendingPsk)",
    "'Content-Type':'application/x-www-form-urlencoded'"
  ]) {
    if (!script.includes(requiredFragment)) fail(`setup Wi-Fi request contract changed: ${requiredFragment}`);
  }

  const usedKeys = new Set(
    [...html.matchAll(/data-i18n(?:-placeholder)?="([a-zA-Z0-9_]+)"/g)].map((match) => match[1])
  );
  for (const match of script.matchAll(/\bt\('([a-zA-Z0-9_]+)'/g)) usedKeys.add(match[1]);
  for (const match of script.matchAll(/\bmsg\(([^;\n]*)\)/g)) {
    for (const value of match[1].matchAll(/'([a-zA-Z][a-zA-Z0-9_]*)'/g)) {
      if (value[1] !== "error" && value[1] !== "ok") usedKeys.add(value[1]);
    }
  }
  for (const match of script.matchAll(/\bsetLiveText\(([^;\n]*)\)/g)) {
    const values = [...match[1].matchAll(/'([a-zA-Z][a-zA-Z0-9_]*)'/g)].map((value) => value[1]);
    for (const key of values.slice(1)) usedKeys.add(key);
  }
  for (const helper of ["openModal", "showFailModal"]) {
    const pattern = new RegExp(`(?<!function )\\b${helper}\\(([^;\\n]*)\\)`, "g");
    for (const match of script.matchAll(pattern)) {
      for (const value of match[1].matchAll(/'([a-zA-Z][a-zA-Z0-9_]*)'/g)) usedKeys.add(value[1]);
    }
  }

  const missingKeys = [...usedKeys].filter((key) => !messageKeys.has(key)).sort();
  if (missingKeys.length) fail(`setup page uses missing translation keys: ${missingKeys.join(", ")}`);
  const unusedKeys = [...messageKeys].filter((key) => !usedKeys.has(key)).sort();
  if (unusedKeys.length) fail(`device translation keys are unused: ${unusedKeys.join(", ")}`);
}

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
if (!catalog.en || !catalog.ko) fail("both en and ko catalogs are required");
for (const sectionName of ["shared", "device", "demo"]) {
  validateSectionParity(catalog, sectionName);
}

const deviceMessages = {
  ko: mergeDeviceMessages(catalog.ko, "ko"),
  en: mergeDeviceMessages(catalog.en, "en")
};
const dashboardMessages = {
  en: { shared: catalog.en.shared, demo: catalog.en.demo },
  ko: { shared: catalog.ko.shared, demo: catalog.ko.demo }
};
const serializedMessages = JSON.stringify(deviceMessages);
if (serializedMessages.includes(")SETUP_I18N\"")) {
  fail("generated content conflicts with the C++ raw string delimiter");
}
validateSetupPage(serializedMessages, new Set(Object.keys(deviceMessages.en)));

const generated = `// This file is generated by dashboard/scripts/generate-setup-page-i18n.mjs.
// Do not edit manually. Edit dashboard/src/web/i18n/setup-messages.json instead.
#pragma once

#define RADAR_SETUP_PAGE_I18N R"SETUP_I18N(${serializedMessages})SETUP_I18N"
`;
const generatedDashboardMessages = `// This file is generated by dashboard/scripts/generate-setup-page-i18n.mjs.
// Do not edit manually. Edit setup-messages.json instead.

export const dashboardSetupCatalog = ${JSON.stringify(dashboardMessages, null, 2)} as const;
`;

function checkGeneratedFile(path, expected, label) {
  let current = "";
  try {
    current = readFileSync(path, "utf8");
  } catch {
    fail(`${label} is missing; run npm run generate:setup-i18n`);
  }
  if (current !== expected) {
    fail(`${label} is stale; run npm run generate:setup-i18n`);
  }
}

if (checkOnly) {
  checkGeneratedFile(outputPath, generated, "generated header");
  checkGeneratedFile(dashboardOutputPath, generatedDashboardMessages, "generated dashboard messages");
  console.log("setup i18n: generated files are current");
} else {
  writeFileSync(outputPath, generated, "utf8");
  writeFileSync(dashboardOutputPath, generatedDashboardMessages, "utf8");
  console.log(`setup i18n: wrote ${outputPath}`);
  console.log(`setup i18n: wrote ${dashboardOutputPath}`);
}
