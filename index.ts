import { type Plugin, tool } from "@opencode-ai/plugin"
import { readFile, writeFile, mkdir, access } from "node:fs/promises"
import { join } from "node:path"
import { ALL_ROLES, EMPTY_MEMORY, type MemoryEntry, type Role, type SaveInput, type References } from "./types"
import { merge, format, formatCompact, formatSaveResult, formatContinuation, trackReference, findHotPatterns, generateSkillMarkdown } from "./memory"

function getMemoryBase(directory: string): string {
  return process.env.OPENCODE_TEAM_MEMORY_DIR || join(directory, ".omo", "team-memory")
}

function getDisabledMarker(directory: string): string {
  return join(directory, ".omo", ".team-memory-disabled")
}

function isENOENT(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT"
}

export const TeamMemoryPlugin: Plugin = async ({ directory }) => {
  const marker = getDisabledMarker(directory)
  try {
    await access(marker)
    return {}
  } catch {
    // marker file does not exist — plugin is enabled
  }
  const base = getMemoryBase(directory)

  async function load(role: Role): Promise<MemoryEntry | null> {
    try {
      const text = await readFile(join(base, role, "context.json"), "utf-8")
      return JSON.parse(text) as MemoryEntry
    } catch (err: unknown) {
      if (isENOENT(err)) {
        return null
      }
      throw err
    }
  }

  async function save(input: SaveInput): Promise<MemoryEntry> {
    const dir = join(base, input.role)
    await mkdir(dir, { recursive: true })
    const existing = await load(input.role)
    const merged = merge(existing, input, directory)
    await writeFile(join(dir, "context.json"), JSON.stringify(merged, null, 2))
    return merged
  }

  async function loadReferences(role: Role): Promise<References> {
    try {
      const text = await readFile(join(base, role, "references.json"), "utf-8")
      return JSON.parse(text) as References
    } catch (err: unknown) {
      if (isENOENT(err)) return {}
      throw err
    }
  }

  async function saveReferences(role: Role, refs: References): Promise<void> {
    const dir = join(base, role)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, "references.json"), JSON.stringify(refs, null, 2))
  }

  return {
    tool: {
      role_memory_save: tool({
        description: "Save persistent role context — survives across sessions and Team Mode runs",
        args: {
          role: tool.schema.enum(ALL_ROLES),
          previous_decisions: tool.schema.array(tool.schema.string()).optional(),
          ng_history: tool.schema.array(tool.schema.string()).optional(),
          confirmed_scope: tool.schema.array(tool.schema.string()).optional(),
          excluded_scope: tool.schema.array(tool.schema.string()).optional(),
          active_files: tool.schema.array(tool.schema.string()).optional(),
          handoff_to: tool.schema.string().optional(),
          raw: tool.schema.string().optional(),
        },
        async execute(args) {
          const m = await save(args as SaveInput)
          return formatSaveResult(m)
        },
      }),

      role_memory_load: tool({
        description: "Load persistent role context from previous sessions. Call for your own role at session start, or cross-read other roles as needed",
        args: {
          role: tool.schema.enum(ALL_ROLES),
        },
        async execute(args) {
          return format(await load(args.role as Role), args.role as Role)
        },
      }),

      role_memory_clear: tool({
        description: "Clear all persistent memory for a role — use when starting fresh work",
        args: {
          role: tool.schema.enum(ALL_ROLES),
        },
        async execute(args) {
          const dir = join(base, args.role as Role)
          await mkdir(dir, { recursive: true })
          await writeFile(join(dir, "context.json"), JSON.stringify(EMPTY_MEMORY(args.role as Role, directory), null, 2))
          return `✓ Cleared all memory for '${args.role}'`
        },
      }),

      role_memory_resume: tool({
        description: "Detect current role from saved memory and generate continuation prompt. Use when resuming team work mid-session.",
        args: {},
        async execute() {
          let latestRole: Role | null = null
          let latestTime = ""
          let latestEntry: MemoryEntry | null = null

          for (const role of ALL_ROLES) {
            const entry = await load(role)
            if (entry && entry.last_updated > latestTime) {
              latestTime = entry.last_updated
              latestRole = role
              latestEntry = entry
            }
          }

          if (!latestEntry || !latestRole) {
            return "No team context found. Use role_memory_save first, or start a new task."
          }

          return formatContinuation(latestEntry, latestRole)
        },
      }),

      role_memory_reference: tool({
        description: "Track a pattern reference. Each call increments usage count. At threshold (3), pattern becomes a skill candidate. Call when reusing a past solution.",
        args: {
          role: tool.schema.enum(ALL_ROLES),
          pattern_name: tool.schema.string(),
          solution: tool.schema.string(),
        },
        async execute(args) {
          const refs = await loadReferences(args.role as Role)
          const result = trackReference(refs, args.pattern_name, args.solution)
          await saveReferences(args.role as Role, result.refs)

          if (result.reached) {
            const md = generateSkillMarkdown(args.pattern_name, { count: result.count, solution: args.solution, last_referenced: new Date().toISOString() }, args.role as Role)
            return [
              `🔥 Pattern "${args.pattern_name}" reached threshold (${result.count}/3)!`,
              ``,
              `Run to generate skill: omo-skill-generate --role=${args.role} --pattern="${args.pattern_name}"`,
              ``,
              `Preview:`,
              md,
            ].join("\n")
          }

          return `Referenced "${args.pattern_name}" (${result.count}/3 → threshold at 3)`
        },
      }),

      role_memory_hot_patterns: tool({
        description: "List patterns that have reached skill generation threshold",
        args: {
          role: tool.schema.enum(ALL_ROLES),
        },
        async execute(args) {
          const refs = await loadReferences(args.role as Role)
          const hot = findHotPatterns(refs)
          if (hot.length === 0) {
            return `No patterns reached threshold for role '${args.role}'. Keep referencing solutions with role_memory_reference.`
          }

          return [
            `Hot patterns for '${args.role}' (≥3 references):`,
            ...hot.map(h => `  - ${h.name}: ${h.entry.count}x → ${h.entry.solution.slice(0, 60)}`),
            ``,
            `Generate skills: omo-skill-generate --role=${args.role}`,
          ].join("\n")
        },
      }),
    },

    "experimental.session.compacting": async (_input, output) => {
      for (const role of ALL_ROLES) {
        try {
          const entry = await load(role)
          if (!entry) continue

          // Human-readable compact summary
          output.context.push(formatCompact(entry))

          // Context-Mode compatible: structured metadata for FTS5 indexing
          output.context.push(
            JSON.stringify({
              source: "opencode-team-memory",
              role: entry.role,
              handoff_to: entry.handoff_to,
              ng_count: entry.ng_history.length,
              decisions: entry.previous_decisions.slice(-3),
              last_updated: entry.last_updated,
            })
          )
        } catch {
          // skip roles with no saved memory
        }
      }
    },

    "experimental.chat.system.transform": async (_input, output) => {
      const blocks: string[] = []
      for (const role of ALL_ROLES) {
        try {
          const entry = await load(role)
          if (!entry) continue
          const block = formatContinuation(entry, role)
          if (block) blocks.push(block)
        } catch {
          // skip corrupted files
        }
      }
      if (blocks.length > 0) {
        output.context.push(blocks.join("\n\n"))
      }
    },
  }
}
