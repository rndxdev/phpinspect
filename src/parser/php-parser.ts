import * as fs from "node:fs";
import * as path from "node:path";
import phpParser from "php-parser";
import type { ParsedClass, ParsedMethod, ParsedParameter, ParsedProperty, ParsedConstant } from "../types.js";

const Engine = (phpParser as any).Engine || (phpParser as any);

const engine = new Engine({
  parser: {
    extractDoc: true,
    php7: true,
    php8: true,
    suppressErrors: true,
  },
  ast: {
    withPositions: true,
    withSource: false,
  },
});

export function parsePhpFile(filePath: string): ParsedClass[] {
  const content = fs.readFileSync(filePath, "utf-8");
  let ast: any;
  try {
    ast = engine.parseCode(content, path.basename(filePath));
  } catch {
    return [];
  }

  const classes: ParsedClass[] = [];
  let currentNamespace: string | null = null;

  visitNode(ast, classes, filePath, currentNamespace);
  return classes;
}

function visitNode(
  node: any,
  classes: ParsedClass[],
  filePath: string,
  namespace: string | null
): void {
  if (!node || typeof node !== "object") return;

  if (node.kind === "namespace") {
    namespace = typeof node.name === "string" ? node.name : node.name?.name ?? null;
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        visitNode(child, classes, filePath, namespace);
      }
    }
    return;
  }

  if (
    node.kind === "class" ||
    node.kind === "interface" ||
    node.kind === "trait" ||
    node.kind === "enum"
  ) {
    classes.push(extractClass(node, filePath, namespace));
  }

  // Recurse into children/body
  for (const key of ["children", "body"]) {
    if (Array.isArray(node[key])) {
      for (const child of node[key]) {
        visitNode(child, classes, filePath, namespace);
      }
    }
  }
}

function extractClass(node: any, filePath: string, namespace: string | null): ParsedClass {
  const name: string = typeof node.name === "string" ? node.name : node.name?.name ?? "Anonymous";
  let kind: ParsedClass["kind"] = node.kind;
  if (node.kind === "class" && node.isAbstract) kind = "abstract";

  const extendsName = resolveIdentifier(node.extends);
  const implementsList: string[] = Array.isArray(node.implements)
    ? node.implements.map(resolveIdentifier).filter(Boolean) as string[]
    : [];

  const usesList: string[] = [];
  const properties: ParsedProperty[] = [];
  const methods: ParsedMethod[] = [];
  const constants: ParsedConstant[] = [];

  const body: any[] = Array.isArray(node.body) ? node.body : [];

  for (const member of body) {
    if (!member) continue;

    if (member.kind === "traituse") {
      if (Array.isArray(member.traits)) {
        for (const t of member.traits) {
          const traitName = resolveIdentifier(t);
          if (traitName) usesList.push(traitName);
        }
      }
    } else if (member.kind === "propertystatement" || member.kind === "property") {
      const props = member.kind === "propertystatement"
        ? (Array.isArray(member.properties) ? member.properties : [member])
        : [member];
      for (const p of props) {
        properties.push({
          name: typeof p.name === "string" ? p.name : p.name?.name ?? "unknown",
          line: p.loc?.start?.line ?? member.loc?.start?.line ?? 0,
          visibility: resolveVisibility(member.visibility ?? p.visibility),
          isStatic: !!(member.isStatic ?? p.isStatic),
          type: resolveTypeAnnotation(member.type ?? p.type),
        });
      }
    } else if (member.kind === "method") {
      methods.push(extractMethod(member));
    } else if (member.kind === "classconstant") {
      const constName = typeof member.name === "string"
        ? member.name
        : member.name?.name ?? "UNKNOWN";
      constants.push({
        name: constName,
        line: member.loc?.start?.line ?? 0,
        visibility: resolveVisibility(member.visibility),
      });
    }
  }

  return {
    name,
    file: filePath,
    line: node.loc?.start?.line ?? 0,
    kind,
    extends: extendsName,
    implements: implementsList,
    uses: usesList,
    properties,
    methods,
    constants,
    isAbstract: !!node.isAbstract,
    isFinal: !!node.isFinal,
    namespace,
  };
}

function extractMethod(node: any): ParsedMethod {
  const name = typeof node.name === "string" ? node.name : node.name?.name ?? "unknown";
  const parameters: ParsedParameter[] = [];

  if (Array.isArray(node.arguments)) {
    for (const arg of node.arguments) {
      parameters.push({
        name: typeof arg.name === "string" ? arg.name : arg.name?.name ?? "unknown",
        type: resolveTypeAnnotation(arg.type),
        hasDefault: arg.value !== null && arg.value !== undefined,
      });
    }
  }

  const startLine = node.loc?.start?.line ?? 0;
  const endLine = node.loc?.end?.line ?? startLine;
  const lineCount = Math.max(1, endLine - startLine + 1);

  return {
    name,
    line: startLine,
    visibility: resolveVisibility(node.visibility),
    isStatic: !!node.isStatic,
    isAbstract: !!node.isAbstract,
    returnType: resolveTypeAnnotation(node.type),
    parameters,
    lineCount,
    cyclomaticComplexity: computeCyclomaticComplexity(node.body),
  };
}

function computeCyclomaticComplexity(node: any): number {
  if (!node || typeof node !== "object") return 1;

  let complexity = 1;
  const queue: any[] = [node];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current || typeof current !== "object") continue;

    const branchKinds = new Set([
      "if", "elseif", "case", "catch", "while", "for", "foreach",
      "do", "ternary", "nullcoalesce", "and", "or",
    ]);

    if (typeof current.kind === "string" && branchKinds.has(current.kind)) {
      complexity++;
    }

    // Also count logical operators
    if (current.kind === "bin" && (current.type === "&&" || current.type === "||")) {
      complexity++;
    }

    for (const key of Object.keys(current)) {
      if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
      const val = current[key];
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item && typeof item === "object") queue.push(item);
        }
      } else if (val && typeof val === "object" && val.kind) {
        queue.push(val);
      }
    }
  }

  return complexity;
}

function resolveIdentifier(node: any): string | null {
  if (!node) return null;
  if (typeof node === "string") return node;
  if (node.kind === "identifier" || node.kind === "name") {
    return typeof node.name === "string" ? node.name : node.name?.name ?? null;
  }
  if (node.kind === "classreference") return node.resolution ?? node.name ?? null;
  return node.name ?? null;
}

function resolveTypeAnnotation(node: any): string | null {
  if (!node) return null;
  if (typeof node === "string") return node;
  if (node.kind === "identifier" || node.kind === "name" || node.kind === "typereference") {
    return typeof node.name === "string" ? node.name : null;
  }
  if (node.kind === "uniontype" && Array.isArray(node.types)) {
    return node.types.map(resolveTypeAnnotation).filter(Boolean).join("|");
  }
  if (node.kind === "intersectiontype" && Array.isArray(node.types)) {
    return node.types.map(resolveTypeAnnotation).filter(Boolean).join("&");
  }
  if (node.kind === "nullabletype" && node.type) {
    const inner = resolveTypeAnnotation(node.type);
    return inner ? `?${inner}` : null;
  }
  return node.name ?? null;
}

function resolveVisibility(vis: any): "public" | "protected" | "private" {
  if (typeof vis === "string") {
    if (vis === "protected") return "protected";
    if (vis === "private") return "private";
    return "public";
  }
  return "public";
}
