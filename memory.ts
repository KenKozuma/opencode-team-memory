import { type MemoryEntry, type SaveInput, CURRENT_VERSION, EMPTY_MEMORY, type Role, type References, type ReferenceEntry, SKILL_THRESHOLD } from "./types"

const MAX_KEEP = 50
const RAW_LOAD_LIMIT = 5

export function merge(existing: MemoryEntry | null, input: SaveInput, project: string): MemoryEntry {
  const now = new Date().toISOString()

  if (!existing) {
    return {
      ...EMPTY_MEMORY(input.role, project),
      last_updated: now,
      previous_decisions: (input.previous_decisions || []).slice(-MAX_KEEP),
      ng_history: (input.ng_history || []).slice(-MAX_KEEP),
      confirmed_scope: input.confirmed_scope || [],
      excluded_scope: input.excluded_scope || [],
      active_files: input.active_files || [],
      handoff_to: input.handoff_to !== undefined ? input.handoff_to : "",
      raw_entries: input.raw ? [input.raw] : [],
    }
  }

  const base = migrate(existing)

  const append = (a: string[], b?: string[]): string[] =>
    [...a, ...(b || [])].slice(-MAX_KEEP)

  return {
    ...base,
    last_updated: now,
    previous_decisions: append(base.previous_decisions, input.previous_decisions),
    ng_history: append(base.ng_history, input.ng_history),
    confirmed_scope: input.confirmed_scope || base.confirmed_scope,
    excluded_scope: input.excluded_scope || base.excluded_scope,
    active_files: input.active_files || base.active_files,
    handoff_to: input.handoff_to !== undefined ? input.handoff_to : base.handoff_to,
    raw_entries: input.raw
      ? append(base.raw_entries, [input.raw])
      : base.raw_entries,
  }
}

function migrate(entry: MemoryEntry): MemoryEntry {
  if (entry.version >= CURRENT_VERSION) return entry
  return { ...entry, version: CURRENT_VERSION }
}

export function format(entry: MemoryEntry | null, role: Role): string {
  if (!entry) return `No saved context for role '${role}'. This is a fresh start.`

  const raw = entry.raw_entries.slice(-RAW_LOAD_LIMIT)

  return [
    `=== PERSISTENT CONTEXT: ${role} ===`,
    `Project: ${entry.project}`,
    `Last updated: ${entry.last_updated}`,
    ``,
    `## Previous Decisions (${entry.previous_decisions.length} total, showing last ${Math.min(entry.previous_decisions.length, RAW_LOAD_LIMIT)})`,
    ...entry.previous_decisions.slice(-RAW_LOAD_LIMIT).map((d, i) => `${i + 1}. ${d}`),
    ``,
    `## NG History (${entry.ng_history.length} total, showing last ${Math.min(entry.ng_history.length, RAW_LOAD_LIMIT)})`,
    ...entry.ng_history.slice(-RAW_LOAD_LIMIT).map((n, i) => `${i + 1}. ${n}`),
    ``,
    `## Confirmed Scope`,
    ...entry.confirmed_scope.map((s) => `- ${s}`),
    ``,
    `## Excluded Scope (DO NOT TOUCH)`,
    ...entry.excluded_scope.map((s) => `- ${s}`),
    ``,
    `## Active Files`,
    ...entry.active_files.map((f) => `- ${f}`),
    ``,
    entry.handoff_to ? `## Handoff Target → ${entry.handoff_to}` : "",
    ``,
    `## Raw Context Entries (${entry.raw_entries.length} total, showing last ${raw.length})`,
    ...raw.map((r, i) => `--- Entry ${entry.raw_entries.length - raw.length + i + 1} ---\n${r}`),
  ].join("\n")
}

export function formatCompact(entry: MemoryEntry | null): string {
  if (!entry) return "(no memory)"

  return [
    `## Team Memory: ${entry.role}`,
    `Decisions: ${entry.previous_decisions.slice(-3).join("; ") || "none"}`,
    `Recent NG: ${entry.ng_history.slice(-2).join("; ") || "none"}`,
    `Scope: confirmed=[${entry.confirmed_scope.join(", ")}] excluded=[${entry.excluded_scope.join(", ")}]`,
    `Files: ${entry.active_files.join(", ") || "none"}`,
  ].join("\n")
}

export function formatSaveResult(entry: MemoryEntry): string {
  return [
    `✓ Saved context for '${entry.role}'`,
    `  Decisions: ${entry.previous_decisions.length} | NG: ${entry.ng_history.length}`,
    `  Scope: ${entry.confirmed_scope.length} confirmed / ${entry.excluded_scope.length} excluded`,
    entry.handoff_to ? `  Next: → ${entry.handoff_to}` : "",
  ].join("\n")
}

export function formatContinuation(entry: MemoryEntry | null, role: Role): string {
  if (!entry) return ""

  const decisions = entry.previous_decisions.slice(-3).join("; ")
  const ng = entry.ng_history.slice(-2)

  const lines: string[] = [
    "## Team Continuation (opencode-team-memory)",
    "",
    `### Your Role: ${role}`,
  ]

  if (entry.handoff_to) {
    lines.push(`### Handoff → ${entry.handoff_to}`)
  }

  lines.push(`### Status: ng_count=${entry.ng_history.length}`)

  if (decisions) {
    lines.push(`### Critical Context\n${decisions}`)
  }

  if (ng.length > 0) {
    lines.push(`### Recent NG Items\n${ng.join("\n")}`)
  }

  if (entry.confirmed_scope.length > 0) {
    lines.push(`### Confirmed Scope\n${entry.confirmed_scope.map(s => `- ${s}`).join("\n")}`)
  }

  if (entry.excluded_scope.length > 0) {
    lines.push(`### Excluded (DO NOT TOUCH)\n${entry.excluded_scope.map(s => `- ${s}`).join("\n")}`)
  }

  lines.push(
    "",
    "### Instructions",
    `1. role_memory_load(role="${role}") before starting`,
    entry.handoff_to ? `2. Handoff target is '${entry.handoff_to}' — prepare output accordingly` : "",
    entry.ng_history.length > 0 ? `${entry.handoff_to ? "3" : "2"}. Address NG items first` : "",
    "0. Resume work based on context above",
    ""
  )

  return lines.filter(Boolean).join("\n")
}

export function trackReference(
  refs: References,
  pattern_name: string,
  solution: string,
): { refs: References; reached: boolean; count: number } {
  const existing = refs[pattern_name] || { count: 0, solution }
  const entry: ReferenceEntry = {
    count: existing.count + 1,
    solution: solution || existing.solution,
    last_referenced: new Date().toISOString(),
  }
  return {
    refs: { ...refs, [pattern_name]: entry },
    reached: entry.count >= SKILL_THRESHOLD,
    count: entry.count,
  }
}

export function findHotPatterns(refs: References): Array<{ name: string; entry: ReferenceEntry }> {
  return Object.entries(refs)
    .filter(([, entry]) => entry.count >= SKILL_THRESHOLD)
    .map(([name, entry]) => ({ name, entry }))
    .sort((a, b) => b.entry.count - a.entry.count)
}

export function generateSkillMarkdown(name: string, entry: ReferenceEntry, role: Role): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

  return [
    "---",
    `name: ${slug}`,
    `description: Auto-generated from ${entry.count} successful uses. ${name} — ${entry.solution.slice(0, 80)}`,
    "license: MIT",
    "compatibility: opencode",
    "metadata:",
    "  source: opencode-team-memory",
    `  role: ${role}`,
    `  references: ${entry.count}`,
    `  generated: ${new Date().toISOString()}`,
    "---",
    "",
    `# ${name}`,
    "",
    `Auto-generated skill from ${entry.count} successful pattern references.`,
    "",
    "## Solution",
    entry.solution,
    "",
    "## When to Use",
    `This pattern has been referenced ${entry.count} times by the ${role} role.`,
    "Apply when encountering this class of problem.",
    "",
    "## Usage",
    `Agent: @${slug} を呼び出せば、この解決策が適用される。`,
  ].join("\n")
}

export function buildTaskPrompt(entry: MemoryEntry, targetRole: Role): string {
  const ng = entry.ng_history.slice(-2)
  const decisions = entry.previous_decisions.slice(-3)
  const raw = entry.raw_entries.slice(-1)[0] || ""

  const lines: string[] = [
    `You are acting as ${targetRole}.`,
    "",
  ]

  if (raw) {
    lines.push(`## Context from previous role (${entry.role})`)
    lines.push(raw)
    lines.push("")
  }

  if (decisions.length > 0) {
    lines.push("## Key Decisions")
    decisions.forEach(d => lines.push(`- ${d}`))
    lines.push("")
  }

  if (ng.length > 0) {
    lines.push("## NG Items to Address")
    ng.forEach(n => lines.push(`- ${n}`))
    lines.push("")
  }

  if (entry.confirmed_scope.length > 0) {
    lines.push("## Confirmed Scope")
    entry.confirmed_scope.forEach(s => lines.push(`- ${s}`))
    lines.push("")
  }

  if (entry.excluded_scope.length > 0) {
    lines.push("## Excluded (DO NOT TOUCH)")
    entry.excluded_scope.forEach(s => lines.push(`- ${s}`))
    lines.push("")
  }

  lines.push(
    `## Instructions`,
    `1. role_memory_load(role="${targetRole}") to restore your context`,
    `2. Complete the task described above`,
    `3. role_memory_save(role="${targetRole}", handoff_to="<next-role>", raw="summary")`,
    `4. Report result back to Director`,
  )

  return lines.join("\n")
}
