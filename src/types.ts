export type EntryType = 'skill' | 'agent' | 'prompt'

interface Author {
  name: string
  url?: string
}

interface Usage {
  instructions: string
  example?: string
}

interface Source {
  primaryFile: string
  sourceUrl: string
  rawUrl?: string
}

export type InstallClient =
  | 'github-copilot'
  | 'github-copilot-cli'
  | 'claude-code'
  | 'universal'

export type InstallScope = 'project' | 'user' | 'interactive'

interface InstallStep {
  title: string
  description: string
  command?: string
  expected?: string
}

interface LifecycleAction {
  description: string
  command?: string
}

export interface Installation {
  id: string
  type: 'cli' | 'manual' | 'deeplink' | 'download'
  label: string
  summary: string
  client: InstallClient
  scope: InstallScope
  platforms: Array<'windows' | 'macos' | 'linux' | 'web'>
  officialStatus: 'official' | 'maintainer' | 'community'
  recommended?: boolean
  command?: string
  url?: string
  targetPath?: string
  prerequisites?: Array<{
    name: string
    details: string
    check?: string
  }>
  steps: InstallStep[]
  verify?: LifecycleAction
  update?: LifecycleAction
  uninstall?: LifecycleAction
  securityNote?: string
  evidenceUrl: string
}

interface BaseEntry {
  id: string
  type: EntryType
  name: string
  description: string
  author: Author
  source: Source
  repository?: string
  url?: string
  tags: string[]
  version: string
  license: string
  updatedAt: string
  isExample: boolean
  featured?: boolean
  usage: Usage
}

export interface SkillEntry extends BaseEntry {
  type: 'skill'
  installations: Installation[]
}

export interface AgentEntry extends BaseEntry {
  type: 'agent'
  setup: {
    instructions: string
    requirements: string[]
  }
}

export interface PromptEntry extends BaseEntry {
  type: 'prompt'
  prompt: {
    template: string
    variables: Array<{
      name: string
      description: string
      required: boolean
    }>
  }
}

export type RegistryEntry = SkillEntry | AgentEntry | PromptEntry
