import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import pc from 'picocolors';
import semver from 'semver';
import type { SimpleGit } from 'simple-git';
import type { ReleaseConfig } from './types';

export function fatalError(message: string): never {
	console.error(pc.red('ERROR'), message);
	process.exit(1);
}

function getCurrentVersion(pkgPath: string): string {
	const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
	return pkg.version as string;
}

export async function validateVersionIsHigher(
	newVersion: string,
	pkgPath: string,
	git: SimpleGit
): Promise<void> {
	await git.fetch(['--tags']);
	const currentVersion = getCurrentVersion(pkgPath);

	if (semver.lte(newVersion, currentVersion)) {
		fatalError(
			`New version (${newVersion}) must be higher than current version (${currentVersion})`
		);
	}
}

export async function checkCleanWorkingTree(git: SimpleGit): Promise<void> {
	const status = await git.status();
	if (!status.isClean()) {
		const dirtyFiles = status.files
			.map((f) => `  ${f.index} ${f.path}`)
			.join('\n');
		fatalError('Unable to publish. Uncommitted changes.\n' + dirtyFiles);
	}
}

export function checkGitHubToken(): void {
	if (!process.env.GITHUB_TOKEN) {
		fatalError(
			'GITHUB_TOKEN environment variable is required to create a GitHub release. ' +
				'Run `export GITHUB_TOKEN=$(gh auth token)` or generate one at ' +
				'https://github.com/settings/tokens (scope: repo).'
		);
	}
}

export function checkNpmAuth(): void {
	try {
		const whoami = execSync('npm whoami', { encoding: 'utf-8' }).trim();
		if (!whoami) {
			fatalError(
				'npm authentication required. Run `npm login` or `npm adduser` first.'
			);
		}
		console.log(pc.green(`npm authenticated as ${whoami}`));
	} catch {
		fatalError(
			'npm authentication required. Run `npm login` or `npm adduser` first.'
		);
	}
}

export function checkChangelogHasUnreleased(changelogPath: string): void {
	const content = readFileSync(changelogPath, 'utf-8');
	if (!/## \[?Unreleased\]?/i.test(content)) {
		fatalError('CHANGELOG.md should have an `[Unreleased]` or `Unreleased` section');
	}
}

export async function checkBranchIsRelease(
	git: SimpleGit,
	releasePrefix: string
): Promise<void> {
	const branch = (await git.branch()).current;
	if (!branch.startsWith(releasePrefix)) {
		fatalError(
			`Current branch name should start with \`${releasePrefix}\``
		);
	}
}

export function runCommand(label: string, command: string, cwd: string): void {
	console.log(pc.blue(`${label}…`));
	try {
		execSync(command, { stdio: 'inherit', cwd });
	} catch {
		fatalError(`Unable to publish. ${label} failed. Fix errors first!`);
	}
}

export function runPreflights(
	config: ReleaseConfig,
	root: string,
	opts: { test: boolean; lint: boolean }
): void {
	// Always run typecheck
	runCommand(
		'Typecheck',
		config.preflight?.typecheck || 'yarn typecheck',
		root
	);

	if (config.preflight?.lint !== false && opts.lint) {
		runCommand('Lint', config.preflight?.lint || 'yarn lint', root);
	} else if (!opts.lint) {
		console.log(pc.yellow('Skipping lint (--no-lint)'));
	}

	if (config.preflight?.test !== false && opts.test) {
		runCommand('Tests', config.preflight?.test || 'yarn test', root);
	} else if (!opts.test) {
		console.log(pc.yellow('Skipping tests (--no-test)'));
	}
}
