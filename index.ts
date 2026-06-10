import { type Plugin, tool } from "@opencode-ai/plugin"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { ALL_ROLES, EMPTY_MEMORY, type MemoryEntry, type Role, type SaveInput } from "./types"
import { merge, format, formatCompact, formatSaveResult } from "./memory"

function getMemoryBase(directory: string): string {
  return process.env.OPENCODE_TEAM_MEMORY_DIR || join(directory, ".omo", "team-memory")
}

function isENOENT(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT"
}

export const TeamMemoryPlugin: Plugin = async ({ directory }) => {
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
    },

    "experimental.session.compacting": async (_input, output) => {
      for (const role of ALL_ROLES) {
        try {
          const entry = await load(role)
          if (entry) {
            output.context.push(formatCompact(entry))
          }
        } catch {
          // skip roles with no saved memory
        }
      }
    },
  }
}
