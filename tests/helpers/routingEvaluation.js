function valuesFrom(items) {
  return Array.isArray(items) ? items : [];
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
    ...pathsWithPrefix(tests, expect.forbiddenTestPrefixes).map((file) => `forbidden test prefix matched ${file}`)
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
    snapshot: routeSnapshot(route)
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
  routeSnapshot
};
