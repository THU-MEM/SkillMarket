# SkillMarket

**An open marketplace for discovering and publishing Skills, Agents, and Prompts.**

[Live site](https://thu-mem.github.io/SkillMarket/) ·
[Publish a listing](CONTRIBUTING.md) ·
[Registry schema](registry/registry.schema.json)

SkillMarket is a static, community-maintained catalog for reusable AI workflow building blocks.
Listings are plain JSON files, reviewed in public pull requests, and deployed to GitHub Pages.
There is no database, account system, tracking counter, or hosted execution service.

> **Product preview:** a real screenshot will be added after the first production Pages
> deployment. To capture one now, run `npm run dev`, open the local URL, and take a browser
> screenshot at 1440 × 900. This note intentionally avoids presenting a mockup as the live
> product.

## Features

- One searchable catalog for Skills, Agents, and Prompts
- Type and multi-tag filters, sorting, result totals, and clear empty states
- Responsive marketplace layout for mobile and desktop
- Static-hosting-safe hash routes for durable listing detail URLs
- Complete metadata, installation/setup guidance, prompt variables, and source links
- Clearly labeled first-party demonstration entries
- JSON Schema validation, duplicate-ID checks, and registry tests
- Pull request publishing flow with contribution guide and PR template
- CI validation and official GitHub Pages deployment workflows
- Semantic HTML, visible focus styles, keyboard-accessible controls, and reduced-motion support

## Technology

- React 19 and TypeScript
- Vite with the production base path `/SkillMarket/`
- Static hash routing with no server rewrite requirement
- JSON Schema 2020-12 validated by Ajv
- ESLint and Node's built-in test runner
- GitHub Actions and GitHub Pages

Runtime dependencies are limited to React and React DOM.

## Local development

Requires Node.js 22 and npm.

```bash
git clone https://github.com/THU-MEM/SkillMarket.git
cd SkillMarket
npm ci
npm run dev
```

Vite prints the local development URL. The production build keeps all assets under the
`/SkillMarket/` base path.

### Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run validate:registry` | Validate every listing and global uniqueness rules |
| `npm test` | Run registry validation behavior tests |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript project checks |
| `npm run build` | Type-check and create the production site in `dist/` |
| `npm run check` | Run the complete local CI sequence |

## Project structure

```text
.
├── .github/
│   ├── pull_request_template.md
│   └── workflows/              # CI and Pages deployment
├── examples/                   # Source for clearly labeled demonstration listings
├── public/                     # Static assets, including the original favicon
├── registry/
│   ├── agents/                 # One agent per JSON file
│   ├── prompts/                # One prompt per JSON file
│   ├── skills/                 # One skill per JSON file
│   └── registry.schema.json    # Canonical metadata contract
├── scripts/                    # Registry validator
├── src/                        # React application
├── tests/                      # Registry validation tests
├── CONTRIBUTING.md
└── vite.config.ts
```

## Publishing a listing

1. Choose `registry/skills`, `registry/agents`, or `registry/prompts`.
2. Add one JSON file named after a globally unique kebab-case `id`.
3. Include common metadata and the required type-specific installation or usage information.
4. Run `npm run validate:registry` and the project checks.
5. Open a pull request and complete the listing checklist.

The in-product **Submit a listing** page links directly to GitHub's new-file flow for each type.
See [CONTRIBUTING.md](CONTRIBUTING.md) for field rules, complete examples, validation, and review
expectations.

## Data schema

Every entry includes:

- `id`, `type`, `name`, and `description`
- `author` and at least one public `repository` or `url`
- `tags`, semantic `version`, `license`, and ISO `updatedAt`
- `isExample` so demonstration content cannot be mistaken for a third-party project
- `usage.instructions` and an optional usage example

Skills add `installation`, agents add `setup`, and prompts add a `prompt` template with declared
variables. Unknown fields are rejected. The authoritative contract is
[`registry/registry.schema.json`](registry/registry.schema.json).

## Deployment

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) builds on pushes to `main`, uploads
`dist/` with `actions/upload-pages-artifact`, and deploys it with `actions/deploy-pages`.
[`vite.config.ts`](vite.config.ts) sets the GitHub Pages repository base path, while client-side
hash routes avoid server-side fallback requirements.

Repository administrators must set **Settings → Pages → Build and deployment → Source** to
**GitHub Actions** once. No secret credentials are required.

Pull requests and `main` pushes also run registry validation, tests, linting, type-checking, and a
production build in [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Accessibility

The UI uses semantic landmarks and controls, a skip link, keyboard-visible focus, associated
form labels, live result counts, sufficient contrast, and a reduced-motion mode. Accessibility
issues are welcome through GitHub issues and pull requests.

## Roadmap

- Add community-owned listings after review
- Introduce optional schema fields for compatibility and supported clients
- Add automated link health checks without collecting visitor data
- Publish a real product screenshot after the initial production deployment
- Improve localization and catalog-scale browsing as the registry grows

## License

Licensed under [Apache License 2.0](LICENSE).
