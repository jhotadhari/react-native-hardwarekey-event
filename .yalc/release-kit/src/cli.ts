import { Command } from 'commander';
import semver from 'semver';
import pc from 'picocolors';

export function parseArgs(): {
	version: string;
	dryRun: boolean;
	test: boolean;
	lint: boolean;
} {
	const program = new Command();
	program
		.name('release-kit')
		.description('Publish a new release')
		.argument('<version>', 'SemVer version (e.g., 1.0.0, 1.0.0-alpha.1)')
		.option('--dry-run', 'Validate only, skip all mutations')
		.option('--no-test', 'Skip tests pre-flight')
		.option('--no-lint', 'Skip lint pre-flight')
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

	const opts = program.opts();
	return {
		version,
		dryRun: opts.dryRun === true,
		test: opts.test !== false,
		lint: opts.lint !== false,
	};
}
