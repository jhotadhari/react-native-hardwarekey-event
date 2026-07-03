import { execSync } from 'child_process';
import pc from 'picocolors';
import { fatalError } from './checks';
import { getNpmTag } from './version';

export function runBuild(command: string, root: string): void {
	console.log(pc.blue(`Building (${command})…`));
	try {
		execSync(command, { stdio: 'inherit', cwd: root });
	} catch {
		fatalError('Build failed. Fix build errors before publishing.');
	}
	console.log(pc.green('Build completed'));
}

export function npmPublish(
	version: string,
	dryRun: boolean,
	root: string
): void {
	const tag = getNpmTag(version);
	const args: string[] = ['publish'];
	if (tag) args.push('--tag', tag);
	if (dryRun) args.push('--dry-run');

	const label = dryRun ? 'Dry-running npm publish' : 'Publishing to npm';
	const tagLabel = tag ? ` (tag: ${tag})` : '';
	console.log(pc.blue(`${label}${tagLabel}…`));

	try {
		execSync('npm ' + args.join(' '), {
			stdio: 'inherit',
			cwd: root,
		});
	} catch {
		fatalError('npm publish failed');
	}

	if (dryRun) {
		console.log(pc.green('npm publish dry-run completed'));
	} else {
		console.log(
			pc.green(
				`Published ${version} to npm${tag ? ` (tag: ${tag})` : ''}`
			)
		);
	}
}
