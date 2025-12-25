#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const command = args[0];

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function banner() {
  console.log(`
${colors.green}╔═══════════════════════════════════════╗
║                                       ║
║   ${colors.cyan}RepoTutor${colors.green}                            ║
║   ${colors.dim}AI-Powered Documentation${colors.green}             ║
║                                       ║
╚═══════════════════════════════════════╝${colors.reset}
`);
}

async function init() {
  banner();
  log('Initializing RepoTutor in your project...', 'cyan');

  const cwd = process.cwd();
  const docsDir = path.join(cwd, 'docs');

  // Create docs directory structure
  const dirs = [
    'docs',
    'docs/content',
    'docs/public',
  ];

  dirs.forEach(dir => {
    const fullPath = path.join(cwd, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      log(`  Created ${dir}/`, 'dim');
    }
  });

  // Copy template files
  const templateDir = path.join(__dirname, '..', 'templates');

  // Create package.json for docs
  const docsPackage = {
    name: `${path.basename(cwd)}-docs`,
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'repotutor dev',
      build: 'repotutor build',
      start: 'repotutor start',
    },
    dependencies: {
      repotutor: 'latest',
    },
  };

  fs.writeFileSync(
    path.join(docsDir, 'package.json'),
    JSON.stringify(docsPackage, null, 2)
  );
  log('  Created docs/package.json', 'dim');

  // Create sample content
  const welcomeMdx = `---
title: Welcome
description: Documentation for ${path.basename(cwd)}
icon: spark
order: 0
---

# Welcome to ${path.basename(cwd)}

This documentation was generated with [RepoTutor](https://github.com/GizAI/repotutor).

## Getting Started

Add your documentation files to the \`docs/content/\` folder.

\`\`\`mermaid
flowchart LR
    A[Your Code] --> B[RepoTutor]
    B --> C[Beautiful Docs]
\`\`\`

<Callout type="tip" title="Tip">
  Edit this file at \`docs/content/00-welcome.mdx\`
</Callout>
`;

  fs.writeFileSync(
    path.join(docsDir, 'content', '00-welcome.mdx'),
    welcomeMdx
  );
  log('  Created docs/content/00-welcome.mdx', 'dim');

  console.log('');
  log('RepoTutor initialized successfully!', 'green');
  console.log('');
  log('Next steps:', 'yellow');
  log('  cd docs', 'dim');
  log('  npm install', 'dim');
  log('  npm run dev', 'dim');
  console.log('');
}

async function dev() {
  log('Starting RepoTutor dev server...', 'cyan');
  execSync('npx next dev', { stdio: 'inherit' });
}

async function build() {
  log('Building RepoTutor site...', 'cyan');
  execSync('npx next build', { stdio: 'inherit' });
}

async function start() {
  log('Starting RepoTutor production server...', 'cyan');
  execSync('npx next start', { stdio: 'inherit' });
}

// Main
switch (command) {
  case 'init':
    init();
    break;
  case 'dev':
    dev();
    break;
  case 'build':
    build();
    break;
  case 'start':
    start();
    break;
  default:
    banner();
    log('Usage:', 'yellow');
    log('  npx repotutor init    Initialize RepoTutor in your project', 'dim');
    log('  npx repotutor dev     Start development server', 'dim');
    log('  npx repotutor build   Build for production', 'dim');
    log('  npx repotutor start   Start production server', 'dim');
    console.log('');
}
