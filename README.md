# TF Plan Comment

A zero-infrastructure GitHub Action that parses `terraform show -json` output and posts a clean, auto-updating plan summary on your pull requests.

No server. No dashboard. No extra secrets. Just add a few lines to your workflow.

## What you get

Every PR that touches Terraform gets a comment like this:

> **Terraform Plan Summary**
>
> 🟢 **3** to add · 🟡 **1** to change · 🔴 **1** to destroy
>
> ⚠️ **Destructive changes detected** — review carefully before merging.
>
> <details>
> <summary>🔴 `aws_security_group.old` — Delete</summary>
> ...
> </details>

Each resource is in a collapsible section with attribute-level diffs for updates (`old → new`). The same comment is updated on every push — no spam.

## Quick start

Add this to your existing Terraform workflow:

```yaml
name: Terraform

on:
  pull_request:
    paths:
      - '**.tf'
      - '**.tfvars'

permissions:
  contents: read
  pull-requests: write

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3

      - name: Terraform Init
        run: terraform init

      - name: Terraform Plan
        run: terraform plan -no-color -out=tfplan

      - name: Export plan JSON
        run: terraform show -json tfplan > plan.json

      - uses: patrickmackin/tf-plan-comment@v1
        with:
          plan-json-path: plan.json
```

That's it. The action uses the built-in `GITHUB_TOKEN` — no extra secrets required.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `plan-json-path` | Yes | — | Path to the JSON plan file from `terraform show -json` |
| `github-token` | No | `${{ github.token }}` | Token for posting PR comments |
| `comment-marker` | No | `<!-- tf-plan-comment -->` | Hidden marker to find and update the same comment |

## How it works

1. Your workflow runs `terraform plan -out=tfplan`
2. `terraform show -json tfplan` produces structured JSON
3. This action parses `resource_changes` — creates, updates, destroys, and replacements
4. For updates, it diffs `before` and `after` at the attribute level
5. It posts (or updates) a single PR comment identified by a hidden HTML marker

## Why not Atlantis / Spacelift / env0?

| | TF Plan Comment | Atlantis | Spacelift / env0 |
|---|---|---|---|
| Setup | Workflow YAML only | Self-hosted server | Paid platform + account |
| Cost | Free | Infra + maintenance | Per-seat pricing |
| Scope | PR plan comments | Full workflow engine | Full IaC platform |

This action fills the gap: **just the PR comment part**, done well.

## Pair with Infracost

This action shows *what* will change. [Infracost](https://www.infracost.io/) shows *what it costs*. They complement each other — use both in the same workflow.

## Development

```bash
npm install
npm test        # run tests
npm run build   # bundle to dist/index.js
npm run all     # lint + test + build
```

## License

MIT
