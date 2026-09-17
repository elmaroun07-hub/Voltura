import { describe, expect, it, beforeEach } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseRegistry,
  loadRegistry,
  getEntry,
  requireCurrentEntry,
  _resetRegistryCacheForTests,
} from "./registry";

const MINIMAL_CURRENT = `
entries:
  - id: test-current
    value: 258
    unit: gCO2eq/kWh
    basis: supply_residual
    authority: Test Authority
    document_id: Test Doc
    edition_date: "2026-04-28"
    activity_year: 2025
    next_edition_expected: null
    path: null
    status: current
    supersedes: null
    verified_on: "2026-09-15"
    notes: null
`;

describe("parseRegistry — shape validation", () => {
  it("parses a well-formed entry", () => {
    const entries = parseRegistry(MINIMAL_CURRENT);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: "test-current", value: 258, status: "current" });
  });

  it("rejects a document with no top-level entries array", () => {
    expect(() => parseRegistry("not_entries: []")).toThrow(/entries/);
  });

  it("rejects an entry missing an id", () => {
    const bad = `entries:\n  - status: current\n    value: 1\n`;
    expect(() => parseRegistry(bad)).toThrow(/id/);
  });

  it("rejects an entry with an invalid status", () => {
    const bad = `entries:\n  - id: x\n    status: maybe\n`;
    expect(() => parseRegistry(bad)).toThrow(/status/);
  });

  it("rejects duplicate ids", () => {
    const bad = `
entries:
  - id: dup
    status: pending
  - id: dup
    status: pending
`;
    expect(() => parseRegistry(bad)).toThrow(/duplicate/i);
  });

  it("rejects a supersedes pointing at an id that does not exist", () => {
    const bad = `
entries:
  - id: newer
    status: current
    value: 1
    supersedes: nonexistent
`;
    expect(() => parseRegistry(bad)).toThrow(/supersedes/);
  });

  it("rejects a non-string, non-null value where a string is required", () => {
    const bad = `entries:\n  - id: x\n    status: pending\n    authority: 42\n`;
    expect(() => parseRegistry(bad)).toThrow(/authority/);
  });
});

describe("requireCurrentEntry — AC1: no entry, no figure", () => {
  it("returns a current entry with a value", () => {
    const entries = parseRegistry(MINIMAL_CURRENT);
    const entry = requireCurrentEntry("test-current", entries);
    expect(entry.value).toBe(258);
  });

  it("throws when the id is absent", () => {
    const entries = parseRegistry(MINIMAL_CURRENT);
    expect(() => requireCurrentEntry("does-not-exist", entries)).toThrow(/no entry/);
  });

  it("throws when the entry is pending", () => {
    const entries = parseRegistry(`entries:\n  - id: p\n    status: pending\n`);
    expect(() => requireCurrentEntry("p", entries)).toThrow(/pending/);
  });

  it("throws when the entry is superseded", () => {
    const entries = parseRegistry(`
entries:
  - id: old
    status: superseded
    value: 283
`);
    expect(() => requireCurrentEntry("old", entries)).toThrow(/superseded/);
  });

  it("throws when the entry is current but carries no value", () => {
    const entries = parseRegistry(`entries:\n  - id: c\n    status: current\n`);
    expect(() => requireCurrentEntry("c", entries)).toThrow(/no value/);
  });

  /**
   * AC1's literal proof: delete an entry from the registry, and the thing
   * that reads it fails — it does not fall back. This is that proof, run
   * against a real file on disk rather than an in-memory fixture, so it
   * exercises the same `loadRegistry(filePath)` path the resolver would use.
   */
  it("proves AC1 live: deleting the Spain entry from a real file breaks the read", () => {
    const dir = mkdtempSync(join(tmpdir(), "h-src-es-"));
    const file = join(dir, "es.yaml");

    writeFileSync(file, MINIMAL_CURRENT.replace("test-current", "es-carbon-supply-residual-2025"));
    const before = loadRegistry(file);
    expect(() => requireCurrentEntry("es-carbon-supply-residual-2025", before)).not.toThrow();

    // The entry is now gone — as if it had been deleted from the YAML file.
    writeFileSync(file, `entries: []\n`);
    const after = loadRegistry(file);
    expect(() => requireCurrentEntry("es-carbon-supply-residual-2025", after)).toThrow(/no entry/);
  });
});

describe("getEntry", () => {
  it("returns undefined for a missing id rather than throwing", () => {
    const entries = parseRegistry(MINIMAL_CURRENT);
    expect(getEntry("nope", entries)).toBeUndefined();
  });
});

describe("loadRegistry() — the real repository file", () => {
  beforeEach(() => _resetRegistryCacheForTests());

  it("finds data/sources/es.yaml from this module's real location and parses it", () => {
    const entries = loadRegistry();
    expect(entries.length).toBeGreaterThan(0);
    expect(getEntry("es-carbon-supply-residual-2025", entries)?.status).toBe("current");
  });

  it("caches: a second no-argument call returns entries without re-reading disk", () => {
    const first = loadRegistry();
    const second = loadRegistry();
    expect(second).toBe(first);
  });
});
