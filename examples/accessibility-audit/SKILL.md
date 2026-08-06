---
name: accessibility-audit
description: Review web interfaces for keyboard, semantic, focus, labeling, and contrast barriers.
license: Apache-2.0
compatibility: GitHub Copilot, GitHub Copilot CLI, Claude Code, and other Agent Skills clients
---

# Accessibility Audit

## Purpose

Review a named web page or component for high-confidence accessibility barriers. Focus
on keyboard operation, focus management, semantic HTML, accessible names, form errors,
and text contrast.

## Inputs

- The relevant source files
- The expected interaction flow
- The target conformance level

## Output

Report each finding with its impact, supporting code location, and a focused remediation.
Separate confirmed barriers from items that require browser or assistive-technology
testing. Do not claim formal WCAG conformance.
