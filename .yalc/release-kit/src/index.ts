import pc from 'picocolors';
import { parseArgs } from './cli';
import { resolveConfig } from './config';
import {
	validateVersionIsHigher,
	checkCleanWorkingTree,
	checkChangelogHasUnreleased,
	checkBranchIsRelease,
	runPreflights,
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
import type { ReleaseConfig } from './types';

export const release = async (userConfig: ReleaseConfig): Promise<void> => {
	const cwd = process.cwd();
	const config = resolveConfig(cwd, userConfig);

	// 1. Parse version and flags from CLI args
	const { version, dryRun, test, lint } = parseArgs();

	if (dryRun) {
		console.log(pc.yellow('--dry-run: no mutations will be made'));
	}
	console.log(
		pc.blue(`Publishing v${version}${dryRun ? ' (dry-run)' : ''}…`)
	);

	const git = createGit(cwd);
	const pkgPath =
		config.bumpFiles?.find((bf) => bf.path.endsWith('package.json'))
			?.path ?? config.bumpFiles![0]!.path;
	const changelogPath = config.changelog!.path!;

	// 2. Pre-flight validations
	await validateVersionIsHigher(version, pkgPath, git);
	await checkCleanWorkingTree(git);
	if (config.changelog) {
		checkChangelogHasUnreleased(changelogPath);
	}
	await checkBranchIsRelease(git, config.branches!.releasePrefix!);
	runPreflights(config, cwd, { test, lint });

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

	// 4. Bump version in all configured files
	const currentVersion = getCurrentVersion(pkgPath);
	bumpAllFiles(config, currentVersion, version);

	// 5. Release changelog
	if (config.changelog !== undefined) {
		releaseChangelog(version, changelogPath, config.repo);
	}

	// 6. Stage & commit on release branch
	await gitStageAllAndCommit(git, `chore: release v${version}`);

	// 7. Merge to main, tag, push
	const releaseBranch = await getCurrentBranch(git);
	await gitMergeToMain(git, releaseBranch, config.branches!.main!);
	await gitTagAndPush(git, version);

	// 8. GitHub release
	if (config.publish?.github !== false) {
		await createGitHubRelease(version, config.repo, changelogPath);
	}

	// 9. Build and npm publish
	const npmConfig = config.publish?.npm;
	if (npmConfig) {
		const buildCommand =
			typeof npmConfig === 'object'
				? (npmConfig.buildCommand ?? 'yarn prepare')
				: 'yarn prepare';
		runBuild(buildCommand, cwd);
		npmPublish(version, false, cwd);
	}

	// 10. Merge to development
	await gitMergeToDevelopment(
		git,
		releaseBranch,
		config.branches!.development!
	);

	// 11. Re-add [Unreleased] section, commit, push
	if (config.changelog !== undefined) {
		addUnreleasedSection(changelogPath, config.repo);
		await gitStageChangelogAndCommit(
			git,
			changelogPath,
			'chore: add [Unreleased] section to CHANGELOG.md'
		);
		await gitPush(git);
	}

	console.log(pc.green(`Done — v${version} published successfully.`));
};

// Re-export for consumers
export { defineConfig } from './types';
export type { ReleaseConfig, BumpFile, VersionCodeConfig } from './types';
