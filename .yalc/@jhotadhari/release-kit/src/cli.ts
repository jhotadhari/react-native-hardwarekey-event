import { Command } from 'commander';
import semver from 'semver';
import pc from 'picocolors';

export interface ParsedArgs {
	version: string;
	dryRun: boolean;
	test: boolean;
	lint: boolean;
	noPublish: string[];
}

const VALID_PUBLISH_TARGETS = ['github', 'npm'];

function parseNoPublish(raw: string | true | undefined): string[] {
	// --no-publish not passed at all
	if (raw === undefined) return [];

	// --no-publish (no value) → skip everything
	if (raw === true) return [...VALID_PUBLISH_TARGETS];

	// --no-publish github,npm → comma-separated
	const targets = raw
		.split(',')
		.map((t) => t.trim().toLowerCase())
		.filter((t) => t.length > 0);

	for (const t of targets) {
		if (!VALID_PUBLISH_TARGETS.includes(t)) {
			console.error(
				pc.red(
					`Invalid --no-publish target: "${t}". Valid targets: ${VALID_PUBLISH_TARGETS.join(', ')}`
				)
			);
			process.exit(1);
		}
	}

	return targets;
}

export function parseArgs(): ParsedArgs {
	const program = new Command();
	program
		.name('release-kit')
		.description('Publish a new release')
		.argument('<version>', 'SemVer version (e.g., 1.0.0, 1.0.0-alpha.1)')
		.option('--dry-run', 'Validate only, skip all mutations')
		.option('--no-test', 'Skip tests pre-flight')
		.option('--no-lint', 'Skip lint pre-flight')
		.option(
			'--no-publish [targets]',
			'Skip publish steps: "github", "npm", or comma-separated (empty = skip all)'
		)
		.allowExcessArguments(false)
		.parse();

	const version = program.args[0]!;
	if (!semver.valid(version)) {
		console.error(
			pc.red(
				'Version should be valid SemVer. ' +
					'Run `release-kit <major>.<minor>.<patch>` ' +
					'(pre-release tags like alpha/beta/rc are supported, e.g. `1.0.0-alpha.1`)'
			)
		);
		process.exit(1);
	}

	const opts = program.opts<{ dryRun?: boolean; test?: boolean; lint?: boolean; noPublish?: string | true }>();
	return {
		version,
		dryRun: opts.dryRun === true,
		test: opts.test !== false,
		lint: opts.lint !== false,
		noPublish: parseNoPublish(opts.noPublish),
	};
}
