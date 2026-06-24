function valuesFrom(items) {
  return Array.isArray(items) ? items : [];
}

function pathsFrom(items) {
  return valuesFrom(items).map((item) => item.path);
}

function commandsFrom(items) {
  return valuesFrom(items).map((item) => item.command);
}

function pathMatches(actualPath, expectedPath) {
  return actualPath === expectedPath || actualPath.startsWith(expectedPath);
}

function missingExpected(actualPaths, expectedPaths = []) {
  return expectedPaths.filter((expectedPath) => !actualPaths.some((actualPath) => pathMatches(actualPath, expectedPath)));
}

function unexpectedPresent(actualPaths, expectedPaths = []) {
  return expectedPaths.filter((expectedPath) => actualPaths.some((actualPath) => pathMatches(actualPath, expectedPath)));
}

function missingCommand(actualCommands, expectedCommands = []) {
  return expectedCommands.filter((expectedCommand) => !actualCommands.some((command) => command.includes(expectedCommand)));
}

function countFailure(label, actual, max) {
  return actual > max ? `${label} count ${actual} > ${max}` : null;
}

function entriesWithoutReason(items) {
  return valuesFrom(items)
    .filter((item) => typeof item.reason !== "string" || item.reason.trim().length === 0)
    .map((item) => item.path ?? item.command ?? JSON.stringify(item));
}

function commandsWithInvalidMetadata(commands) {
  const validTypes = new Set(["test", "build", "verification"]);
  const validScopes = new Set(["focused", "project"]);
  const validConfidence = new Set(["high", "medium", "low"]);

  return valuesFrom(commands)
    .filter((item) => (
      !validTypes.has(item.type)
      || !validScopes.has(item.scope)
      || !validConfidence.has(item.confidence)
    ))
    .map((item) => item.command ?? JSON.stringify(item));
}

function impactSnapshot(analysis) {
  return {
    basis: analysis.basis,
    confidence: analysis.confidence,
    changedFiles: pathsFrom(analysis.changedFiles),
    affectedFiles: pathsFrom(analysis.affectedFiles),
    affectedTests: pathsFrom(analysis.affectedTests),
    suggestedCommands: commandsFrom(analysis.suggestedCommands)
  };
}

function evaluateImpactCase(analysis, impactCase) {
  const expect = impactCase.expect ?? {};
  const changedFiles = pathsFrom(analysis.changedFiles);
  const affectedFiles = pathsFrom(analysis.affectedFiles);
  const affectedTests = pathsFrom(analysis.affectedTests);
  const suggestedCommands = commandsFrom(analysis.suggestedCommands);
  const failures = [
    ...missingExpected(changedFiles, expect.changedContains).map((file) => `missing changed file ${file}`),
    ...missingExpected(affectedFiles, expect.affectedContains).map((file) => `missing affected file ${file}`),
    ...unexpectedPresent(affectedFiles, expect.affectedNotContains).map((file) => `unexpected affected file ${file}`),
    ...missingExpected(affectedTests, expect.testsContains).map((file) => `missing affected test ${file}`),
    ...unexpectedPresent(affectedTests, expect.testsNotContains).map((file) => `unexpected affected test ${file}`),
    ...missingCommand(suggestedCommands, expect.commandsContain).map((command) => `missing command containing ${command}`)
  ];

  for (const [label, actual, max] of [
    ["affectedFiles", affectedFiles.length, expect.maxAffectedFiles],
    ["affectedTests", affectedTests.length, expect.maxAffectedTests],
    ["suggestedCommands", suggestedCommands.length, expect.maxSuggestedCommands]
  ]) {
    if (typeof max === "number") {
      const failure = countFailure(label, actual, max);
      if (failure) {
        failures.push(failure);
      }
    }
  }

  if (expect.basis && analysis.basis !== expect.basis) {
    failures.push(`basis ${analysis.basis} !== ${expect.basis}`);
  }

  if (expect.confidence && analysis.confidence !== expect.confidence) {
    failures.push(`confidence ${analysis.confidence} !== ${expect.confidence}`);
  }

  for (const [label, items] of [
    ["changedFiles", analysis.changedFiles],
    ["affectedFiles", analysis.affectedFiles],
    ["affectedTests", analysis.affectedTests],
    ["suggestedCommands", analysis.suggestedCommands]
  ]) {
    for (const item of entriesWithoutReason(items)) {
      failures.push(`${label} item has no reason: ${item}`);
    }
  }

  for (const command of commandsWithInvalidMetadata(analysis.suggestedCommands)) {
    failures.push(`suggested command has invalid metadata: ${command}`);
  }

  return {
    failures,
    snapshot: impactSnapshot(analysis)
  };
}

function formatImpactFailure(impactCase, analysis, failures) {
  return [
    `${impactCase.name} failed impact quality expectations`,
    `task: ${impactCase.task}`,
    `failures: ${failures.join("; ")}`,
    `actual: ${JSON.stringify(impactSnapshot(analysis))}`
  ].join("\n");
}

module.exports = {
  evaluateImpactCase,
  formatImpactFailure,
  impactSnapshot
};
