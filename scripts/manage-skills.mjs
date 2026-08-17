#!/usr/bin/env node

/**
 * AIcodeEngineer Skill Registry & Runtime Router
 * 
 * Implements 4-State skill management:
 *   State 0: Master Library (skill_library/)
 *   State 1: Routing Index (skill_registry.json with schemaVersion 1)
 *   State 2: Persistent Workspace Discovery (.agents/skills/)
 *   State 3: Ephemeral Runtime Activation (loadSkill without fs mutation)
 * 
 * Advanced Features:
 *   - Deterministic Resolution Priority (Exact ID > Exact Alias > Name > Prefix > Ranked)
 *   - Confidence Policy (AUTO_LOAD >= 0.85, CANDIDATE >= 0.65, REJECT < 0.65)
 *   - Multi-Skill Composition (Max 3 automatic composite skills)
 *   - Security & Trust Boundary (trusted, allowScripts, source verification)
 *   - Autocomplete Provider for Forge Chat UI
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(ROOT_DIR, '.agents', 'skills');
const LIBRARY_DIR = path.join(ROOT_DIR, 'skill_library');
const REGISTRY_FILE = path.join(ROOT_DIR, 'skill_registry.json');

export const CONFIDENCE_THRESHOLDS = {
  AUTO_LOAD: 0.85,
  CANDIDATE: 0.65,
  MAX_AUTO_COMPOSITE: 3
};

/**
 * Loads and validates registry with schemaVersion 1 support
 */
export function loadRegistry() {
  if (!fs.existsSync(REGISTRY_FILE)) {
    console.error(`Error: Registry file not found at ${REGISTRY_FILE}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
  const skills = Array.isArray(raw) ? raw : (raw.skills || []);
  return {
    schemaVersion: raw.schemaVersion || 1,
    generatedAt: raw.generatedAt || new Date().toISOString(),
    skillCount: skills.length,
    skills
  };
}

export function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

export function hashDirectory(dirPath) {
  const hashes = {};
  if (!fs.existsSync(dirPath)) return hashes;

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const rel = path.relative(dirPath, fullPath).replace(/\\/g, '/');
        hashes[rel] = hashFile(fullPath);
      }
    }
  }
  walk(dirPath);
  return hashes;
}

/**
 * Autocomplete suggestions for chat input (e.g. `/deep` -> matches)
 */
export function autocompleteSkills(prefix, limit = 8) {
  if (!prefix) return [];
  const clean = prefix.trim().replace(/^\//, '').toLowerCase();
  const { skills } = loadRegistry();

  const results = [];
  for (const s of skills) {
    const sid = s.id.toLowerCase();
    const sname = (s.name || '').toLowerCase();
    const aliases = (s.aliases || []).map(a => a.toLowerCase());

    if (sid.startsWith(clean)) {
      results.push({ id: s.id, name: s.name, match: 'id_prefix', description: s.short_description });
    } else if (aliases.some(a => a.startsWith(clean))) {
      results.push({ id: s.id, name: s.name, match: 'alias_prefix', description: s.short_description });
    } else if (sname.toLowerCase().includes(clean)) {
      results.push({ id: s.id, name: s.name, match: 'name_substring', description: s.short_description });
    }
    if (results.length >= limit) break;
  }
  return results;
}

/**
 * Deterministic Resolution Priority:
 * 1. Exact ID
 * 2. Exact Alias
 * 3. Exact Name (case-insensitive)
 * 4. Exact Prefix
 * 5. Multi-token weighted ranking
 */
export function resolveSkill(query) {
  if (!query || typeof query !== 'string') return null;
  const clean = query.trim().replace(/^\//, '').toLowerCase();
  const { skills } = loadRegistry();

  // 1. Exact ID match
  const exactId = skills.find(s => s.id.toLowerCase() === clean);
  if (exactId) return { skill: exactId, matchType: 'exact_id', confidence: 1.0 };

  // 2. Exact Alias match
  const exactAlias = skills.find(s => (s.aliases || []).some(a => a.toLowerCase() === clean));
  if (exactAlias) return { skill: exactAlias, matchType: 'exact_alias', confidence: 0.98 };

  // 3. Exact Name match
  const exactName = skills.find(s => (s.name || '').toLowerCase() === clean);
  if (exactName) return { skill: exactName, matchType: 'exact_name', confidence: 0.95 };

  // 4. Exact Prefix match
  const prefixMatch = skills.find(s => s.id.toLowerCase().startsWith(clean));
  if (prefixMatch) return { skill: prefixMatch, matchType: 'prefix', confidence: 0.85 };

  // 5. Keyword & Tag Multi-Match Ranking
  const tokens = clean.split(/\s+/).filter(Boolean);
  const scored = [];

  for (const skill of skills) {
    let score = 0;
    const sid = skill.id.toLowerCase();
    const sname = (skill.name || '').toLowerCase();
    const sdesc = (skill.short_description || '').toLowerCase();
    const tags = (skill.tags || []).map(t => t.toLowerCase());
    const aliases = (skill.aliases || []).map(a => a.toLowerCase());

    for (const t of tokens) {
      if (sid === t) score += 50;
      else if (sid.includes(t)) score += 20;

      if (aliases.some(a => a.includes(t))) score += 25;
      if (tags.includes(t)) score += 15;
      if (sname.includes(t)) score += 15;
      if (sdesc.includes(t)) score += 8;
    }

    if (score > 0) {
      scored.push({ skill, score, confidence: Math.min(score / 100, 0.94) });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 0) {
    return { skill: scored[0].skill, matchType: 'keyword_ranking', confidence: scored[0].confidence, candidates: scored.slice(0, 5) };
  }

  return null;
}

/**
 * Searches skills with ranked scoring
 */
export function searchSkills(query) {
  if (!query || query.trim() === '') {
    console.log('Usage: node scripts/manage-skills.mjs search <keywords>');
    return [];
  }

  const { skills } = loadRegistry();
  const clean = query.trim().replace(/^\//, '').toLowerCase();
  const tokens = clean.split(/\s+/).filter(Boolean);

  const scored = [];
  for (const skill of skills) {
    let score = 0;
    const sid = skill.id.toLowerCase();
    const sname = (skill.name || '').toLowerCase();
    const sdesc = (skill.short_description || '').toLowerCase();
    const tags = (skill.tags || []).map(t => t.toLowerCase());
    const aliases = (skill.aliases || []).map(a => a.toLowerCase());

    if (sid === clean) score += 200;
    else if (sid.startsWith(clean)) score += 100;
    else if (aliases.includes(clean)) score += 150;

    for (const t of tokens) {
      if (sid.includes(t)) score += 30;
      if (aliases.some(a => a.includes(t))) score += 25;
      if (tags.includes(t)) score += 20;
      if (sname.includes(t)) score += 20;
      if (sdesc.includes(t)) score += 10;
    }

    if (score > 0) {
      scored.push({ skill, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  console.log(`\n🔍 Found ${scored.length} matching skills for "${query}":\n`);
  const top = scored.slice(0, 10);
  for (const { skill, score } of top) {
    const isEnabled = fs.existsSync(path.join(SKILLS_DIR, skill.id));
    const status = isEnabled ? ' \x1b[32m[Active in Workspace]\x1b[0m' : ' \x1b[90m[Library Only]\x1b[0m';
    console.log(`  ⭐ \x1b[36m${skill.id}\x1b[0m (Score: ${score})${status}`);
    console.log(`     \x1b[90m${skill.name} | Category: ${skill.category}\x1b[0m`);
    console.log(`     ${skill.short_description}\n`);
  }

  if (scored.length > 10) {
    console.log(`  ... and ${scored.length - 10} more matches. Narrow search for more specific results.`);
  }

  return scored;
}

/**
 * Unified loadSkill function: State 3 ephemeral runtime activation
 */
export function loadSkill(skillQuery, options = {}) {
  const resolution = resolveSkill(skillQuery);
  if (!resolution) {
    if (options.silent !== true) {
      console.error(`Error: Could not resolve skill for query "${skillQuery}".`);
    }
    return null;
  }

  const { skill, matchType, confidence } = resolution;
  const fullPath = path.join(ROOT_DIR, skill.path);
  const isPersistent = fs.existsSync(path.join(SKILLS_DIR, skill.id));

  if (!fs.existsSync(fullPath)) {
    if (options.silent !== true) {
      console.error(`Error: Skill file not found at ${fullPath}`);
    }
    return null;
  }

  // Security & Trust check
  const isTrusted = skill.trusted !== false;
  const allowsScripts = skill.allowScripts !== false;

  const content = fs.readFileSync(fullPath, 'utf-8');

  if (options.diagnostics !== false && options.silent !== true) {
    console.log(`
┌────────────────────────────────────────────────────────────────────────┐
│ 🚀 SKILL RUNTIME ACTIVATION DIAGNOSTICS (State 3)                      │
├────────────────────────────────────────────────────────────────────────┤
│ Requested Query:        ${skillQuery.padEnd(46)} │
│ Resolved Skill ID:      ${skill.id.padEnd(46)} │
│ Match Type:             ${matchType.padEnd(46)} │
│ Confidence Score:       ${(confidence.toFixed(2) + ' (' + Math.round(confidence * 100) + '%)').padEnd(46)} │
│ Domain Category:        ${skill.category.padEnd(46)} │
│ Trust / Scripts:        ${(isTrusted ? 'Trusted (Scripts: ' + (allowsScripts ? 'Allowed' : 'Blocked') + ')' : 'Untrusted').padEnd(46)} │
│ Source Path:            ${skill.path.padEnd(46)} │
│ Activation Mode:        ephemeral runtime (State 3)                    │
│ Persistent Discovery:   ${(isPersistent ? 'true (.agents/skills/)' : 'false (isolated to task)').padEnd(46)} │
│ Loaded for Task:        true                                           │
└────────────────────────────────────────────────────────────────────────┘
`);
    console.log(content);
  }

  return { skill, resolution, content, isPersistent, isTrusted, allowsScripts };
}

/**
 * Multi-Skill Composite Router with Confidence Gating
 */
export function routeTask(input, options = {}) {
  if (!input || input.trim() === '') {
    console.log('Usage: node scripts/manage-skills.mjs route "<user task or /slash-command>"');
    return null;
  }

  const trimmed = input.trim();

  // 1. Explicit /skill search UI command
  if (trimmed.startsWith('/skill')) {
    const query = trimmed.replace(/^\/skill\s*/, '').trim();
    if (!query) {
      console.log('Usage: /skill <query> (e.g. /skill jetson)');
      return { type: 'search', results: [] };
    }
    const results = searchSkills(query);
    return { type: 'search', query, results };
  }

  // 2. Explicit /<skill-id> command (bypasses confidence threshold)
  if (trimmed.startsWith('/')) {
    const parts = trimmed.slice(1).split(/\s+/);
    const slashCmd = parts[0];
    const promptRemaining = parts.slice(1).join(' ');

    const result = loadSkill(slashCmd, options);
    if (!result) {
      console.log(`❌ Unknown skill command "/${slashCmd}". Try "/skill ${slashCmd}" to search.`);
      return null;
    }

    return {
      type: 'explicit_slash',
      skillId: result.skill.id,
      promptRemaining,
      loadedSkills: [result]
    };
  }

  // 3. Natural Language Intent Routing with Multi-Skill Composition
  const { skills } = loadRegistry();
  const scored = [];

  const clean = trimmed.toLowerCase();
  const tokens = clean.split(/\s+/).filter(t => t.length > 2);

  for (const skill of skills) {
    let score = 0;
    const sid = skill.id.toLowerCase();
    const sname = (skill.name || '').toLowerCase();
    const sdesc = (skill.short_description || '').toLowerCase();
    const tags = (skill.tags || []).map(t => t.toLowerCase());

    for (const t of tokens) {
      if (sid.includes(t)) score += 25;
      if (tags.includes(t)) score += 18;
      if (sname.includes(t)) score += 15;
      if (sdesc.includes(t)) score += 8;
    }

    if (score > 0) {
      const confidence = Math.min(score / 100, 0.96);
      scored.push({ skill, score, confidence });
    }
  }

  scored.sort((a, b) => b.confidence - a.confidence);

  // Confidence Gating Policy
  const eligible = scored.filter(s => s.confidence >= CONFIDENCE_THRESHOLDS.CANDIDATE);
  const autoLoadList = eligible
    .filter(s => s.confidence >= CONFIDENCE_THRESHOLDS.AUTO_LOAD)
    .slice(0, CONFIDENCE_THRESHOLDS.MAX_AUTO_COMPOSITE);

  if (options.silent !== true) {
    console.log(`\n=== Task Intent Routing: "${trimmed}" ===`);
    if (autoLoadList.length > 0) {
      console.log(`⚡ Auto-Activated Skills (${autoLoadList.length}/${CONFIDENCE_THRESHOLDS.MAX_AUTO_COMPOSITE}):`);
      for (const item of autoLoadList) {
        console.log(`  - \x1b[36m${item.skill.id}\x1b[0m (Confidence: ${(item.confidence * 100).toFixed(0)}%) [${item.skill.category}]`);
      }
    } else if (eligible.length > 0) {
      console.log(`ℹ️ Potential Candidates (Below auto-load threshold ${CONFIDENCE_THRESHOLDS.AUTO_LOAD * 100}%):`);
      for (const item of eligible.slice(0, 3)) {
        console.log(`  - ${item.skill.id} (Confidence: ${(item.confidence * 100).toFixed(0)}%)`);
      }
    } else {
      console.log(`ℹ️ No specialized domain skill met threshold. Using core workspace capabilities.`);
    }
  }

  const loadedSkills = [];
  for (const item of autoLoadList) {
    const loaded = loadSkill(item.skill.id, options);
    if (loaded) loadedSkills.push(loaded);
  }

  return {
    type: 'auto_intent',
    prompt: trimmed,
    candidates: scored.slice(0, 5),
    autoLoadList,
    loadedSkills
  };
}

function skillInfo(skillId) {
  const { skills } = loadRegistry();
  const resolution = resolveSkill(skillId);

  if (!resolution) {
    console.error(`Skill "${skillId}" not found in registry.`);
    return;
  }

  const skill = resolution.skill;
  const fullPath = path.join(ROOT_DIR, skill.path);
  const skillDir = path.dirname(fullPath);
  const isEnabled = fs.existsSync(path.join(SKILLS_DIR, skill.id));

  console.log(`\n=== Skill Details: ${skill.name} (${skill.id}) ===`);
  console.log(`Category:    ${skill.category}`);
  console.log(`Discovery:   ${isEnabled ? 'Active in .agents/skills/' : 'State 0 (Library Only)'}`);
  console.log(`Path:        ${skill.path}`);
  console.log(`Checksum:    ${skill.checksum}`);
  console.log(`Trusted:     ${skill.trusted !== false} (Scripts: ${skill.allowScripts !== false ? 'allowed' : 'blocked'})`);
  console.log(`Tags:        ${(skill.tags || []).join(', ')}`);
  console.log(`Aliases:     ${(skill.aliases || []).join(', ')}`);
  console.log(`\nDescription:\n  ${skill.short_description}\n`);

  if (fs.existsSync(skillDir)) {
    const files = Object.keys(hashDirectory(skillDir));
    console.log(`Companion Files (${files.length}):`);
    for (const f of files.slice(0, 10)) {
      console.log(`  - ${f}`);
    }
    if (files.length > 10) console.log(`  ... and ${files.length - 10} more files`);
  }
  console.log();
}

function enableSkill(skillId) {
  const resolution = resolveSkill(skillId);
  if (!resolution) {
    console.error(`Skill "${skillId}" not found in registry.`);
    process.exit(1);
  }

  const skill = resolution.skill;
  const fullPath = path.join(ROOT_DIR, skill.path);
  const sourceDir = path.dirname(fullPath);
  const targetDir = path.join(SKILLS_DIR, skill.id);

  if (!fs.existsSync(sourceDir)) {
    console.error(`Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  fs.cpSync(sourceDir, targetDir, { recursive: true });
  console.log(`✅ Enabled "${skill.id}" for persistent workspace discovery (.agents/skills/${skill.id})`);
}

function disableSkill(skillId) {
  const targetDir = path.join(SKILLS_DIR, skillId);
  if (!fs.existsSync(targetDir)) {
    console.log(`Skill "${skillId}" is not active in .agents/skills/`);
    return;
  }

  const { skills } = loadRegistry();
  const inLibrary = skills.some(s => s.id === skillId);
  if (!inLibrary) {
    console.error(`Warning: Skill "${skillId}" is not indexed in skill_library/. Aborting deletion.`);
    return;
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  console.log(`✅ Disabled "${skillId}" from workspace discovery (preserved in skill_library/)`);
}

function applyProfile(profileName) {
  const profiles = {
    ide: [
      'forge-ide-build',
      'react-debugging',
      'electron-runtime',
      'typescript-development',
      'playwright-testing',
      'git-operations',
      'skill-router'
    ],
    'nvidia-edge': [
      'forge-ide-build',
      'skill-router',
      'jetson-quick-start',
      'deepstream-dev',
      'holoscan-setup',
      'vss-deploy-profile'
    ],
    'nvidia-training': [
      'forge-ide-build',
      'skill-router',
      'nemo-automodel-recipe-development',
      'tao-launch-workflow',
      'cuopt-developer',
      'mcore-testing'
    ],
    minimal: [
      'forge-ide-build',
      'skill-router'
    ]
  };

  if (!profileName || profileName === 'list') {
    console.log('Available Profiles:');
    for (const [name, skills] of Object.entries(profiles)) {
      console.log(`  - \x1b[36m${name}\x1b[0m (${skills.length} skills): ${skills.join(', ')}`);
    }
    return;
  }

  const targetList = profiles[profileName];
  if (!targetList) {
    console.error(`Unknown profile "${profileName}". Run "node scripts/manage-skills.mjs profile list" to see options.`);
    return;
  }

  const { skills } = loadRegistry();

  if (fs.existsSync(SKILLS_DIR)) {
    fs.rmSync(SKILLS_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(SKILLS_DIR, { recursive: true });

  for (const skillId of targetList) {
    const skill = skills.find(s => s.id === skillId);
    if (skill) {
      const sourceDir = path.dirname(path.join(ROOT_DIR, skill.path));
      const targetDir = path.join(SKILLS_DIR, skill.id);
      fs.cpSync(sourceDir, targetDir, { recursive: true });
    }
  }

  console.log(`✅ Applied profile "${profileName}" (${targetList.length} active discovery skills in .agents/skills/)`);
}

function validateLibrary() {
  const reg = loadRegistry();
  console.log(`Validating ${reg.skills.length} skills (schemaVersion: ${reg.schemaVersion}) in skill_library/...`);

  let checkedFiles = 0;
  let missingSkills = 0;
  let brokenFiles = 0;

  for (const skill of reg.skills) {
    const fullPath = path.join(ROOT_DIR, skill.path);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ Missing SKILL.md for ${skill.id} at ${fullPath}`);
      missingSkills++;
      continue;
    }

    const currentHash = `sha256:${hashFile(fullPath)}`;
    if (currentHash !== skill.checksum) {
      console.warn(`⚠️ Hash mismatch for ${skill.id}: expected ${skill.checksum}, got ${currentHash}`);
      brokenFiles++;
    }
    checkedFiles++;
  }

  if (missingSkills === 0 && brokenFiles === 0) {
    console.log(`\n🎉 100% VALIDATION PASS! All ${checkedFiles} skills and checksums verified without errors.`);
  } else {
    console.error(`\nValidation completed with ${missingSkills} missing skills and ${brokenFiles} hash mismatches.`);
  }
}

// CLI Dispatch
const [,, command, ...args] = process.argv;

if (command) {
  switch (command) {
    case 'search':
      searchSkills(args.join(' '));
      break;
    case 'autocomplete': {
      const suggestions = autocompleteSkills(args.join(' '));
      console.log(`Autocomplete suggestions for "${args.join(' ')}":`);
      for (const s of suggestions) {
        console.log(`  /${s.id} - ${s.name} (${s.description})`);
      }
      break;
    }
    case 'info':
      skillInfo(args[0]);
      break;
    case 'load':
      loadSkill(args[0]);
      break;
    case 'route':
      routeTask(args.join(' '));
      break;
    case 'enable':
      enableSkill(args[0]);
      break;
    case 'disable':
      disableSkill(args[0]);
      break;
    case 'profile':
      applyProfile(args[0]);
      break;
    case 'validate':
      validateLibrary();
      break;
    case 'list-active': {
      const active = fs.readdirSync(SKILLS_DIR);
      console.log(`Active Workspace Skills (${active.length}):\n${active.map(a => `  - ${a}`).join('\n')}`);
      break;
    }
    default:
      console.log(`
AIcodeEngineer Skill Registry & Runtime Router

Usage:
  node scripts/manage-skills.mjs route "<task or /cmd>" # Route task or slash command
  node scripts/manage-skills.mjs search <keywords>     # State 1: Search registry for skills
  node scripts/manage-skills.mjs autocomplete <prefix> # Autocomplete slash commands for chat UI
  node scripts/manage-skills.mjs info <skill-id>       # View full skill metadata & companion files
  node scripts/manage-skills.mjs load <skill-id>       # State 3: Runtime load SKILL.md with diagnostics
  node scripts/manage-skills.mjs enable <skill-id>     # State 2: Enable persistent workspace discovery
  node scripts/manage-skills.mjs disable <skill-id>    # State 2: Remove from workspace discovery
  node scripts/manage-skills.mjs profile <name>        # Apply preset profile (ide, minimal, list)
  node scripts/manage-skills.mjs validate              # Run SHA-256 integrity validation
  node scripts/manage-skills.mjs list-active           # List active discovery skills in .agents/skills
`);
  }
}
