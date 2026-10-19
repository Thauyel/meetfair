import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { routing } from "../i18n/routing";

type Tree = { [k: string]: string | Tree };
const load = (l: string): Tree => JSON.parse(readFileSync(`messages/${l}.json`, "utf8"));

function flatten(t: Tree, prefix = ""): Record<string, string> {
  return Object.entries(t).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? { ...acc, [key]: v } : { ...acc, ...flatten(v, key) };
  }, {});
}

// Top-level ICU arguments like {name}; plural branches ({count, plural, ...}) count as "count".
const args = (s: string) => [...s.matchAll(/\{(\w+)(?=[,}])/g)].map((m) => m[1]).filter((a, i, all) => all.indexOf(a) === i).sort();

const en = flatten(load("en"));

describe.each(routing.locales.filter((l) => l !== "en"))("messages/%s.json", (locale) => {
  const msgs = flatten(load(locale));
  it("has exactly the English keys", () => {
    expect(Object.keys(msgs).sort()).toEqual(Object.keys(en).sort());
  });
  it("keeps every placeholder", () => {
    for (const [key, value] of Object.entries(en)) expect(args(msgs[key] ?? ""), key).toEqual(args(value));
  });
});
