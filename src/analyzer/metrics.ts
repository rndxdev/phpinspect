import type { ParsedClass, ProjectMetrics } from "../types.js";

export function computeMetrics(classes: ParsedClass[]): ProjectMetrics {
  const classMap = new Map(classes.map((c) => [c.name, c]));

  const totalClasses = classes.filter((c) => c.kind === "class" || c.kind === "abstract").length;
  const totalInterfaces = classes.filter((c) => c.kind === "interface").length;
  const totalTraits = classes.filter((c) => c.kind === "trait").length;

  const allMethods = classes.flatMap((c) => c.methods);
  const allProperties = classes.flatMap((c) => c.properties);

  const classesWithMembers = classes.filter(
    (c) => c.kind === "class" || c.kind === "abstract"
  );

  const avgMethodsPerClass =
    classesWithMembers.length > 0
      ? allMethods.length / classesWithMembers.length
      : 0;

  const avgPropertiesPerClass =
    classesWithMembers.length > 0
      ? allProperties.length / classesWithMembers.length
      : 0;

  const maxInheritanceDepth = computeMaxInheritanceDepth(classes, classMap);

  const avgCyclomaticComplexity =
    allMethods.length > 0
      ? allMethods.reduce((sum, m) => sum + m.cyclomaticComplexity, 0) / allMethods.length
      : 0;

  return {
    totalClasses,
    totalInterfaces,
    totalTraits,
    totalMethods: allMethods.length,
    totalProperties: allProperties.length,
    avgMethodsPerClass: Math.round(avgMethodsPerClass * 10) / 10,
    avgPropertiesPerClass: Math.round(avgPropertiesPerClass * 10) / 10,
    maxInheritanceDepth,
    avgCyclomaticComplexity: Math.round(avgCyclomaticComplexity * 10) / 10,
  };
}

function computeMaxInheritanceDepth(
  classes: ParsedClass[],
  classMap: Map<string, ParsedClass>
): number {
  let maxDepth = 0;

  for (const cls of classes) {
    let depth = 0;
    let current: ParsedClass | undefined = cls;
    const visited = new Set<string>();

    while (current?.extends) {
      if (visited.has(current.name)) break; // circular reference protection
      visited.add(current.name);
      depth++;
      current = classMap.get(current.extends);
    }

    if (depth > maxDepth) maxDepth = depth;
  }

  return maxDepth;
}
