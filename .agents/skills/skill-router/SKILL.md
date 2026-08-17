---
name: skill-router
description: Queries the master skill registry (328+ skills) and loads on-demand domain skills dynamically without context bloat. Use when searching or activating specialized skills.
---

# Skill Router & Master Registry Tool

Use `scripts/manage-skills.mjs` to interact with the 328+ domain skills in `skill_library/`.

## CLI Usage

1. **Search Skills (State 1):**
   ```bash
   node scripts/manage-skills.mjs search <keywords>
   ```
2. **View Skill Details:**
   ```bash
   node scripts/manage-skills.mjs info <skill-id>
   ```
3. **Load Skill Instructions (State 3 - Runtime Activation):**
   ```bash
   node scripts/manage-skills.mjs load <skill-id>
   ```
4. **Enable Persistent Discovery (State 2):**
   ```bash
   node scripts/manage-skills.mjs enable <skill-id>
   ```
5. **Disable Persistent Discovery:**
   ```bash
   node scripts/manage-skills.mjs disable <skill-id>
   ```
6. **Switch Workspace Profile:**
   ```bash
   node scripts/manage-skills.mjs profile ide
   ```
7. **Validate Zero-Loss Integrity:**
   ```bash
   node scripts/manage-skills.mjs validate
   ```
