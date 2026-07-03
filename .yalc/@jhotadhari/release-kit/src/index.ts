import pc from 'picocolors';
import type { ParsedArgs } from './cli';
import { parseArgs } from './cli';
import { resolveConfig } from './config';
import {
	validateVersionIsHigher,
	checkCleanWorkingTree,
	checkChangelogHasUnreleased,
	checkBranchIsRelease,
	checkGitHubToken,
	checkNpmAuth,
	runPreflights,
	fatalError,
} from './checks';
import { getCurrentVersion, bumpAllFiles } from './version';
import { releaseChangelog, addUnreleasedSection } from './changelog';
import {
	createGit,
	getCurrentBranch,
	gitStageAllAndCommit,
	gitMergeToMain,
	gitTagAndPush,
	gitMergeToDevelopment,
	gitStageChangelogAndCommit,
	gitPush,
} from './git';
import { createGitHubRelease } from './github';
import { runBuild, npmPublish } from './npm';
import {
	loadState,
	saveState,
	clearState,
	isCompleted,
	type StepKey,
} from './state';
import type { ReleaseConfig } from './types';

export const release = async (userConfig: ReleaseConfig): Promise<void> => {
	const cwd = process.cwd();
	const config = resolveConfig(cwd, userConfig);

	// 1. Parse version and flags from CLI args
	const args: ParsedArgs = parseArgs();
	const { version, dryRun } = args;

	if (dryRun) {
		console.log(pc.yellow('--dry-run: no mutations will be made'));
	}
	if (args.noPublish.length > 0) {
		console.log(
			pc.yellow(`--no-publish: skipping ${args.noPublish.join(', ')}`)
		);
	}
	console.log(
		pc.blue(`Publishing v${version}${dryRun ? ' (dry-run)' : ''}…`)
	);

	const git = createGit(cwd);

	// Guard: bumpFiles must be configured
	const pkgs = config.bumpFiles;
	if (!pkgs || pkgs.length === 0) {
		fatalError(
			'No bumpFiles configured. At least one file (e.g. package.json) is required.'
		);
	}
	const pkgPath =
		pkgs.find((bf) => bf.path.endsWith('package.json'))?.path ??
		pkgs[0]!.path;
	const changelogPath = config.changelog?.path;
	if (!changelogPath) {
		fatalError(
			'changelog.path is required. Set changelog.path in your release config.'
		);
	}

	// Check for resume state before pre-flight (some checks depend on it)
	const releaseBranch = await getCurrentBranch(git);
	const existingState = loadState(cwd);

	if (existingState) {
		if (existingState.version !== version) {
			console.warn(
				pc.yellow(
					`State file version (${existingState.version}) does not match ${version} — starting fresh.`
				)
			);
			clearState(cwd);
		} else if (existingState.releaseBranch !== releaseBranch) {
			// After merge_main or merge_development, the branch legitimately changes.
			// Don't clear state if we're past a merge step — the branch switch is expected.
			const pastMergeMain = isCompleted(
				existingState.completedStep,
				'merge_main'
			);
			if (pastMergeMain) {
				console.log(
					pc.blue(
						`Resuming from step "${existingState.completedStep}" (state branch: ${existingState.releaseBranch}, current: ${releaseBranch})`
					)
				);
			} else {
				console.warn(
					pc.yellow(
						`State file branch (${existingState.releaseBranch}) does not match ${releaseBranch} — starting fresh.`
					)
				);
				clearState(cwd);
			}
		} else {
			console.log(
				pc.blue(
					`Resuming from step "${existingState.completedStep}"`
				)
			);
		}
	}

	const state = loadState(cwd);
	const completedStep = state?.completedStep ?? null;
	const stateBranch = state?.releaseBranch ?? releaseBranch;

	// Restore saved flags on resume (state values take precedence over CLI args).
	// noTest/noLint store inverse semantics: true means "was skipped" (--no-test / --no-lint).
	const effectiveNoPublish = state?.noPublish ?? args.noPublish;

	const done = (step: StepKey) =>
		completedStep ? isCompleted(completedStep, step) : false;

	// Helper: should we attempt to publish to a given target?
	const shouldPublish = (target: 'github' | 'npm'): boolean => {
		if (effectiveNoPublish.includes(target)) return false;
		if (target === 'github') return config.publish?.github !== false;
		if (target === 'npm') return !!config.publish?.npm;
		return false;
	};

	// 2. Pre-flight validations (some skipped on resume)
	if (!done('bump')) {
		await validateVersionIsHigher(version, pkgPath, git);
	} else {
		console.log(pc.yellow('Skipping version check (already bumped)'));
	}
	// Clean-tree check: skip if already committed (dirty files from bump/changelog are expected)
	if (!done('commit')) {
		await checkCleanWorkingTree(git);
	} else {
		console.log(
			pc.yellow('Skipping clean tree check (already committed)')
		);
	}
	if (config.changelog && !done('changelog')) {
		checkChangelogHasUnreleased(changelogPath);
	} else if (config.changelog) {
		console.log(
			pc.yellow('Skipping [Unreleased] check (already released)')
		);
	}
	await checkBranchIsRelease(git, config.branches!.releasePrefix!);
	if (shouldPublish('github') && !done('github_release')) {
		checkGitHubToken();
	}
	if (shouldPublish('npm') && !done('npm_publish')) {
		checkNpmAuth();
	}
	// Re-apply saved flags on resume
	const preflightTest = state?.noTest ? false : args.test;
	const preflightLint = state?.noLint ? false : args.lint;
	runPreflights(config, cwd, { test: preflightTest, lint: preflightLint });

	// 3. Dry-run: stop here, before any mutations
	if (dryRun) {
		console.log(
			pc.green(
				'All pre-flight checks passed. Ready to publish v' +
					version +
					'.'
			)
		);
		console.log(pc.yellow('Run again without --dry-run to publish.'));
		return;
	}

	// On resume, preserve the originally-saved noTest/noLint flags so they
	// survive through subsequent save() calls.
	const save = (step: StepKey) =>
		saveState(cwd, {
			version,
			completedStep: step,
			releaseBranch: stateBranch,
			noPublish:
				effectiveNoPublish.length > 0
					? effectiveNoPublish
					: undefined,
			// Inverse semantics: true means "was skipped" (--no-test / --no-lint)
			noTest: state?.noTest ?? (args.test ? undefined : true),
			noLint: state?.noLint ?? (args.lint ? undefined : true),
		});

	// 4. Bump version in all configured files
	if (!done('bump')) {
		const currentVersion = getCurrentVersion(pkgPath);
		bumpAllFiles(config, currentVersion, version);
		save('bump');
	}

	// 5. Release changelog
	if (!done('changelog')) {
		if (config.changelog !== undefined) {
			releaseChangelog(version, changelogPath, config.repo);
		}
		save('changelog');
	}

	// 6. Stage & commit on release branch
	if (!done('commit')) {
		await gitStageAllAndCommit(git, `chore: release v${version}`);
		save('commit');
	}

	// 7. Merge to main, tag, push
	if (!done('merge_main')) {
		await gitMergeToMain(git, stateBranch, config.branches!.main!);
		await gitTagAndPush(git, version);
		save('merge_main');
	}

	// 8. GitHub release
	if (!done('github_release')) {
		if (shouldPublish('github')) {
			await createGitHubRelease(version, config.repo, changelogPath);
		} else {
			console.log(pc.yellow('Skipping GitHub release'));
		}
		save('github_release');
	}

	// 9. Build and npm publish
	if (!done('npm_publish')) {
		const npmConfig = config.publish?.npm;
		if (shouldPublish('npm')) {
			const buildCommand =
				typeof npmConfig === 'object'
					? (npmConfig.buildCommand ?? false)
					: false;
			if (buildCommand) {
				runBuild(buildCommand, cwd);
			}
			npmPublish(version, false, cwd);
		} else if (effectiveNoPublish.includes('npm')) {
			console.log(pc.yellow('Skipping npm publish'));
		}
		save('npm_publish');
	}

	// 10. Merge to development
	if (!done('merge_development')) {
		await gitMergeToDevelopment(
			git,
			stateBranch,
			config.branches!.development!
		);
		save('merge_development');
	}

	// 11. Re-add [Unreleased] section, commit, push
	if (!done('unreleased')) {
		if (config.changelog !== undefined) {
			addUnreleasedSection(changelogPath, config.repo);
			await gitStageChangelogAndCommit(
				git,
				changelogPath,
				'chore: add [Unreleased] section to CHANGELOG.md'
			);
			await gitPush(git);
		}
		save('unreleased');
	}

	clearState(cwd);
	console.log(pc.green(`Done — v${version} published successfully.`));
};

// Re-export for consumers
export { defineConfig } from './types';
export type { ReleaseConfig, BumpFile, VersionCodeConfig } from './types';
