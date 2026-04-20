export interface ParsedClass {
  name: string;
  file: string;
  line: number;
  kind: "class" | "interface" | "trait" | "abstract" | "enum";
  extends: string | null;
  implements: string[];
  uses: string[]; // traits
  properties: ParsedProperty[];
  methods: ParsedMethod[];
  constants: ParsedConstant[];
  isAbstract: boolean;
  isFinal: boolean;
  namespace: string | null;
}

export interface ParsedProperty {
  name: string;
  line: number;
  visibility: "public" | "protected" | "private";
  isStatic: boolean;
  type: string | null;
}

export interface ParsedMethod {
  name: string;
  line: number;
  visibility: "public" | "protected" | "private";
  isStatic: boolean;
  isAbstract: boolean;
  returnType: string | null;
  parameters: ParsedParameter[];
  lineCount: number;
  cyclomaticComplexity: number;
}

export interface ParsedParameter {
  name: string;
  type: string | null;
  hasDefault: boolean;
}

export interface ParsedConstant {
  name: string;
  line: number;
  visibility: "public" | "protected" | "private";
}

export interface CodeSmell {
  type: SmellType;
  severity: "info" | "warning" | "error";
  file: string;
  line: number;
  class: string;
  method?: string;
  message: string;
  suggestion: string;
}

export type SmellType =
  | "god-class"
  | "long-method"
  | "too-many-parameters"
  | "deep-inheritance"
  | "high-coupling"
  | "feature-envy"
  | "dead-code"
  | "missing-type-hints"
  | "violation-single-responsibility"
  | "violation-open-closed"
  | "violation-liskov"
  | "violation-interface-segregation"
  | "violation-dependency-inversion"
  | "empty-catch"
  | "god-method"
  | "excessive-comments";

export interface AnalysisReport {
  scannedFiles: number;
  classes: ParsedClass[];
  smells: CodeSmell[];
  metrics: ProjectMetrics;
  uml: string;
}

export interface ProjectMetrics {
  totalClasses: number;
  totalInterfaces: number;
  totalTraits: number;
  totalMethods: number;
  totalProperties: number;
  avgMethodsPerClass: number;
  avgPropertiesPerClass: number;
  maxInheritanceDepth: number;
  avgCyclomaticComplexity: number;
}
