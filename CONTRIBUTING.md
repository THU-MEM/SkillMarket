# Contributing to SkillMarket

Thank you for helping build an open, useful registry. SkillMarket is maintained as files in
Git: there is no account system or private database. A listing is published when its pull
request is reviewed and merged into `main`.

## Before you submit

- Submit work that you maintain or have permission to represent.
- Link to public, inspectable source or usage documentation.
- Use accurate descriptions. Do not claim downloads, endorsements, security guarantees, or
  compatibility that cannot be verified.
- Choose a license that applies to the linked work and use its SPDX identifier when possible.
- Never include API keys, access tokens, private URLs, or personal data.
- Mark demonstration-only content with `"isExample": true`. Real community submissions should
  use `"isExample": false`.

## Choose a listing type

| Type | Folder | Use it for |
| --- | --- | --- |
| Skill | `registry/skills/` | A focused, repeatable capability or workflow installed into an AI assistant |
| Agent | `registry/agents/` | A configured collaborator with a defined goal, setup, and operating requirements |
| Prompt | `registry/prompts/` | A reusable instruction template with explicit variables |

Create exactly one JSON file for each listing. Its filename must match its unique `id`, for
example `registry/skills/accessibility-audit.json`.

## Common fields

The canonical machine-readable definition is
[`registry/registry.schema.json`](registry/registry.schema.json).

| Field | Required | Rules |
| --- | --- | --- |
| `id` | Yes | Globally unique, 3–64 characters, lowercase kebab-case |
| `type` | Yes | `skill`, `agent`, or `prompt`; must match the containing folder |
| `name` | Yes | Human-readable name, 3–80 characters |
| `description` | Yes | Specific plain-text summary, 40–500 characters |
| `author` | Yes | Object with `name` and optional HTTPS `url` |
| `source` | Yes | Primary file path, HTTPS source URL, and optional raw URL |
| `repository` / `url` | At least one | HTTPS source repository or public usage page; `repository` must be on GitHub |
| `tags` | Yes | 1–10 unique lowercase kebab-case tags |
| `version` | Yes | Semantic version such as `1.2.0` |
| `license` | Yes | License identifier such as `Apache-2.0` or `MIT` |
| `updatedAt` | Yes | Real ISO date in `YYYY-MM-DD` format |
| `isExample` | Yes | `false` for normal community submissions |
| `featured` | No | Boolean; maintainers decide whether a listing is featured |
| `usage` | Yes | `instructions` plus an optional practical `example` |

Do not add unknown properties. Keep tags broad enough to help discovery and do not repeat the
listing type as a tag.

## Type-specific fields

### Skill

A skill requires an `installations` array. Each method is independently validated and must state
its client, scope, platform support, provenance, steps, and evidence:

```json
{
  "installations": [
    {
      "id": "npx-copilot-project",
      "type": "cli",
      "label": "Install with npx skills",
      "summary": "Install the reviewed skill into the current repository for GitHub Copilot.",
      "client": "github-copilot",
      "scope": "project",
      "platforms": ["windows", "macos", "linux"],
      "officialStatus": "community",
      "recommended": true,
      "command": "npx skills add owner/repo --skill concise-doc-review --agent github-copilot --yes",
      "prerequisites": [
        {
          "name": "Node.js",
          "details": "The current npx skills package requires Node.js 22.20.0 or newer.",
          "check": "node --version"
        }
      ],
      "steps": [
        {
          "title": "Open the target repository",
          "description": "Run the command from the repository root."
        },
        {
          "title": "Install the skill",
          "description": "Select the named skill and target GitHub Copilot.",
          "command": "npx skills add owner/repo --skill concise-doc-review --agent github-copilot --yes"
        }
      ],
      "verify": {
        "description": "List installed skills and inspect the created project directory.",
        "command": "npx skills list"
      },
      "update": {
        "description": "Update skills managed by the community CLI.",
        "command": "npx skills update"
      },
      "uninstall": {
        "description": "Select and remove the installed skill.",
        "command": "npx skills remove"
      },
      "securityNote": "npx skills is a Vercel community CLI, not an official GitHub command. Review source first.",
      "evidenceUrl": "https://github.com/vercel-labs/skills#readme"
    }
  ]
}
```

Supported installation `type` values are `cli`, `manual`, `deeplink`, and `download`. Supported
clients currently include `github-copilot`, `github-copilot-cli`, `claude-code`, and `universal`.
Scopes are `project`, `user`, or `interactive`.

Every method must include an `officialStatus`:

- `official`: documented by the client vendor.
- `maintainer`: documented and supported by the resource maintainer.
- `community`: supplied by a third-party community tool.

Every status must be backed by an `evidenceUrl`. Do not mark `npx skills` as an official GitHub or
Anthropic command. Do not invent update or uninstall commands when the source does not document
them. Include a visible `securityNote` for shell execution, downloads, hooks, MCP, or broad
permissions.

### Agent

An agent requires a `setup` object:

```json
{
  "setup": {
    "instructions": "Add the agent definition to your assistant configuration and grant read-only repository access.",
    "requirements": ["Git repository", "Documented project conventions"]
  }
}
```

Explain permissions and external requirements explicitly. Do not imply that SkillMarket hosts
or runs the agent.

### Prompt

A prompt requires a `prompt` object:

```json
{
  "prompt": {
    "template": "Review CHANGESET against INTENT and report only evidence-backed findings.",
    "variables": [
      {
        "name": "CHANGESET",
        "description": "The diff or commit range to review.",
        "required": true
      }
    ]
  }
}
```

Variable names use uppercase snake case. The template should make clear where each variable is
used.

## Complete example

```json
{
  "id": "concise-doc-review",
  "type": "skill",
  "name": "Concise Documentation Review",
  "description": "Reviews technical documentation for missing prerequisites, ambiguous steps, and unsupported claims.",
  "author": {
    "name": "Example Maintainer",
    "url": "https://github.com/example"
  },
  "source": {
    "primaryFile": "skills/concise-doc-review/SKILL.md",
    "sourceUrl": "https://github.com/example/concise-doc-review/blob/main/SKILL.md",
    "rawUrl": "https://raw.githubusercontent.com/example/concise-doc-review/main/SKILL.md"
  },
  "repository": "https://github.com/example/concise-doc-review",
  "tags": ["documentation", "quality"],
  "version": "1.0.0",
  "license": "Apache-2.0",
  "updatedAt": "2026-08-06",
  "isExample": false,
  "installations": [
    {
      "id": "manual-project",
      "type": "manual",
      "label": "Manual project install",
      "summary": "Review and copy the skill into the current repository without an installer.",
      "client": "github-copilot",
      "scope": "project",
      "platforms": ["windows", "macos", "linux"],
      "officialStatus": "maintainer",
      "targetPath": ".github/skills/concise-doc-review/SKILL.md",
      "steps": [
        {
          "title": "Review the source",
          "description": "Read the complete skill and referenced files before copying."
        },
        {
          "title": "Copy the skill",
          "description": "Create the target directory and copy the complete skill bundle."
        }
      ],
      "verify": {
        "description": "Confirm the target SKILL.md exists and restart the client."
      },
      "uninstall": {
        "description": "Delete the .github/skills/concise-doc-review directory."
      },
      "securityNote": "Manual installation avoids an installer but does not make the skill content trusted.",
      "evidenceUrl": "https://github.com/example/concise-doc-review#installation"
    }
  ],
  "usage": {
    "instructions": "Provide the document, its audience, and the environment in which its steps must work.",
    "example": "Review this setup guide for a developer using Windows and Node.js 22."
  }
}
```

Replace all example values with facts about your project.

See [docs/USER_GUIDE.md](docs/USER_GUIDE.md) for the user-facing installation model and official
references used by the marketplace.

## Installation evidence requirements

Before submitting an installation method:

1. Open the vendor documentation or maintainer README linked by `evidenceUrl`.
2. Run the command against a disposable project when feasible.
3. Confirm the destination path matches the selected `client` and `scope`.
4. Document prerequisites, expected output, verification, and any known lifecycle commands.
5. Review shell scripts, hooks, MCP configuration, network access, and requested permissions.
6. Never use `official` for a community CLI, inferred path, or undocumented command.

## Validate locally

Node.js 22 and npm are recommended.

```bash
npm ci
npm run validate:registry
npm test
npm run lint
npm run typecheck
npm run build
```

The validator checks JSON syntax, the full schema, URLs and dates, folder placement, filename
matching, and globally unique IDs. CI repeats every command above for pull requests.

## Open a pull request

1. Fork the repository and create a focused branch.
2. Add or update the listing file. Avoid unrelated formatting or generated files.
3. Run the validation commands.
4. Commit the change with a clear message, for example `Add concise doc review skill`.
5. Open a pull request against `THU-MEM/SkillMarket:main`.
6. Complete the pull request template and respond to review feedback.

Maintainers may request clearer metadata, proof of maintainership, a safer installation command,
or a different type/tag. Merging is not guaranteed. Once merged, the next Pages deployment
publishes the updated registry automatically.

## Product and code changes

For changes beyond a registry entry, open an issue or explain the user problem in the pull
request. Keep the application static and dependency-light. Run the complete `npm run check`
command and include screenshots for visual changes.

By contributing, you agree that your contribution is licensed under Apache-2.0.
