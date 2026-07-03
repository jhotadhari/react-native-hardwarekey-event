import { readFileSync, writeFileSync } from 'fs';
import pc from 'picocolors';
import { parser, Release } from 'keep-a-changelog';
import type { Changelog } from 'keep-a-changelog';
import { fatalError } from './checks';

export function readChangelog(changelogPath: string): Changelog {
	const content = readFileSync(changelogPath, 'utf-8');
	return parser(content, { autoSortReleases: true });
}

export function writeChangelog(
	changelog: Changelog,
	changelogPath: string,
	repoUrl: string
): void {
	changelog.url = repoUrl;
	changelog.format = 'markdownlint';
	writeFileSync(changelogPath, changelog.toString(), 'utf-8');
}

export function releaseChangelog(
	version: string,
	changelogPath: string,
	repoUrl: string
): void {
	const changelog = readChangelog(changelogPath);

	const unreleased = changelog.releases.find((r) => !r.version);
	if (!unreleased) {
		fatalError('No unreleased section found in CHANGELOG.md');
	}

	unreleased.setVersion(version);
	unreleased.setDate(new Date());

	writeChangelog(changelog, changelogPath, repoUrl);
	console.log(pc.green(`Released changelog: [Unreleased] → [${version}]`));
}

export function addUnreleasedSection(
	changelogPath: string,
	repoUrl: string
): void {
	const changelog = readChangelog(changelogPath);
	changelog.addRelease(new Release());
	writeChangelog(changelog, changelogPath, repoUrl);
	console.log(pc.green('Added [Unreleased] section to CHANGELOG.md'));
}

export function extractReleaseBody(
	version: string,
	changelogPath: string
): string {
	const changelog = readChangelog(changelogPath);
	const release = changelog.findRelease(version);
	if (!release) {
		fatalError(`Cannot find release ${version} in CHANGELOG.md`);
	}

	const parts: string[] = [];

	if (release.description?.trim()) {
		parts.push(release.description.trim());
		parts.push('');
	}

	release.changes.forEach((changes, type) => {
		if (changes.length === 0) return;
		parts.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)}`);
		changes.forEach((change) => {
			parts.push(change.toString());
		});
		parts.push('');
	});

	return parts.join('\n').trim();
}
