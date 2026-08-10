# Contributing

This project follows the implementation and review rules in [AGENTS.md](AGENTS.md). Read it before preparing commits or pull requests.

## Commit Messages

Commit messages must use this universal format:

```text
behavior(domain, domain): one-line summary

Detailed description paragraph.

* One-level bullet point.
* Another one-level bullet point.
```

The first line is required and has four parts:

- `behavior`: the kind of change, written as a short lowercase verb or category.
- `(domain, domain)`: one or more affected domains, separated by English comma and space.
- `:`: an English colon followed by one space.
- `one-line summary`: a concise summary of the change.

Allowed first-line examples:

```text
fix(import, users): keep latest user profile during data restore
refactor(app, layout): move desktop and mobile views under app pages
docs(contributing): define commit and pull request rules
```

The detailed description after the first line is optional, but when present it must be plain text only.

Detailed descriptions must follow these rules:

- Do not use Markdown headings, tables, links, fenced code blocks, blockquotes, emphasis, or checkboxes.
- Use normal paragraphs separated by blank lines when prose is enough.
- Use only one-level bullet points when listing details.
- Do not use nested bullet points.
- Do not use numbered lists.
- Do not rely on Markdown formatting to explain structure.

## Pull Requests

Pull request descriptions must use Markdown and must be clearly structured with headings and sections.

Every pull request must include:

- What changed.
- Why the change is necessary.
- Whether the change introduces breaking API updates.
- What checks were completed.
- Whether TypeScript, Vue, CSS, storage, architecture, and presentation behavior were reviewed against [AGENTS.md](AGENTS.md).

Recommended pull request template:

```markdown
## Summary

Describe what changed.

## Reason

Explain why the change is necessary.

## Breaking API Updates

State whether there are breaking API changes. If there are none, write "None."

## Checks

- TypeScript checked against AGENTS.md.
- Vue structure checked against AGENTS.md.
- CSS ownership and selectors checked against AGENTS.md.
- Architecture and storage boundaries checked against AGENTS.md.
- Tests or build commands completed.
```

Do not merge a pull request until the required checks are complete or the remaining risk is explicitly documented.
