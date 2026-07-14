function valuesFrom(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => typeof item === "string" ? item : item?.path).filter(Boolean);
}

const surfaceOrder = [
  "backend-api",
  "dashboard-ui",
  "api-client",
  "public-api",
  "database",
  "tests"
];

function uniqueValues(values) {
  return [...new Set(values)].sort((left, right) => surfaceOrder.indexOf(left) - surfaceOrder.indexOf(right));
}

function detectTaskSurfaces(task) {
  const normalized = String(task ?? "").toLowerCase();
  const surfaces = [];
  const add = (surface) => {
    if (!surfaces.includes(surface)) {
      surfaces.push(surface);
    }
  };

  if (/\b(api|backend|endpoint|route|routes|service|server|authenticated|internal)\b/.test(normalized)) {
    add("backend-api");
  }
  if (/\b(dashboard|ui|frontend|settings|screen|page|component|tsx|client-side)\b/.test(normalized)) {
    add("dashboard-ui");
  }
  if (/\b(client|sdk|fetch|api client)\b/.test(normalized)) {
    add("api-client");
  }
  if (/\b(public|widget|contract|unchanged|external)\b/.test(normalized)) {
    add("public-api");
  }
  if (/\b(database|schema|migration|migrations|table|db)\b/.test(normalized)) {
    add("database");
  }
  if (/\b(test|tests|spec|coverage)\b/.test(normalized)) {
    add("tests");
  }

  return surfaces;
}

function surfaceForPath(filePath) {
  const normalized = String(filePath ?? "").replace(/\\/g, "/").toLowerCase();
  const segments = normalized.split(/[\/.\-_]+/).filter(Boolean);
  const basename = normalized.split("/").pop() ?? normalized;

  if (/\b(test|spec)\b/i.test(basename) || /(^|\/)(tests?|__tests__)\//.test(normalized)) {
    return "tests";
  }
  if (segments.some((segment) => ["migration", "migrations", "schema", "schemas", "database", "db"].includes(segment))) {
    return "database";
  }
  if (segments.includes("public") || segments.includes("widget") || /public[.-]/i.test(basename)) {
    return "public-api";
  }
  if (
    /^client\.[cm]?[jt]sx?$/i.test(basename)
    || /^api-client\.[cm]?[jt]sx?$/i.test(basename)
    || segments.includes("sdk")
    || (segments.includes("client") && segments.includes("api"))
  ) {
    return "api-client";
  }
  if (
    normalized.startsWith("apps/dashboard/")
    || segments.some((segment) => ["dashboard", "frontend", "settings", "ui", "component", "components", "page", "pages"].includes(segment))
    || /\.[cm]?tsx$/i.test(basename)
  ) {
    return "dashboard-ui";
  }
  if (
    normalized.startsWith("apps/api/")
    || segments.some((segment) => ["api", "backend", "controller", "controllers", "route", "routes", "service", "services", "server"].includes(segment))
  ) {
    return "backend-api";
  }

  return null;
}

function surfaceSummary(route, routingCase) {
  const detected = uniqueValues(routingCase.expect?.detectedSurfaces ?? detectTaskSurfaces(routingCase.task));
  const primary = valuesFrom(route.primaryFiles);
  const supporting = valuesFrom(route.supportingFiles);
  const tests = valuesFrom(route.tests);
  const covered = uniqueValues([
    ...primary,
    ...supporting,
    ...tests
  ].map(surfaceForPath).filter(Boolean));
  const missing = detected.filter((surface) => !covered.includes(surface));

  return { detected, covered, missing };
}

function pathMatches(actualPath, expectedPath) {
  return actualPath === expectedPath || actualPath.startsWith(expectedPath);
}

function pathsWithPrefix(actualPaths, prefixes = []) {
  return prefixes.flatMap((prefix) => actualPaths.filter((actualPath) => actualPath.startsWith(prefix)));
}

function missingExpected(actualPaths, expectedPaths = []) {
  return expectedPaths.filter((expectedPath) => !actualPaths.some((actualPath) => pathMatches(actualPath, expectedPath)));
}

function unexpectedPresent(actualPaths, expectedPaths = []) {
  return expectedPaths.filter((expectedPath) => actualPaths.some((actualPath) => pathMatches(actualPath, expectedPath)));
}

function routeSnapshot(route) {
  return {
    taskSize: route.taskSize,
    mode: route.mode,
    primaryFiles: valuesFrom(route.primaryFiles),
    supportingFiles: valuesFrom(route.supportingFiles),
    tests: valuesFrom(route.tests),
    readFirst: valuesFrom(route.readFirst),
    briefTokens: route.briefTokens
  };
}

function countFailure(label, actual, max) {
  return actual > max ? `${label} count ${actual} > ${max}` : null;
}

function evaluateRoutingCase(route, routingCase) {
  const expect = routingCase.expect ?? {};
  const primary = valuesFrom(route.primaryFiles);
  const supporting = valuesFrom(route.supportingFiles);
  const primaryOrSupporting = [...primary, ...supporting];
  const tests = valuesFrom(route.tests);
  const readFirst = valuesFrom(route.readFirst);
  const surfaces = surfaceSummary(route, routingCase);
  const failures = [
    ...missingExpected(primary, expect.primaryContains).map((file) => `missing primary ${file}`),
    ...unexpectedPresent(primary, expect.primaryNotContains).map((file) => `unexpected primary ${file}`),
    ...pathsWithPrefix(primary, expect.forbiddenPrimaryPrefixes).map((file) => `forbidden primary prefix matched ${file}`),
    ...missingExpected(supporting, expect.supportingContains).map((file) => `missing supporting ${file}`),
    ...unexpectedPresent(supporting, expect.supportingNotContains).map((file) => `unexpected supporting ${file}`),
    ...pathsWithPrefix(supporting, expect.forbiddenSupportingPrefixes).map((file) => `forbidden supporting prefix matched ${file}`),
    ...missingExpected(primaryOrSupporting, expect.primaryOrSupportingContains).map((file) => `missing primary/supporting ${file}`),
    ...missingExpected(tests, expect.testsContains).map((file) => `missing test ${file}`),
    ...unexpectedPresent(tests, expect.testsNotContains).map((file) => `unexpected test ${file}`),
    ...pathsWithPrefix(tests, expect.forbiddenTestPrefixes).map((file) => `forbidden test prefix matched ${file}`),
    ...missingExpected(surfaces.detected, expect.detectedSurfaces).map((surface) => `missing detected surface ${surface}`),
    ...unexpectedPresent(surfaces.detected, expect.detectedSurfacesNotContains).map((surface) => `unexpected detected surface ${surface}`),
    ...missingExpected(surfaces.covered, expect.coveredSurfaces).map((surface) => `missing covered surface ${surface}`),
    ...unexpectedPresent(surfaces.covered, expect.coveredSurfacesNotContains).map((surface) => `unexpected covered surface ${surface}`),
    ...unexpectedPresent(surfaces.missing, expect.missingSurfacesNotContains).map((surface) => `unexpected missing surface ${surface}`)
  ];

  for (const [label, actual, max] of [
    ["primaryFiles", primary.length, expect.maxPrimaryFiles],
    ["supportingFiles", supporting.length, expect.maxSupportingFiles],
    ["tests", tests.length, expect.maxTests],
    ["readFirst", readFirst.length, expect.maxReadFirst],
    ["briefTokens", route.briefTokens, expect.maxBriefTokens]
  ]) {
    if (typeof max === "number") {
      const failure = countFailure(label, actual, max);
      if (failure) {
        failures.push(failure);
      }
    }
  }

  if (expect.requiredMode && route.mode !== expect.requiredMode) {
    failures.push(`mode ${route.mode} !== ${expect.requiredMode}`);
  }

  if (expect.requiredTaskSize && route.taskSize !== expect.requiredTaskSize) {
    failures.push(`taskSize ${route.taskSize} !== ${expect.requiredTaskSize}`);
  }

  if (expect.firstPrimaryFile && primary[0] !== expect.firstPrimaryFile) {
    failures.push(`first primary ${primary[0] ?? "-"} !== ${expect.firstPrimaryFile}`);
  }

  return {
    failures,
    snapshot: {
      ...routeSnapshot(route),
      surfaces
    }
  };
}

function formatRoutingFailure(routingCase, route, failures) {
  return [
    `${routingCase.name} failed routing quality expectations`,
    `task: ${routingCase.task}`,
    `failures: ${failures.join("; ")}`,
    `actual: ${JSON.stringify(routeSnapshot(route))}`
  ].join("\n");
}

module.exports = {
  evaluateRoutingCase,
  formatRoutingFailure,
  routeSnapshot,
  surfaceForPath,
  surfaceSummary
};
