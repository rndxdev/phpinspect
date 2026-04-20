import * as fs from "node:fs";
import type { ParsedClass, CodeSmell } from "../types.js";

const LARAVEL_CONTROLLER_THRESHOLD = 30; // lines per action method
const LARAVEL_MODEL_LOGIC_KEYWORDS = [
  "if", "foreach", "for", "while", "switch", "try",
];

export function detectLaravelSmells(classes: ParsedClass[]): CodeSmell[] {
  const smells: CodeSmell[] = [];

  for (const cls of classes) {
    smells.push(...detectFatController(cls));
    smells.push(...detectMissingFormRequest(cls));
    smells.push(...detectBusinessLogicInModel(cls));
    smells.push(...detectNPlusOneHints(cls));
    smells.push(...detectRawQueries(cls));
    smells.push(...detectMassAssignmentRisk(cls));
  }

  return smells;
}

function detectFatController(cls: ParsedClass): CodeSmell[] {
  const smells: CodeSmell[] = [];

  if (!isController(cls)) return smells;

  const actionMethods = cls.methods.filter(
    (m) => m.visibility === "public" && m.name !== "__construct"
  );

  // Fat controller: too many actions
  if (actionMethods.length > 7) {
    smells.push({
      type: "violation-single-responsibility",
      severity: "warning",
      file: cls.file,
      line: cls.line,
      class: cls.name,
      message: `Controller "${cls.name}" has ${actionMethods.length} public actions — likely handling too many responsibilities.`,
      suggestion: `Split into focused resource controllers. Laravel supports single-action controllers (__invoke) for one-off actions. Group related endpoints.`,
    });
  }

  // Controller doing too much work per action (already caught by long-method but this adds Laravel context)
  for (const method of actionMethods) {
    if (method.lineCount > LARAVEL_CONTROLLER_THRESHOLD && method.cyclomaticComplexity > 5) {
      smells.push({
        type: "violation-single-responsibility",
        severity: "warning",
        file: cls.file,
        line: method.line,
        class: cls.name,
        method: method.name,
        message: `Controller action "${cls.name}::${method.name}" has ${method.lineCount} lines and complexity of ${method.cyclomaticComplexity} — business logic should be in a Service class.`,
        suggestion: `Extract business logic into a dedicated Service or Action class (e.g., ${cls.name.replace("Controller", "")}Service). Controllers should only handle HTTP concerns: validate, delegate, respond.`,
      });
    }
  }

  return smells;
}

function detectMissingFormRequest(cls: ParsedClass): CodeSmell[] {
  const smells: CodeSmell[] = [];

  if (!isController(cls)) return smells;

  // Check if controller methods accept generic Request instead of FormRequest
  const storeOrUpdate = cls.methods.filter(
    (m) => ["store", "update", "save", "create"].includes(m.name) && m.visibility === "public"
  );

  for (const method of storeOrUpdate) {
    const hasGenericRequest = method.parameters.some(
      (p) => p.type === "Request" || p.type === "\\Illuminate\\Http\\Request"
    );

    if (hasGenericRequest && method.lineCount > 15) {
      smells.push({
        type: "violation-single-responsibility",
        severity: "info",
        file: cls.file,
        line: method.line,
        class: cls.name,
        method: method.name,
        message: `"${cls.name}::${method.name}" uses generic Request — consider a dedicated FormRequest for validation.`,
        suggestion: `Create a FormRequest class (php artisan make:request ${method.name.charAt(0).toUpperCase() + method.name.slice(1)}Request). Moves validation out of the controller, makes rules reusable, and enables automatic 422 responses.`,
      });
    }
  }

  return smells;
}

function detectBusinessLogicInModel(cls: ParsedClass): CodeSmell[] {
  const smells: CodeSmell[] = [];

  if (!isModel(cls)) return smells;

  // Models with complex methods (high cyclomatic complexity) likely have business logic
  const complexMethods = cls.methods.filter(
    (m) =>
      m.cyclomaticComplexity > 5 &&
      !isEloquentMethod(m.name) &&
      m.name !== "__construct"
  );

  for (const method of complexMethods) {
    smells.push({
      type: "violation-single-responsibility",
      severity: "warning",
      file: cls.file,
      line: method.line,
      class: cls.name,
      method: method.name,
      message: `Model "${cls.name}::${method.name}" has complexity of ${method.cyclomaticComplexity} — likely contains business logic that belongs in a Service.`,
      suggestion: `Move complex logic to a Service or Action class. Models should define relationships, scopes, accessors/mutators, and simple attribute logic — not orchestrate business rules.`,
    });
  }

  // Models with too many non-relationship methods
  const nonRelationMethods = cls.methods.filter(
    (m) => !isEloquentMethod(m.name) && m.visibility === "public" && m.name !== "__construct"
  );

  if (nonRelationMethods.length > 10) {
    smells.push({
      type: "god-class",
      severity: "warning",
      file: cls.file,
      line: cls.line,
      class: cls.name,
      message: `Model "${cls.name}" has ${nonRelationMethods.length} non-Eloquent public methods — becoming a god object.`,
      suggestion: `Extract domain logic into dedicated Service classes, use Traits for reusable scopes, and consider the Repository pattern for complex queries.`,
    });
  }

  return smells;
}

function detectNPlusOneHints(cls: ParsedClass): CodeSmell[] {
  const smells: CodeSmell[] = [];

  if (!isController(cls) && !isModel(cls)) return smells;

  // Read the actual file content to look for N+1 patterns
  let content: string;
  try {
    content = fs.readFileSync(cls.file, "utf-8");
  } catch {
    return smells;
  }

  // Pattern: looping and accessing relationships without eager loading
  // Look for foreach/for loops that contain -> relationship access patterns
  const lines = content.split("\n");
  const foreachPattern = /foreach\s*\(\s*\$\w+\s+as/;
  const relationAccessPattern = /\$\w+->\w+(?:->|\()/;

  for (let i = 0; i < lines.length; i++) {
    if (foreachPattern.test(lines[i])) {
      // Check next 10 lines for relationship access
      const block = lines.slice(i, i + 10).join("\n");
      if (
        relationAccessPattern.test(block) &&
        !block.includes("->load(") &&
        !block.includes("::with(")
      ) {
        // Only flag in controllers where queries are likely
        if (isController(cls)) {
          smells.push({
            type: "high-coupling",
            severity: "info",
            file: cls.file,
            line: i + 1,
            class: cls.name,
            message: `Potential N+1 query in "${cls.name}" at line ${i + 1} — relationship accessed inside a loop.`,
            suggestion: `Use eager loading: ->with(['relation']) on the query, or ->load('relation') before the loop. Check with Laravel Debugbar or telescope.`,
          });
          break; // One warning per class is enough
        }
      }
    }
  }

  return smells;
}

function detectRawQueries(cls: ParsedClass): CodeSmell[] {
  const smells: CodeSmell[] = [];

  let content: string;
  try {
    content = fs.readFileSync(cls.file, "utf-8");
  } catch {
    return smells;
  }

  const lines = content.split("\n");
  const rawPatterns = [
    /DB::raw\(/,
    /DB::select\(/,
    /DB::statement\(/,
    /->selectRaw\(/,
    /->whereRaw\(/,
    /->havingRaw\(/,
    /->orderByRaw\(/,
  ];

  for (let i = 0; i < lines.length; i++) {
    for (const pattern of rawPatterns) {
      if (pattern.test(lines[i])) {
        // Check if it contains string concatenation (SQL injection risk)
        if (lines[i].includes("$") && (lines[i].includes(".") || lines[i].includes('"'))) {
          smells.push({
            type: "violation-dependency-inversion",
            severity: "error",
            file: cls.file,
            line: i + 1,
            class: cls.name,
            message: `Potential SQL injection at line ${i + 1} — raw query with variable interpolation.`,
            suggestion: `Use parameter binding: DB::raw('query WHERE col = ?', [$var]) or Eloquent query builder methods. Never concatenate user input into raw SQL.`,
          });
          return smells; // One per class
        }

        smells.push({
          type: "violation-dependency-inversion",
          severity: "info",
          file: cls.file,
          line: i + 1,
          class: cls.name,
          message: `Raw SQL query at line ${i + 1} in "${cls.name}" — ensure parameter binding is used.`,
          suggestion: `Prefer Eloquent query builder for maintainability. If raw SQL is needed, always use parameter binding (? placeholders) to prevent SQL injection.`,
        });
        return smells;
      }
    }
  }

  return smells;
}

function detectMassAssignmentRisk(cls: ParsedClass): CodeSmell[] {
  const smells: CodeSmell[] = [];

  if (!isModel(cls)) return smells;

  let content: string;
  try {
    content = fs.readFileSync(cls.file, "utf-8");
  } catch {
    return smells;
  }

  // Check for $guarded = [] (allows everything) without $fillable
  if (content.includes("$guarded") && content.includes("[]")) {
    if (!content.includes("$fillable")) {
      smells.push({
        type: "violation-open-closed",
        severity: "warning",
        file: cls.file,
        line: cls.line,
        class: cls.name,
        message: `Model "${cls.name}" uses empty $guarded — all attributes are mass-assignable.`,
        suggestion: `Use $fillable to explicitly whitelist assignable attributes instead of $guarded = []. This prevents accidentally exposing sensitive fields (is_admin, role, etc.) to mass assignment.`,
      });
    }
  }

  return smells;
}

// --- Helpers ---

function isController(cls: ParsedClass): boolean {
  return (
    cls.name.endsWith("Controller") ||
    cls.extends === "Controller" ||
    cls.file.includes("/Controllers/")
  );
}

function isModel(cls: ParsedClass): boolean {
  return (
    cls.file.includes("/Models/") ||
    cls.extends === "Model" ||
    cls.extends === "Authenticatable"
  );
}

function isEloquentMethod(name: string): string | false | boolean {
  const eloquentMethods = new Set([
    "scopeActive", "booted", "boot", "creating", "created",
    "updating", "updated", "deleting", "deleted", "saving", "saved",
    "casts", "getRouteKeyName",
  ]);

  // Relationships
  if (["belongsTo", "hasMany", "hasOne", "belongsToMany", "morphTo", "morphMany"].some(
    (r) => name.includes(r)
  )) return true;

  // Scopes start with "scope"
  if (name.startsWith("scope")) return true;

  // Accessors/mutators: get*Attribute, set*Attribute
  if (name.startsWith("get") && name.endsWith("Attribute")) return true;
  if (name.startsWith("set") && name.endsWith("Attribute")) return true;

  return eloquentMethods.has(name);
}
