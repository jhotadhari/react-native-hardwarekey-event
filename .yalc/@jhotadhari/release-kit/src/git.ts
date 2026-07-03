import pc from 'picocolors';
import simpleGit from 'simple-git';
import type { SimpleGit } from 'simple-git';

export function createGit(root: string): SimpleGit {
	return simpleGit(root);
}

export async function getCurrentBranch(git: SimpleGit): Promise<string> {
	return (await git.status()).current ?? '';
}

export async function gitStageAllAndCommit(
	git: SimpleGit,
	message: string
): Promise<void> {
	await git.add('.');
	await git.commit(message);
	console.log(pc.green(`Committed: ${message}`));
}

export async function gitMergeToMain(
	git: SimpleGit,
	releaseBranch: string,
	mainBranch: string
): Promise<void> {
	console.log(pc.blue(`Checking out ${mainBranch}…`));
	await git.checkout(mainBranch);
	console.log(pc.blue(`Merging ${releaseBranch} into ${mainBranch}…`));
	await git.merge([
		releaseBranch,
		'--no-ff',
		'--commit',
		'--no-edit',
	]);
	console.log(pc.green(`Merged ${releaseBranch} into ${mainBranch}`));
}

export async function gitTagAndPush(
	git: SimpleGit,
	version: string
): Promise<void> {
	const tagName = `v${version}`;
	await git.addTag(tagName);
	await git.push(['origin', tagName]);
	await git.push();
	console.log(pc.green(`Pushed tag ${tagName}`));
}

export async function gitMergeToDevelopment(
	git: SimpleGit,
	releaseBranch: string,
	developmentBranch: string
): Promise<void> {
	console.log(pc.blue(`Checking out ${developmentBranch}…`));
	await git.checkout(developmentBranch);
	console.log(pc.blue(`Merging ${releaseBranch} into ${developmentBranch}…`));
	await git.merge([
		releaseBranch,
		'--no-ff',
		'--commit',
		'--no-edit',
	]);
	console.log(pc.green(`Merged ${releaseBranch} into ${developmentBranch}`));
}

export async function gitStageChangelogAndCommit(
	git: SimpleGit,
	changelogPath: string,
	message: string
): Promise<void> {
	await git.add(changelogPath);
	await git.commit(message);
	console.log(pc.green(`Committed: ${message}`));
}

export async function gitPush(git: SimpleGit): Promise<void> {
	await git.push();
	console.log(pc.green('Pushed to origin'));
}
