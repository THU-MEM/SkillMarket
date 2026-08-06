# Pull Request Review Brief prompt

```text
Review CHANGESET against INTENT.

Focus on correctness, security, data loss, regressions, and missing tests in RISK_AREAS.
Report only actionable findings supported by the diff, with file and line references.
Treat PROJECT_RULES as binding and avoid style-only feedback.
```

Supply the actual diff and acceptance criteria. Verify every finding against the checked-out
source before posting it.
