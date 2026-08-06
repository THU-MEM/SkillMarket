---
name: release-notes-writer
description: Turn a reviewed commit range into concise, audience-aware release notes without inventing changes.
license: Apache-2.0
compatibility: GitHub Copilot, GitHub Copilot CLI, Claude Code, and other Agent Skills clients
---

# Release Notes Writer

## Purpose

Turn a reviewed commit range into concise release notes for a named audience without
inventing changes or impact.

## Workflow

1. Read only the supplied commits and linked issues.
2. Group changes into improvements, fixes, and upgrade notes.
3. Explain user-visible impact before implementation details.
4. Preserve breaking-change and migration language exactly.
5. Call out commits that cannot be described confidently.

## Output

Return Markdown with a short release summary and only the sections that contain changes.
