import type { ParsedClass } from "../types.js";

export function generateMermaidUml(classes: ParsedClass[]): string {
  const lines: string[] = ["classDiagram"];
  const classNames = new Set(classes.map((c) => c.name));

  for (const cls of classes) {
    // Class definition
    const stereotype = getStereotype(cls);
    if (stereotype) {
      lines.push(`  class ${sanitizeName(cls.name)} {`);
      lines.push(`    <<${stereotype}>>`);
    } else {
      lines.push(`  class ${sanitizeName(cls.name)} {`);
    }

    // Properties
    for (const prop of cls.properties) {
      const vis = visibilitySymbol(prop.visibility);
      const typeStr = prop.type ? `: ${prop.type}` : "";
      const staticMark = prop.isStatic ? "$ " : "";
      lines.push(`    ${vis}${staticMark}${prop.name}${typeStr}`);
    }

    // Methods
    for (const method of cls.methods) {
      const vis = visibilitySymbol(method.visibility);
      const params = method.parameters
        .map((p) => (p.type ? `${p.type} ${p.name}` : p.name))
        .join(", ");
      const ret = method.returnType ? `: ${method.returnType}` : "";
      const staticMark = method.isStatic ? "$ " : "";
      const abstractMark = method.isAbstract ? "* " : "";
      lines.push(`    ${vis}${staticMark}${abstractMark}${method.name}(${params})${ret}`);
    }

    lines.push("  }");
  }

  // Relationships
  for (const cls of classes) {
    const safeName = sanitizeName(cls.name);

    if (cls.extends && classNames.has(cls.extends)) {
      lines.push(`  ${sanitizeName(cls.extends)} <|-- ${safeName}`);
    }

    for (const iface of cls.implements) {
      if (classNames.has(iface)) {
        lines.push(`  ${sanitizeName(iface)} <|.. ${safeName}`);
      }
    }

    for (const trait of cls.uses) {
      if (classNames.has(trait)) {
        lines.push(`  ${sanitizeName(trait)} <.. ${safeName} : uses`);
      }
    }
  }

  return lines.join("\n");
}

function getStereotype(cls: ParsedClass): string | null {
  switch (cls.kind) {
    case "interface":
      return "interface";
    case "abstract":
      return "abstract";
    case "trait":
      return "trait";
    case "enum":
      return "enumeration";
    default:
      return null;
  }
}

function visibilitySymbol(vis: "public" | "protected" | "private"): string {
  switch (vis) {
    case "public":
      return "+";
    case "protected":
      return "#";
    case "private":
      return "-";
  }
}

function sanitizeName(name: string): string {
  // Mermaid doesn't like special chars in class names
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}
