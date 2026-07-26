# Multi-project Evolution Workspace

The Evolution Workspace can operate more than one trusted local repository without accepting repository paths from the browser.

## Configuration

Copy `config/cyclewarden-projects.example.json` to a local file, update the paths, and point the web process at it:

```bash
CYCLEWARDEN_PROJECTS_FILE=/absolute/path/to/cyclewarden-projects.local.json
CYCLEWARDEN_WORKSPACE_ACTIONS=enabled
```

The registry format is:

```json
{
  "version": 1,
  "defaultProjectId": "cyclewarden",
  "projects": [
    {
      "id": "cyclewarden",
      "label": "CycleWarden",
      "projectRoot": "/absolute/path/to/cyclewarden",
      "stateRoot": "/absolute/path/to/cyclewarden/.cyclewarden"
    }
  ]
}
```

Project IDs are safe selectors, not paths. For every read or mutation, the server reloads the registry, validates the selected ID, canonicalizes the configured repository path, rejects filesystem roots, and supplies the configured state root to the official Evolution Core CLI.

Each project must have its own `stateRoot`. Sharing a state root mixes cycle namespaces, so duplicate configured state roots are rejected.

## Backward compatibility

When `CYCLEWARDEN_PROJECTS_FILE` is absent, the workspace preserves the existing single-project configuration:

```bash
CYCLEWARDEN_PROJECT_ROOT=/absolute/path/to/a/trusted/repository
CYCLEWARDEN_STATE_ROOT=/absolute/path/to/.cyclewarden
CYCLEWARDEN_PROJECT_LABEL=My project
```

## Current boundary

This slice applies to the bounded A2 Evolution Workspace. It does not expose browser-controlled repository paths, delivery manifest authoring, implementation execution, verification acceptance, publication, merge, deployment, production writes, or remote sandbox authority.
