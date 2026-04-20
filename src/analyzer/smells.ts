import type { ParsedClass, CodeSmell } from "../types.js";

// Configurable thresholds
const THRESHOLDS = {
  godClassMethods: 15,
  godClassProperties: 15,
  longMethodLines: 30,
  tooManyParams: 5,
  maxInheritanceDepth: 3,
  highCouplingDeps: 8,
  highCyclomaticComplexity: 10,
};

export function detectSmells(classes: ParsedClass[]): CodeSmell[] {
  const smells: CodeSmell[] = [];
  const classMap = new Map(classes.map((c) => [c.name, c]));

  for (const cls of classes) {
    if (cls.kind === "interface") continue; // interfaces aren't smelly in the same way

    smells.push(...detectGodClass(cls));
    smells.push(...detectLongMethods(cls));
    smells.push(...detectTooManyParameters(cls));
    smells.push(...detectDeepInheritance(cls, classMap));
    smells.push(...detectHighCoupling(cls, classes));
    smells.push(...detectMissingTypeHints(cls));
    smells.push(...detectHighComplexity(cls));
  }

  return smells;
}

function detectGodClass(cls: ParsedClass): CodeSmell[] {
  const smells: CodeSmell[] = [];
  const methodCount = cls.methods.length;
  const propCount = cls.properties.length;

  if (methodCount > THRESHOLDS.godClassMethods && propCount > THRESHOLDS.godClassProperties) {
    smells.push({
      type: "god-class",
      severity: "error",
      file: cls.file,
      line: cls.line,
      class: cls.name,
      message: `Class "${cls.name}" has ${methodCount} methods and ${propCount} properties — likely doing too much.`,
      suggestion: `Split into smaller, focused classes. Identify distinct responsibilities and extract them into separate classes using composition.`,
    });
  } else if (methodCount > THRESHOLDS.godClassMethods) {
    smells.push({
      type: "god-class",
      severity: "warning",
      file: cls.file,
      line: cls.line,
      class: cls.name,
      message: `Class "${cls.name}" has ${methodCount} methods — consider splitting.`,
      suggestion: `Group related methods and extract them into dedicated classes. Use traits only if the behavior is truly reusable across unrelated classes.`,
    });
  }

  return smells;
}

function detectLongMethods(cls: ParsedClass): CodeSmell[] {
  const smells: CodeSmell[] = [];

  for (const method of cls.methods) {
    if (method.lineCount > THRESHOLDS.longMethodLines) {
      smells.push({
        type: "long-method",
        severity: method.lineCount > THRESHOLDS.longMethodLines * 2 ? "error" : "warning",
        file: cls.file,
        line: method.line,
        class: cls.name,
        method: method.name,
        message: `Method "${cls.name}::${method.name}" is ${method.lineCount} lines long.`,
        suggestion: `Extract logical blocks into well-named private methods. Look for comment blocks — they often indicate extraction points.`,
      });
    }
  }

  return smells;
}

function detectTooManyParameters(cls: ParsedClass): CodeSmell[] {
  const smells: CodeSmell[] = [];

  for (const method of cls.methods) {
    if (method.parameters.length > THRESHOLDS.tooManyParams) {
      smells.push({
        type: "too-many-parameters",
        severity: method.parameters.length > THRESHOLDS.tooManyParams * 2 ? "error" : "warning",
        file: cls.file,
        line: method.line,
        class: cls.name,
        method: method.name,
        message: `Method "${cls.name}::${method.name}" has ${method.parameters.length} parameters.`,
        suggestion: `Create a parameter object (DTO/value object) to group related parameters. Consider using the Builder pattern for complex construction.`,
      });
    }
  }

  return smells;
}

function detectDeepInheritance(
  cls: ParsedClass,
  classMap: Map<string, ParsedClass>
): CodeSmell[] {
  const smells: CodeSmell[] = [];
  let depth = 0;
  let current: ParsedClass | undefined = cls;

  while (current?.extends) {
    depth++;
    current = classMap.get(current.extends);
    if (depth > 20) break; // prevent infinite loops from circular refs
  }

  if (depth > THRESHOLDS.maxInheritanceDepth) {
    smells.push({
      type: "deep-inheritance",
      severity: depth > THRESHOLDS.maxInheritanceDepth + 2 ? "error" : "warning",
      file: cls.file,
      line: cls.line,
      class: cls.name,
      message: `Class "${cls.name}" has inheritance depth of ${depth}.`,
      suggestion: `Prefer composition over inheritance. Extract shared behavior into traits or injected services instead of deep class hierarchies.`,
    });
  }

  return smells;
}

function detectHighCoupling(cls: ParsedClass, allClasses: ParsedClass[]): CodeSmell[] {
  const smells: CodeSmell[] = [];
  const dependencies = new Set<string>();

  // Count type references in properties and method signatures
  for (const prop of cls.properties) {
    if (prop.type && isClassReference(prop.type, allClasses)) {
      dependencies.add(prop.type);
    }
  }
  for (const method of cls.methods) {
    if (method.returnType && isClassReference(method.returnType, allClasses)) {
      dependencies.add(method.returnType);
    }
    for (const param of method.parameters) {
      if (param.type && isClassReference(param.type, allClasses)) {
        dependencies.add(param.type);
      }
    }
  }

  if (dependencies.size > THRESHOLDS.highCouplingDeps) {
    smells.push({
      type: "high-coupling",
      severity: "warning",
      file: cls.file,
      line: cls.line,
      class: cls.name,
      message: `Class "${cls.name}" depends on ${dependencies.size} other classes.`,
      suggestion: `Introduce interfaces to decouple dependencies. Apply Dependency Inversion — depend on abstractions, not concretions.`,
    });
  }

  return smells;
}

function detectMissingTypeHints(cls: ParsedClass): CodeSmell[] {
  const smells: CodeSmell[] = [];
  let untypedCount = 0;
  const total = cls.methods.length;

  for (const method of cls.methods) {
    if (!method.returnType && method.name !== "__construct") {
      untypedCount++;
    }
  }

  if (total > 3 && untypedCount / total > 0.5) {
    smells.push({
      type: "missing-type-hints",
      severity: "info",
      file: cls.file,
      line: cls.line,
      class: cls.name,
      message: `Class "${cls.name}" has ${untypedCount}/${total} methods without return type hints.`,
      suggestion: `Add return type declarations to improve IDE support, catch bugs early, and make the code self-documenting.`,
    });
  }

  return smells;
}

function detectHighComplexity(cls: ParsedClass): CodeSmell[] {
  const smells: CodeSmell[] = [];

  for (const method of cls.methods) {
    if (method.cyclomaticComplexity > THRESHOLDS.highCyclomaticComplexity) {
      smells.push({
        type: "god-method",
        severity: method.cyclomaticComplexity > THRESHOLDS.highCyclomaticComplexity * 2 ? "error" : "warning",
        file: cls.file,
        line: method.line,
        class: cls.name,
        method: method.name,
        message: `Method "${cls.name}::${method.name}" has cyclomatic complexity of ${method.cyclomaticComplexity}.`,
        suggestion: `Reduce branching by extracting conditions into well-named methods, using early returns, or applying the Strategy pattern for complex switch statements.`,
      });
    }
  }

  return smells;
}

function isClassReference(typeName: string, allClasses: ParsedClass[]): boolean {
  const builtins = new Set([
    "string", "int", "float", "bool", "array", "object", "void",
    "null", "mixed", "self", "static", "parent", "callable", "iterable", "never",
  ]);
  const cleaned = typeName.replace(/^\?/, "");
  if (builtins.has(cleaned.toLowerCase())) return false;
  return allClasses.some((c) => c.name === cleaned);
}
