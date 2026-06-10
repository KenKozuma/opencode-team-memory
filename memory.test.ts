import { describe, test, expect } from "bun:test"
import { merge, format, formatCompact, formatSaveResult } from "./memory"
import { EMPTY_MEMORY, type MemoryEntry } from "./types"

const PROJECT = "/fake/project"

function makeEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    ...EMPTY_MEMORY("engineer", PROJECT),
    ...overrides,
  }
}

describe("merge", () => {
  test("creates fresh entry when no existing memory", () => {
    const result = merge(null, { role: "engineer", raw: "hello" }, PROJECT)
    expect(result.role).toBe("engineer")
    expect(result.raw_entries).toEqual(["hello"])
    expect(result.previous_decisions).toHaveLength(0)
    expect(result.version).toBe(1)
  })

  test("appends to existing entry", () => {
    const existing = makeEntry({
      previous_decisions: ["use redis for caching"],
      ng_history: ["login redirect broken"],
      confirmed_scope: ["auth module"],
      raw_entries: ["first session"],
    })

    const result = merge(existing, {
      role: "engineer",
      previous_decisions: ["switch to postgres"],
      ng_history: ["token expiry too short"],
      raw: "second session",
    }, PROJECT)

    expect(result.previous_decisions).toEqual(["use redis for caching", "switch to postgres"])
    expect(result.ng_history).toEqual(["login redirect broken", "token expiry too short"])
    expect(result.raw_entries).toEqual(["first session", "second session"])
    expect(result.confirmed_scope).toEqual(["auth module"])
  })

  test("caps arrays at MAX_KEEP (50)", () => {
    const existing = makeEntry({
      previous_decisions: Array.from({ length: 48 }, (_, i) => `decision ${i}`),
    })

    const result = merge(existing, {
      role: "engineer",
      previous_decisions: ["d49", "d50", "d51"],
    }, PROJECT)

    expect(result.previous_decisions).toHaveLength(50)
    expect(result.previous_decisions[0]).toBe("decision 1")
    expect(result.previous_decisions[49]).toBe("d51")
  })

  test("overrides scope fields when provided", () => {
    const existing = makeEntry({
      confirmed_scope: ["old scope"],
      excluded_scope: ["legacy"],
      active_files: ["a.ts"],
      handoff_to: "tester",
    })

    const result = merge(existing, {
      role: "engineer",
      confirmed_scope: ["new scope"],
      active_files: ["b.ts", "c.ts"],
      handoff_to: "designer",
    }, PROJECT)

    expect(result.confirmed_scope).toEqual(["new scope"])
    expect(result.excluded_scope).toEqual(["legacy"])
    expect(result.active_files).toEqual(["b.ts", "c.ts"])
    expect(result.handoff_to).toBe("designer")
  })

  test("preserves version during merge", () => {
    const existing = makeEntry({ version: 0 })
    const result = merge(existing, { role: "engineer" }, PROJECT)
    expect(result.version).toBe(1)
  })

  test("clears handoff_to when empty string is passed", () => {
    const existing = makeEntry({ handoff_to: "tester" })
    const result = merge(existing, { role: "engineer", handoff_to: "" }, PROJECT)
    expect(result.handoff_to).toBe("")
  })

  test("preserves all fields when no optional fields provided", () => {
    const existing = makeEntry({
      previous_decisions: ["d1"],
      ng_history: ["ng1"],
      confirmed_scope: ["auth"],
      excluded_scope: ["legacy"],
      active_files: ["a.ts"],
      handoff_to: "tester",
      raw_entries: ["session1"],
    })
    const result = merge(existing, { role: "engineer" }, PROJECT)
    expect(result.previous_decisions).toEqual(["d1"])
    expect(result.ng_history).toEqual(["ng1"])
    expect(result.confirmed_scope).toEqual(["auth"])
    expect(result.excluded_scope).toEqual(["legacy"])
    expect(result.active_files).toEqual(["a.ts"])
    expect(result.handoff_to).toBe("tester")
    expect(result.raw_entries).toEqual(["session1"])
  })
})

describe("format", () => {
  test("returns fresh start message for null", () => {
    const out = format(null, "engineer")
    expect(out).toContain("fresh start")
  })

  test("trims raw_entries to last 5", () => {
    const entry = makeEntry({
      raw_entries: Array.from({ length: 10 }, (_, i) => `entry ${i}`),
    })
    const out = format(entry, "engineer")
    expect(out).toContain("entry 5")
    expect(out).toContain("entry 9")
    expect(out).toContain("10 total, showing last 5")
  })

  test("includes handoff info", () => {
    const entry = makeEntry({ handoff_to: "tester" })
    const out = format(entry, "engineer")
    expect(out).toContain("→ tester")
  })

  test("handles empty arrays gracefully", () => {
    const entry = makeEntry({
      previous_decisions: [],
      ng_history: [],
      confirmed_scope: [],
      excluded_scope: [],
      active_files: [],
      raw_entries: [],
    })
    const out = format(entry, "engineer")
    expect(out).toContain("0 total")
    expect(out).toContain("Confirmed Scope")
  })
})

describe("formatCompact", () => {
  test("returns placeholder for null", () => {
    expect(formatCompact(null)).toBe("(no memory)")
  })

  test("includes role and summary", () => {
    const entry = makeEntry({
      role: "tester",
      previous_decisions: ["d1", "d2", "d3", "d4"],
      ng_history: ["ng1"],
      confirmed_scope: ["login"],
    })
    const out = formatCompact(entry)
    expect(out).toContain("tester")
    expect(out).toContain("d2; d3; d4")
    expect(out).toContain("ng1")
  })

  test("handles empty entry", () => {
    const entry = makeEntry()
    const out = formatCompact(entry)
    expect(out).toContain("engineer")
    expect(out).toContain("none")
  })
})

describe("formatSaveResult", () => {
  test("formats save confirmation", () => {
    const entry = makeEntry({ handoff_to: "director" })
    const out = formatSaveResult(entry)
    expect(out).toContain("engineer")
    expect(out).toContain("→ director")
  })

  test("formats save confirmation without handoff", () => {
    const entry = makeEntry({ handoff_to: "" })
    const out = formatSaveResult(entry)
    expect(out).toContain("engineer")
    expect(out).not.toContain("→")
  })
})
