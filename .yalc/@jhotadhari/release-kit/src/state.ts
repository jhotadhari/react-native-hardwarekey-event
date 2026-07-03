import {
	readFileSync,
	writeFileSync,
	unlinkSync,
	existsSync,
	renameSync,
} from 'fs';
import path from 'path';
import pc from 'picocolors';

/** Ordered list of pipeline steps. Order matters — resume compares by index.
 *  Must match the execution order of step bodies in src/index.ts. */
export const STEP_ORDER = [
	'bump',
	'changelog',
	'commit',
	'merge_main',
	'github_release',
	'npm_publish',
	'merge_development',
	'unreleased',
] as const;

export type StepKey = (typeof STEP_ORDER)[number];

export interface PipelineState {
	version: string;
	completedStep: StepKey;
	releaseBranch: string;
	noPublish?: string[];
	/** Inverse semantics: true means tests were skipped (--no-test was passed) */
	noTest?: boolean;
	/** Inverse semantics: true means lint was skipped (--no-lint was passed) */
	noLint?: boolean;
}

const STATE_FILE = '.release-kit-state.json';

/** Returns true if `step` has already been completed (index <= completedStep index). */
export function isCompleted(
	completedStep: StepKey,
	step: StepKey
): boolean {
	const completedIdx = STEP_ORDER.indexOf(completedStep);
	const stepIdx = STEP_ORDER.indexOf(step);
	// Unknown step key at runtime (e.g. from untyped JSON) — treat as not completed
	if (completedIdx < 0 || stepIdx < 0) return false;
	return completedIdx >= stepIdx;
}

/** Returns the step immediately after the given step, or null if it was the last. */
export function nextStep(step: StepKey): StepKey | null {
	const idx = STEP_ORDER.indexOf(step);
	if (idx < 0 || idx >= STEP_ORDER.length - 1) return null;
	return STEP_ORDER[idx + 1]!;
}

// Legacy numeric-to-string-key migration (0.0.4 format).
// Derived from STEP_ORDER so it stays in sync automatically.
const LEGACY_MAP: Record<number, StepKey> = Object.fromEntries(
	STEP_ORDER.map((key, i) => [i + 4, key])
) as Record<number, StepKey>;

export function loadState(cwd: string): PipelineState | null {
	const statePath = path.join(cwd, STATE_FILE);
	if (!existsSync(statePath)) return null;

	try {
		const raw = readFileSync(statePath, 'utf-8');
		const state = JSON.parse(raw) as PipelineState;

		// Basic validation
		if (
			!state.version ||
			!state.completedStep ||
			!state.releaseBranch
		) {
			console.warn(
				pc.yellow(
					`Invalid ${STATE_FILE} found — ignoring (missing required fields)`
				)
			);
			return null;
		}

		// Validate version is a string (JSON.parse can produce numbers)
		if (typeof state.version !== 'string') {
			console.warn(
				pc.yellow(
					`Invalid ${STATE_FILE}: version must be a string — ignoring`
				)
			);
			return null;
		}

		// Migrate legacy numeric step (0.0.4 format) to string key
		if (typeof state.completedStep === 'number') {
			const migrated = LEGACY_MAP[state.completedStep];
			if (migrated) {
				state.completedStep = migrated;
			} else {
				console.warn(
					pc.yellow(
						`Invalid ${STATE_FILE}: legacy numeric step ${state.completedStep} cannot be migrated — ignoring`
					)
				);
				return null;
			}
		}

		if (!STEP_ORDER.includes(state.completedStep)) {
			console.warn(
				pc.yellow(
					`Invalid ${STATE_FILE}: unknown step "${state.completedStep}" — ignoring`
				)
			);
			return null;
		}

		// Validate releaseBranch is a string
		if (typeof state.releaseBranch !== 'string') {
			console.warn(
				pc.yellow(
					`Invalid ${STATE_FILE}: releaseBranch must be a string — ignoring`
				)
			);
			return null;
		}

		return state;
	} catch (err: unknown) {
		const message =
			err instanceof SyntaxError
				? `Could not parse ${STATE_FILE} (invalid JSON) — ignoring`
				: `Could not read ${STATE_FILE}: ${err instanceof Error ? err.message : String(err)} — ignoring`;
		console.warn(pc.yellow(message));
		return null;
	}
}

/** Write state file atomically: write to temp, then rename. */
export function saveState(cwd: string, state: PipelineState): void {
	const statePath = path.join(cwd, STATE_FILE);
	const tmpPath = statePath + '.tmp';
	writeFileSync(tmpPath, JSON.stringify(state, null, 2) + '\n', 'utf-8');
	renameSync(tmpPath, statePath);
}

export function clearState(cwd: string): void {
	const statePath = path.join(cwd, STATE_FILE);
	if (existsSync(statePath)) {
		unlinkSync(statePath);
	}
}
