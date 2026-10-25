# Lab Community (The Hub Collective)

Community knowledge and marketplace platform built with Jekyll, Cloudflare Worker workflows, and GitHub PR-based content publishing.

## Overview

This project supports:

- Community wiki pages
- Community broadcasts
- Marketplace listings
- Inline editor updates for existing pages

All submissions are routed through a single worker entry point:

- `assets/combined-worker.js`

The worker creates a branch, writes files, opens a pull request, and returns sanitized API responses to the UI.

## Architecture

### Frontend

- Static site: Jekyll
- Layouts/includes: `_layouts/`, `_includes/`
- JS: `assets/js/`
- Styles: `assets/css/custom/`

### Submission Pipeline

1. User submits from UI (`submit`, `broadcast`, `list-service`, or drawer update).
2. Worker validates request and resolves target path/community.
3. Worker uploads media to R2 (when present).
4. Worker writes markdown into GitHub branch.
5. Worker opens PR against resolved base branch.

### Identity Model

- `community_key`: stable community identifier (example: `comm-elm-drive`)
- `page_key`: stable page identifier (example: `page-xxxx`)

These keys are used to avoid title-based update routing.

## Validation & Security Controls

- Safe repo-path checks to prevent path tampering.
- Supported type allowlist (`wiki`, `update`, `marketplace`, `broadcast`).
- Duplicate checks:
  - community name duplicate (case-insensitive)
  - wiki title duplicate inside existing community
- GitHub failure handling for branch create, file write, and PR creation.
- Sanitized worker error responses (no GitHub internals in UI payload).

## Localization

Language files:

- `assets/en.json`
- `assets/fr.json`

UI text should use:

- `data-i18n`
- `data-i18n-placeholder`
- `data-i18n-aria-label`

## Resource Mode (Dev vs Prod)

Config flags are defined in:

- `_config.yml`
- `_config.prod.yml`

Flags:

- `resources.mode`: `dev` or `prod`
- `resources.expose_client_js`: when `false`, client JS tags are omitted from layout (UI interactivity breaks)
- `resources.expose_debug_bindings`: controls debug/transitional globals on `window`

Production recommendation:

- Keep `expose_client_js: true` (required for interactive features)
- Set `expose_debug_bindings: false`

Important limitation:

- Browser JS cannot be fully hidden in production because the client must download executable code.
- Security should rely on server-side validation (worker), not secrecy of frontend JS.

## Special Pages

Root routes remain stable:

- `404.html`
- `success.html`

Page content is organized under:

- `_includes/pages/404-content.html`
- `_includes/pages/success-content.html`

## Local Development

Install dependencies:

```bash
bundle install
```

Run locally:

```bash
bundle exec jekyll serve
```

Build:

```bash
bundle exec jekyll build
```

## Deployment

Production static-site deployment:

```bash
bundle exec jekyll build --config _config.yml,_config.prod.yml
wrangler deploy
```

Worker deployment should include latest `assets/combined-worker.js` changes and required environment bindings.

## Required Worker Environment

- `GH_TOKEN`
- `GITHUB_BASE_BRANCH` (optional override)
- `WIKI_BUCKET`

## Backlog

- `[P2]` Token-based delete flow (no-login ownership with token/hash verification)
