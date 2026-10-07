import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { catalogKeys, checkTree, findUntranslated } from "./check-i18n.mjs";

const rules = (src, file = "x.tsx", keys) => findUntranslated(src, file, keys).map((p) => p.rule);

describe("check-i18n — what fails the build", () => {
  it("R1: JSX text with a letter", () => {
    expect(rules(`const A = () => <h1>Calculation History</h1>;`)).toEqual(["R1"]);
    expect(rules(`const A = () => <h1>Hola</h1>;`)).toEqual(["R1"]);
  });

  it("R2: a text attribute given a literal", () => {
    expect(rules(`const A = () => <input placeholder="Enter city..." />;`)).toEqual(["R2"]);
    expect(rules(`const A = () => <button aria-label={"Send"} />;`)).toEqual(["R2"]);
  });

  it("R3: a literal rendered as a JSX child, including inside a ternary", () => {
    expect(rules(`const A = ({ ok }) => <p>{ok ? "saved per year" : n}</p>;`)).toEqual(["R3"]);
    expect(rules(`const A = () => <p>{"Pending"}</p>;`)).toEqual(["R3"]);
  });

  it("R4: a text property given a literal", () => {
    expect(rules(`toast({ title: "Error", description: msg });`, "x.ts")).toEqual(["R4"]);
  });

  it("R5: multi-word prose anywhere else", () => {
    expect(rules("function f(n) { return `not within ${n} years`; }", "x.ts")).toEqual(["R5"]);
  });

  it("R6: a UserMessage built from a literal", () => {
    expect(rules(`throw new UserMessage("Failed");`, "x.ts")).toEqual(["R6"]);
  });
});

describe("check-i18n — what is not text", () => {
  it("passes text that goes through t()", () => {
    expect(rules(`const A = () => <h1>{t("history.title")}</h1>;`)).toEqual([]);
    expect(rules(`const A = () => <input placeholder={t("chat.placeholder")} />;`)).toEqual([]);
  });

  it("passes digits and punctuation", () => {
    expect(rules(`const A = () => <p>≈ {n} — {m}</p>;`)).toEqual([]);
  });

  it("passes class names, inline styles, enum comparisons, directives and developer errors", () => {
    expect(rules(`const A = () => <div className="flex items-center gap-2" />;`)).toEqual([]);
    expect(rules(`const c = cn("text-sm font-medium", x);`, "x.ts")).toEqual([]);
    expect(rules(`const A = () => <T contentStyle={{ boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />;`)).toEqual([]);
    expect(rules(`const A = ({ s }) => <p>{s === "used" && x}</p>;`)).toEqual([]);
    expect(rules(`"use client"\nexport const x = 1;`, "x.ts")).toEqual([]);
    expect(rules(`throw new Error("nasa-live carries no irradiancePeriod");`, "x.ts")).toEqual([]);
    expect(rules(`console.error("[optimize] response failed validation:", e);`, "x.ts")).toEqual([]);
  });

  it("passes a literal that is a catalog key", () => {
    expect(rules(`const NAV = [{ label: "nav.history" }];`, "x.ts", new Set(["nav.history"]))).toEqual([]);
    expect(rules(`const NAV = [{ label: "nav.history" }];`, "x.ts", new Set())).toEqual(["R4"]);
  });
});

describe("check-i18n — the real tree", () => {
  const src = join(fileURLToPath(new URL("..", import.meta.url)), "src");

  it("reads the catalog's Spanish keys", () => {
    const keys = catalogKeys(`defineCatalog({ "a.b": "x", c: "y" }, { "a.b": "x", c: "y" })`);
    expect([...keys]).toEqual(["a.b", "c"]);
  });

  it("src/ is clean", () => {
    expect(checkTree(src)).toEqual([]);
  });
});
