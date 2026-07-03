import pc from 'picocolors';
import { Octokit } from '@octokit/rest';
import { fatalError } from './checks';
import { extractReleaseBody } from './changelog';

interface RepoInfo {
	owner: string;
	repo: string;
}

function parseRepoUrl(repoUrl: string): RepoInfo {
	// https://github.com/owner/repo
	const httpsMatch = repoUrl.match(
		/https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?\s*$/
	);
	if (httpsMatch) {
		return {
			owner: httpsMatch[1]!,
			repo: httpsMatch[2]!.replace(/\.git$/, '').replace(/\/$/, ''),
		};
	}

	// Fallback: treat as owner/repo
	const slashMatch = repoUrl.match(/^([^/]+)\/(.+)$/);
	if (slashMatch) {
		return { owner: slashMatch[1]!, repo: slashMatch[2]! };
	}

	fatalError(
		'Could not parse GitHub owner/repo from: ' +
			repoUrl +
			'. ' +
			'Use a full https:// URL or owner/repo format.'
	);
}

async function findReleaseByTag(
	octokit: Octokit,
	owner: string,
	repo: string,
	tag: string
): Promise<{ id: number } | null> {
	try {
		const { data } = await octokit.rest.repos.getReleaseByTag({
			owner,
			repo,
			tag,
		});
		return { id: data.id };
	} catch (err: unknown) {
		if (
			err &&
			typeof err === 'object' &&
			'status' in err &&
			(err as { status: number }).status === 404
		) {
			return null;
		}
		throw err;
	}
}

export async function createGitHubRelease(
	version: string,
	repoUrl: string,
	changelogPath: string
): Promise<void> {
	const token = process.env.GITHUB_TOKEN;
	if (!token) {
		fatalError(
			'GITHUB_TOKEN environment variable is required to create a GitHub release. ' +
				'Run `export GITHUB_TOKEN=$(gh auth token)` or generate one at ' +
				'https://github.com/settings/tokens (scope: repo).'
		);
	}

	const octokit = new Octokit({ auth: token });
	const { owner, repo } = parseRepoUrl(repoUrl);
	const tagName = 'v' + version;
	const body = extractReleaseBody(version, changelogPath);

	const existingRelease = await findReleaseByTag(
		octokit,
		owner,
		repo,
		tagName
	);

	if (existingRelease) {
		await octokit.rest.repos.updateRelease({
			owner,
			repo,
			release_id: existingRelease.id,
			tag_name: tagName,
			name: tagName,
			body,
			draft: false,
		});
		console.log(pc.green('Updated GitHub release: ' + tagName));
	} else {
		await octokit.rest.repos.createRelease({
			owner,
			repo,
			tag_name: tagName,
			name: tagName,
			body,
			draft: false,
		});
		console.log(pc.green('Created GitHub release: ' + tagName));
	}
}
