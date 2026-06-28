# GitHub Actions Inventory

Status: GitHub Actions are disabled in the repository settings as of 2026-06-28.

Review these workflows before re-enabling Actions:

| Workflow | File | Trigger | Review note |
| --- | --- | --- | --- |
| Approve Contributor | `.github/workflows/approve-contributor.yml` | `issue_comment` | Writes `.github/APPROVED_CONTRIBUTORS` and issues. |
| Build Binaries | `.github/workflows/build-binaries.yml` | tag push, `workflow_dispatch` | Builds release artifacts and publishes GitHub releases. |
| CI | `.github/workflows/ci.yml` | `push`, `pull_request` | Runs build, checks, and tests. |
| Issue Gate | `.github/workflows/issue-gate.yml` | `issues` opened | Writes issue state for contributor gating. |
| Issue Triage Labels | `.github/workflows/issue-triage-labels.yml` | `issues` reopened/labeled | Mutates issue labels. |
| npm audit | `.github/workflows/npm-audit.yml` | schedule, `workflow_dispatch` | Runs npm audit and signature checks. |
| PR Gate | `.github/workflows/pr-gate.yml` | `pull_request_target` opened | Security-sensitive; writes issues and pull requests. |
| Remove In Progress Label On Close | `.github/workflows/remove-inprogress-on-close.yml` | `issues` closed | Mutates issue labels. |

Do not re-enable Actions until ownership, secrets, permissions, release targets,
and public/private visibility are reviewed.
