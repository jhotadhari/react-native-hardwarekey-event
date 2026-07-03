import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import pc from 'picocolors';
import semver from 'semver';
import type { ReleaseConfig, VersionCodeConfig } from './types';
import { fatalError } from './checks';

export function getNpmTag(version: string): string | undefined {
	const parsed = semver.parse(version);
	if (!parsed || parsed.prerelease.length === 0) return undefined;
	return parsed.prerelease[0] as string;
}

export function getCurrentVersion(pkgPath: string): string {
	const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
	return pkg.version as string;
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getVersionCode(
	version: string,
	config: VersionCodeConfig
): number {
	const parsed = semver.parse(version);
	if (!parsed) {
		fatalError(`Could not parse version: ${version}`);
	}
	const { major, minor, patch } = parsed;
	const { multiplier } = config;
	const base =
		major * multiplier.major +
		minor * multiplier.minor +
		patch * multiplier.patch;

	if (parsed.prerelease.length === 0) {
		return base + 99;
	}

	const preType = (parsed.prerelease[0] as string) ?? '';
	const preNum = Math.min(Number(parsed.prerelease[1]) || 0, 32);
	const typeOffset = config.preReleaseOffsets?.[preType];
	if (typeOffset === undefined) {
		fatalError(
			`Unsupported pre-release type "${preType}". ` +
				'Use one of: alpha, beta, rc.'
		);
	}

	return base + typeOffset + preNum;
}

export function bumpJsonFile(
	filePath: string,
	key: string,
	currentVersion: string,
	newVersion: string,
	label: string
): void {
	const pkg = JSON.parse(readFileSync(filePath, 'utf-8'));
	pkg[key] = newVersion;
	writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
	console.log(
		pc.green(
			`Bumped version in ${label}: ${currentVersion} → ${newVersion}`
		)
	);
}

export function bumpGradleFile(
	filePath: string,
	currentVersion: string,
	newVersion: string,
	versionCodeConfig: VersionCodeConfig
): void {
	let content = readFileSync(filePath, 'utf-8');

	// Replace versionName
	const versionNameRegex = new RegExp(
		`(versionName\\s+)"${escapeRegex(currentVersion)}"`
	);
	if (!versionNameRegex.test(content)) {
		fatalError(
			`Could not find versionName "${currentVersion}" in ${path.basename(filePath)}`
		);
	}
	content = content.replace(versionNameRegex, `$1"${newVersion}"`);

	// Replace versionCode
	const oldVersionCode = content.match(/versionCode\s+(\d+)/);
	const versionCodeRegex = /(versionCode\s+)\d+/;
	if (!versionCodeRegex.test(content)) {
		fatalError(`Could not find versionCode in ${path.basename(filePath)}`);
	}
	const newVersionCode = getVersionCode(newVersion, versionCodeConfig);
	content = content.replace(versionCodeRegex, `$1${newVersionCode}`);

	writeFileSync(filePath, content, 'utf-8');
	console.log(
		pc.green(
			`Bumped version in ${path.basename(filePath)}: ${currentVersion} → ${newVersion} (versionCode: ${oldVersionCode ? oldVersionCode[1] : '?'} → ${newVersionCode})`
		)
	);
}

export function bumpAllFiles(
	config: ReleaseConfig,
	currentVersion: string,
	newVersion: string
): void {
	for (const bumpFile of config.bumpFiles!) {
		const label = path.basename(bumpFile.path);
		switch (bumpFile.type) {
			case 'json':
				bumpJsonFile(
					bumpFile.path,
					bumpFile.key ?? 'version',
					currentVersion,
					newVersion,
					label
				);
				break;
			case 'gradle':
				if (!config.versionCode) {
					fatalError(
						'versionCode config is required for bumping gradle files'
					);
				}
				bumpGradleFile(
					bumpFile.path,
					currentVersion,
					newVersion,
					config.versionCode
				);
				break;
		}
	}
}
