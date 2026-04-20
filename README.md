# phpinspect

Offline PHP OOP code analyzer. Detects code smells, generates UML class diagrams, and suggests refactoring — all without leaving your terminal.

## Install

```bash
# No sudo needed — installs to your user space
npm install -g phpinspect

# Or run without installing
npx phpinspect ./src
```

## Usage

```bash
phpinspect <directory> [options]
```

### Options

| Flag | Description |
|------|-------------|
| `--uml [file]` | Export Mermaid UML class diagram |
| `--json [file]` | Export full JSON report |
| `--laravel` | Force Laravel-specific analysis (auto-detected) |
| `--strict` | Exit code 1 if errors found (CI-friendly) |
| `--quiet, -q` | Suppress terminal output |
| `--help, -h` | Show help |
| `--version, -v` | Show version |

### Examples

```bash
# Basic scan
phpinspect ./src

# Generate UML diagram
phpinspect ./app --uml class-diagram.mmd

# CI pipeline
phpinspect ./src --strict --json report.json

# Laravel project (auto-detected if artisan exists)
phpinspect ./app --laravel
```

## What It Detects

### General OOP Smells
- God classes (too many methods/properties)
- Long methods (>30 lines)
- Too many parameters (>5)
- Deep inheritance chains (>3 levels)
- High coupling between classes
- Missing return type hints
- High cyclomatic complexity

### Laravel-Specific (auto-detected)
- Fat controllers (too many actions, complex action methods)
- Missing FormRequest classes
- Business logic in Eloquent models
- Potential N+1 queries
- Raw SQL without parameter binding
- Mass assignment risks (empty $guarded)

## UML Output

Generates [Mermaid](https://mermaid.js.org/) class diagrams showing:
- Class/interface/trait/enum definitions
- Properties with visibility and types
- Methods with signatures
- Inheritance, implementation, and trait relationships

View the `.mmd` file in VS Code (Mermaid extension), GitHub markdown, or any Mermaid renderer.

## Security

- **100% offline** — zero network calls, zero telemetry
- **Read-only** — never modifies your source files
- **No code execution** — PHP is parsed as text (AST), never evaluated
- **Zero transitive dependencies** — minimal attack surface
- **Symlink-safe** — resolves real paths, ignores symlinks during scan
- **No secrets** — never reads .env, credentials, or config values

## License

MIT
