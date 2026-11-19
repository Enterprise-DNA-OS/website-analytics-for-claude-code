# Validation

Checked 19 November 2026. Local npm install, npm test, npm run demo, npm run view and npm run docs passed on Linux, Node 22.23.4. The smoke suite exercised all 26 CLI verbs. The repository ships 30 command recipes, excluding the command-folder README.

[Hosted validation run 44443661809](https://github.com/Enterprise-DNA-OS/website-analytics-for-claude-code/actions/runs/44443661809) passed all five jobs against implementation commit f93f890:

- Windows, Node 20: npm ci, npm test and npm run demo passed.
- Windows, Node 22: npm ci, npm test and npm run demo passed.
- Linux, Node 20: npm ci, npm test and npm run demo passed.
- Linux, Node 22: npm ci, npm test and npm run demo passed.
- PostgreSQL 17, Node 22 on Linux: npm ci and npm test passed against an empty disposable database.

The private dashboard and website brief were rendered, captured in a headless browser and visually inspected. Three actual demo runs are stored in demo-captures.json. No command output was invented. The Matomo page gate passed with three sourced price mentions and zero voice errors.

The suite covers every CLI verb, source and site isolation, independent import counts, duplicate and conflicting visits, dry-run rollback, source-date bounds, converted-visit denominators, incomplete action histories, repeated seed and migrations, private drafts, export overwrite protection, evidence controls and escaped HTML.
