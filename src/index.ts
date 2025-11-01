#!/usr/bin/env bun

import { gt, prerelease, valid, diff } from 'semver';
import * as yaml from 'js-yaml';

async function findPnpmWorkspaceFile(): Promise<string | null> {
  const searchPaths = [
    // Check current working directory first
    './pnpm-workspace.yaml',
    // Check parent directory
    '../pnpm-workspace.yaml',
    // Check two levels up (workspace root)
    '../../pnpm-workspace.yaml'
  ];

  for (const path of searchPaths) {
    try {
      if (await Bun.file(path).exists()) {
        return path;
      }
    } catch (error) {
      // Continue to next path if this one fails
      continue;
    }
  }

  return null;
}
const argv = new Set(Bun.argv);
const shouldUpdate = argv.has('--update');
const updatePatch = argv.has('--patch');
const updateMinor = argv.has('--minor');
const updateMajor = argv.has('--major');
const showHelp = argv.has('--help') || argv.has('-h');

// Parse -w flag for workspace file path
let workspaceFilePath: string | null = null;
const bunArgv = Bun.argv;
const wFlagIndex = bunArgv.findIndex(arg => arg === '-w');
if (wFlagIndex !== -1 && wFlagIndex + 1 < bunArgv.length) {
  workspaceFilePath = bunArgv[wFlagIndex + 1];
}

const helpText = `
Usage: pnpx workspace-updater [options]

Checks for outdated dependencies in the pnpm-workspace.yaml catalog.

Options:
  --update          Update the pnpm-workspace.yaml file with the latest versions.
  --patch           When used with --update, only update patch-level changes.
  --minor           When used with --update, only update minor-level changes.
  --major           When used with --update, only update major-level changes.
  -w <path>         Explicitly define the location of the pnpm-workspace.yaml file.
  -h, --help        Display this help message.
`;

if (showHelp) {
  console.log(helpText);
  process.exit(0);
}

interface NpmPackage {
  'dist-tags': {
    latest: string;
  };
}

interface PnpmWorkspace {
  catalog?: {
    [key:string]: string;
  };
}

async function getLatestVersion(packageName: string): Promise<string | null> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    if (!response.ok) {
      console.warn(`Failed to fetch version for ${packageName}: ${response.statusText}`);
      return null;
    }
    const data = (await response.json()) as NpmPackage;
    return data['dist-tags'].latest;
  } catch (error) {
    console.error(`Error fetching version for ${packageName}:`, error);
    return null;
  }
}

type OutdatedInfo = { name: string; current: string; latest: string; type: 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease' | null };

async function checkDependencies() {
  console.log('Looking for pnpm-workspace.yaml...');
  
  let pnpmWorkspacePath: string | null = null;
  
  if (workspaceFilePath) {
    // Use explicitly provided path
    if (await Bun.file(workspaceFilePath).exists()) {
      pnpmWorkspacePath = workspaceFilePath;
    } else {
      console.error(`Error: pnpm-workspace.yaml not found at specified path: ${workspaceFilePath}`);
      process.exit(1);
    }
  } else {
    // Use automatic detection
    pnpmWorkspacePath = await findPnpmWorkspaceFile();
    if (!pnpmWorkspacePath) {
      console.error('Error: pnpm-workspace.yaml not found in current directory or workspace root.');
      process.exit(1);
    }
  }

  console.log(`Found pnpm-workspace.yaml at: ${pnpmWorkspacePath}`);
  console.log('Reading pnpm-workspace.yaml...');
  try {
    const fileContents = await Bun.file(pnpmWorkspacePath).text();
    const doc = yaml.load(fileContents) as PnpmWorkspace;
    const catalog = doc.catalog || {};

    const dependencies = Object.entries(catalog);
    console.log(`Found ${dependencies.length} dependencies in catalog. Fetching latest versions in parallel...`);

    const promises = dependencies.map(async ([name, version]): Promise<OutdatedInfo | null> => {
      const cleanVersion = version?.replace(/[^\d.]/g, '') || '';
      if (typeof version !== 'string' || prerelease(version) || !valid(cleanVersion)) {
        return null;
      }
      const latestVersion = await getLatestVersion(name);
      if (latestVersion && gt(latestVersion, cleanVersion)) {
        const diffType = diff(cleanVersion, latestVersion);
        return { name, current: version, latest: latestVersion, type: diffType };
      }
      return null;
    });

    const results = await Promise.all(promises);
    const outdated = results.filter((result): result is OutdatedInfo => result !== null);

    if (outdated.length > 0) {
      const grouped: { [key: string]: OutdatedInfo[] } = { major: [], minor: [], patch: [], premajor: [], preminor: [], prepatch: [], prerelease: [] };
      outdated.forEach(dep => {
        if (dep.type && grouped[dep.type]) grouped[dep.type].push(dep);
      });

      outdated.forEach(dep => {
        if (dep.type && !grouped[dep.type]) {
          if (!grouped.other) grouped.other = [];
          grouped.other.push(dep);
        }
      });

      console.log('Outdated dependencies found:');
      if (grouped.major.length) {
        console.log('\n  \x1b[31mMajor Updates:\x1b[0m');
        grouped.major.forEach(({ name, current, latest }) => console.log(`    ${name}: ${current} -> ${latest}`));
      }
      if (grouped.minor.length) {
        console.log('\n  \x1b[34mMinor Updates:\x1b[0m');
        grouped.minor.forEach(({ name, current, latest }) => console.log(`    ${name}: ${current} -> ${latest}`));
      }
      if (grouped.patch.length) {
        console.log('\n  \x1b[32mPatch Updates:\x1b[0m');
        grouped.patch.forEach(({ name, current, latest }) => console.log(`    ${name}: ${current} -> ${latest}`));
      }

      if (shouldUpdate) {
        console.log('\n--update flag detected. Updating pnpm-workspace.yaml...');
        let toUpdate = outdated;
        if (updatePatch || updateMinor || updateMajor) {
          toUpdate = outdated.filter(dep =>
            (updatePatch && dep.type === 'patch') ||
            (updateMinor && dep.type === 'minor') ||
            (updateMajor && dep.type === 'major')
          );
        }

        toUpdate.forEach(({ name, current, latest }) => {
          if (catalog[name]) {
            catalog[name] = current.startsWith('^') ? `^${latest}` : latest;
          }
        });
        const newYaml = yaml.dump(doc);
        await Bun.write(pnpmWorkspacePath, newYaml);
        console.log('pnpm-workspace.yaml has been updated.');
      }
    } else {
      console.log('All dependencies are up to date.');
    }
  } catch (error) {
    console.error('Error checking dependencies:', error);
  }
}

checkDependencies();
