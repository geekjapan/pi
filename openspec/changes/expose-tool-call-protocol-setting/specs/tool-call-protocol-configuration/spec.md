## ADDED Requirements

### Requirement: CLI protocol selection

The coding-agent CLI SHALL accept `--tool-protocol native|text|auto` and reject other values with a diagnostic.

#### Scenario: Valid CLI protocol

- **WHEN** the user runs `pi --tool-protocol text`
- **THEN** the created agent session uses tool call protocol `text`

#### Scenario: Invalid CLI protocol

- **WHEN** the user passes an unsupported protocol value
- **THEN** the CLI reports a diagnostic and does not silently fall back to another protocol

### Requirement: Protocol precedence

The effective tool call protocol MUST be resolved with precedence CLI, then settings, then default `native`.

#### Scenario: CLI overrides settings

- **WHEN** settings specify `native` and CLI specifies `text`
- **THEN** the session uses `text`

### Requirement: Protocol documentation

The CLI help or documentation SHALL describe `native`, `text`, and `auto` and state that text protocol validation is not a sandbox.

#### Scenario: User reads help

- **WHEN** the user views CLI help or the relevant docs
- **THEN** the user can see how to enable text protocol and that isolated execution environments remain required for YOLO use

### Requirement: Manual text mode is end-to-end testable

After protocol configuration is exposed, a user MUST be able to start a session in explicit `text` protocol mode and exercise the existing parser/context conversion path without relying on auto detection.

#### Scenario: Explicit text mode session

- **WHEN** the user starts a session with `--tool-protocol text`
- **THEN** the session uses text protocol extraction and text protocol provider payload conversion
