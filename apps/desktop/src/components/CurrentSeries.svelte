<script lang="ts">
	import {
		createIntegratedCommitsContextStore,
		createLocalCommitsContextStore,
		createLocalAndRemoteCommitsContextStore
	} from '$lib/commits/contexts';
	import { getColorFromBranchType } from '@gitbutler/ui/utils/getColorFromBranchType';
	import type { PatchSeries } from '$lib/branches/branch';
	import type { DetailedCommit } from '$lib/commits/commit';
	import type { Snippet } from 'svelte';

	interface Props {
		currentSeries: PatchSeries;
		children: Snippet;
	}

	const { currentSeries, children }: Props = $props();
	const seriesType = currentSeries.patches[0] ? currentSeries.patches[0].status : 'LocalOnly';

	const localCommits = createLocalCommitsContextStore([]);
	const localAndRemoteCommits = createLocalAndRemoteCommitsContextStore([]);
	const integratedCommits = createIntegratedCommitsContextStore([]);

	$effect(() => {
		localCommits.set(currentSeries.patches);
		localAndRemoteCommits.set(currentSeries.upstreamPatches);
		integratedCommits.set(
			currentSeries.patches.filter((p: DetailedCommit) => p.status === 'Integrated')
		);
	});
</script>

<div
	class="branch-group"
	data-series-name={currentSeries.name}
	style:--highlight-color={getColorFromBranchType(seriesType)}
>
	{@render children()}
</div>

<style>
	.branch-group {
		border: 1px solid var(--clr-border-2);
		border-radius: var(--radius-m);
		background: var(--clr-bg-1);
		scroll-margin-top: 120px;

		&:last-child {
			margin-bottom: 12px;
		}
	}
</style>
