#!/usr/bin/env node

const path = require('path');
const tsx = require('tsx/cjs/api');

const cwd = process.cwd();

let config;
try {
	config = tsx.require(
		path.resolve(cwd, 'release.config.ts'),
		__filename
	).default;
} catch (err) {
	console.error(
		'ERROR: Could not load release.config.ts from',
		cwd
	);
	console.error(
		'Make sure a release.config.ts file exists in the project root.'
	);
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
}

const { release } = tsx.require(
	path.resolve(__dirname, '../src/index.ts'),
	__filename
);

release(config).catch((err) => {
	console.error(err?.message ?? err);
	process.exit(1);
});
