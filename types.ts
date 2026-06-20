export const CURRENT_VERSION = 1

export type Role = "engineer" | "tester" | "designer" | "director"

export const ALL_ROLES: Role[] = ["engineer", "tester", "designer", "director"]

export interface MemoryEntry {
  version: number
  role: Role
  project: string
  last_updated: string
  previous_decisions: string[]
  ng_history: string[]
  confirmed_scope: string[]
  excluded_scope: string[]
  active_files: string[]
  handoff_to: string
  raw_entries: string[]
}

export const EMPTY_MEMORY = (role: Role, project: string): MemoryEntry => ({
  version: CURRENT_VERSION,
  role,
  project,
  last_updated: new Date().toISOString(),
  previous_decisions: [],
  ng_history: [],
  confirmed_scope: [],
  excluded_scope: [],
  active_files: [],
  handoff_to: "",
  raw_entries: [],
})

export interface SaveInput {
  role: Role
  previous_decisions?: string[]
  ng_history?: string[]
  confirmed_scope?: string[]
  excluded_scope?: string[]
  active_files?: string[]
  handoff_to?: string
  raw?: string
}

export interface ContinueState {
  role: Role
  handoff_to: string
  last_action: string
  ng_count: number
  confirmed_scope: string[]
  excluded_scope: string[]
  decisions_summary: string
  ng_summary: string
}

export interface ReferenceEntry {
  count: number
  solution: string
  last_referenced: string
}

export interface References {
  [pattern_name: string]: ReferenceEntry
}

export const SKILL_THRESHOLD = 3
