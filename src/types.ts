export type EntryType = 'skill' | 'agent' | 'prompt'

interface Author {
  name: string
  url?: string
}

interface Usage {
  instructions: string
  example?: string
}

interface BaseEntry {
  id: string
  type: EntryType
  name: string
  description: string
  author: Author
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
  installation: {
    command: string
    notes?: string
  }
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
