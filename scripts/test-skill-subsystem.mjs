#!/usr/bin/env node

/**
 * Automated Regression Test Suite for AIcodeEngineer 4-State Skill Architecture
 * 
 * Verifies all 12 critical invariants:
 *   1. .agents/skills count remains exactly 7 (or configured default)
 *   2. registry skillCount matches actual library count (333)
 *   3. all registered paths exist on disk
 *   4. all SHA-256 checksums pass verification
 *   5. exact ID always beats every fuzzy match
 *   6. exact alias beats name/prefix/keyword
 *   7. runtime load never mutates .agents/skills
 *   8. slash invocation strips command from remaining task
 *   9. /skill performs search only — no implicit activation
 *  10. invalid skill IDs fail safely without crashing
 *  11. library skill body reaches actual execution context
 *  12. customization discovery token footprint stays below configured threshold (< 1,500 tokens)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  loadRegistry,
  resolveSkill,
  searchSkills,
  loadSkill,
  routeTask,
  autocompleteSkills,
  hashFile
} from './manage-skills.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(ROOT_DIR, '.agents', 'skills');
const LIBRARY_DIR = path.join(ROOT_DIR, 'skill_library');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ \x1b[32mPASS\x1b[0m: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ \x1b[31mFAIL\x1b[0m: ${message}`);
    failedTests++;
  }
}

console.log('\n================================================================');
console.log('🧪 RUNNING AIcodeEngineer SKILL SUBSYSTEM REGRESSION SUITE');
console.log('================================================================\n');

// Invariant 1: .agents/skills count remains 7
console.log('Test 1: Verifying active .agents/skills count...');
const activeSkills = fs.readdirSync(SKILLS_DIR).filter(d => fs.statSync(path.join(SKILLS_DIR, d)).isDirectory());
assert(activeSkills.length === 7, `Active .agents/skills has exactly 7 items (found: ${activeSkills.length}: ${activeSkills.join(', ')})`);

// Invariant 2: registry skillCount matches actual library count
console.log('\nTest 2: Verifying registry skillCount vs library count...');
const registry = loadRegistry();
assert(registry.schemaVersion === 1, `Registry schemaVersion is 1`);
assert(registry.skillCount === 333, `Registry skillCount is 333 (found: ${registry.skillCount})`);

// Invariant 3: all registered paths exist
console.log('\nTest 3: Verifying all registered paths exist on disk...');
let missingPaths = 0;
for (const skill of registry.skills) {
  const fullPath = path.join(ROOT_DIR, skill.path);
  if (!fs.existsSync(fullPath)) missingPaths++;
}
assert(missingPaths === 0, `All 333 registered SKILL.md paths exist on disk (0 missing)`);

// Invariant 4: all SHA-256 checksums pass
console.log('\nTest 4: Verifying all SHA-256 checksums...');
let hashMismatches = 0;
for (const skill of registry.skills) {
  const fullPath = path.join(ROOT_DIR, skill.path);
  const currentHash = `sha256:${hashFile(fullPath)}`;
  if (currentHash !== skill.checksum) hashMismatches++;
}
assert(hashMismatches === 0, `All 333 SHA-256 checksums match perfectly`);

// Invariant 5: exact ID always beats every fuzzy match
console.log('\nTest 5: Verifying exact ID resolution priority...');
const exactRes = resolveSkill('deepstream-dev');
assert(exactRes && exactRes.skill.id === 'deepstream-dev' && exactRes.matchType === 'exact_id', `Exact ID "deepstream-dev" resolves with 100% confidence to deepstream-dev`);

// Invariant 6: exact alias beats name/prefix/keyword
console.log('\nTest 6: Verifying alias resolution priority...');
const aliasRes = resolveSkill('react-state');
assert(aliasRes && aliasRes.skill.id === 'react-debugging' && aliasRes.matchType === 'exact_alias', `Alias "react-state" resolves directly to "react-debugging"`);

// Invariant 7: runtime load never mutates .agents/skills
console.log('\nTest 7: Verifying runtime load never mutates .agents/skills...');
const preLoadActive = fs.readdirSync(SKILLS_DIR);
const loaded = loadSkill('jetson-customize-camera', { silent: true });
const postLoadActive = fs.readdirSync(SKILLS_DIR);
assert(loaded !== null && loaded.skill.id === 'jetson-customize-camera', `Library-only skill "jetson-customize-camera" loaded into State 3`);
assert(preLoadActive.length === postLoadActive.length, `.agents/skills count unchanged before (${preLoadActive.length}) and after (${postLoadActive.length}) load`);
assert(!fs.existsSync(path.join(SKILLS_DIR, 'jetson-customize-camera')), `"jetson-customize-camera" was NOT written to .agents/skills`);

// Invariant 8: slash invocation strips command from remaining task
console.log('\nTest 8: Verifying slash command parsing and prompt extraction...');
const routeResult = routeTask('/deepstream-dev optimize pipeline throughput', { silent: true });
assert(routeResult.type === 'explicit_slash', `Identified explicit slash command`);
assert(routeResult.skillId === 'deepstream-dev', `Resolved target skillId "deepstream-dev"`);
assert(routeResult.promptRemaining === 'optimize pipeline throughput', `Correctly extracted remaining prompt: "${routeResult.promptRemaining}"`);

// Invariant 9: /skill performs search only — no implicit activation
console.log('\nTest 9: Verifying /skill search command does not activate skills...');
const searchRoute = routeTask('/skill jetson camera', { silent: true });
assert(searchRoute.type === 'search', `/skill routed to search mode`);
assert(searchRoute.results.length > 0, `Returned ${searchRoute.results.length} search results`);
assert(!fs.existsSync(path.join(SKILLS_DIR, 'jetson-customize-camera')), `No skill was activated during search`);

// Invariant 10: invalid skill IDs fail safely
console.log('\nTest 10: Verifying safe failure on invalid skill ID...');
const invalidRes = resolveSkill('non-existent-random-skill-xyz');
assert(invalidRes === null, `Invalid skill resolved to null`);
const invalidRoute = routeTask('/non-existent-random-skill-xyz test task', { silent: true });
assert(invalidRoute === null, `Invalid slash command failed safely without throwing`);

// Invariant 11: library skill body reaches actual execution context
console.log('\nTest 11: Verifying full skill body contents in returned result...');
assert(loaded.content.includes('# jetson-customize-camera') || loaded.content.includes('description:'), `Full markdown instructions retrieved in memory for LLM execution context`);

// Invariant 12: customization discovery token footprint stays below configured threshold
console.log('\nTest 12: Verifying customization discovery token footprint...');
let totalActiveWords = 0;
for (const s of activeSkills) {
  const p = path.join(SKILLS_DIR, s, 'SKILL.md');
  if (fs.existsSync(p)) {
    totalActiveWords += fs.readFileSync(p, 'utf-8').split(/\s+/).length;
  }
}
const estimatedTokens = Math.round(totalActiveWords * 1.35);
assert(estimatedTokens < 1500, `Active customization discovery token footprint is ~${estimatedTokens} tokens (< 1,500 limit / < 8% of 20k budget)`);

console.log('\n================================================================');
if (failedTests === 0) {
  console.log(`🎉 ALL ${passedTests} REGRESSION INVARIANTS PASSED SUCCESSFULLY!`);
} else {
  console.error(`❌ REGRESSION SUITE FAILED: ${failedTests} failed, ${passedTests} passed.`);
  process.exit(1);
}
console.log('================================================================\n');
