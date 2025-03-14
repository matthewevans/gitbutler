import { getPr } from '$lib/forge/getPr.svelte';
import { ProjectService } from '$lib/project/projectService';
import { BranchService as CloudBranchService } from '@gitbutler/shared/branches/branchService';
import { getBranchReview } from '@gitbutler/shared/branches/branchesPreview.svelte';
import { lookupLatestBranchUuid } from '@gitbutler/shared/branches/latestBranchLookup.svelte';
import { LatestBranchLookupService } from '@gitbutler/shared/branches/latestBranchLookupService';
import { inject } from '@gitbutler/shared/context';
import { isFound, map } from '@gitbutler/shared/network/loadable';
import { getProjectByRepositoryId } from '@gitbutler/shared/organizations/projectsPreview.svelte';
import { readableToReactive } from '@gitbutler/shared/reactiveUtils.svelte';
import { AppState } from '@gitbutler/shared/redux/store.svelte';
import type { PatchSeries } from '$lib/branches/branch';
import type { Reactive } from '@gitbutler/shared/storeUtils';

export function syncPrToBr(branch: Reactive<PatchSeries>) {
	const pr = getPr(branch);

	const [projectService, appState, latestBranchLookupService, cloudBranchService] = inject(
		ProjectService,
		AppState,
		LatestBranchLookupService,
		CloudBranchService
	);
	const project = readableToReactive(projectService.project);

	const cloudProject = $derived(
		project.current?.api?.repository_id
			? getProjectByRepositoryId(project.current.api.repository_id)
			: undefined
	);

	const cloudBranchUuid = $derived(
		map(cloudProject?.current, (cloudProject) => {
			if (!branch.current.reviewId) return;

			return lookupLatestBranchUuid(
				appState,
				latestBranchLookupService,
				cloudProject.owner,
				cloudProject.slug,
				branch.current.reviewId
			);
		})
	);

	const cloudBranch = $derived(
		map(cloudBranchUuid?.current, (cloudBranchUuid) => {
			return getBranchReview(cloudBranchUuid);
		})
	);

	$effect(() => {
		if (!project.current?.api) return;
		if (!pr.current) return;
		if (!isFound(cloudBranch?.current)) return;
		if (cloudBranch.current.value.forgeUrl) return;

		cloudBranchService.updateBranch(cloudBranch.current.id, {
			forgeUrl: pr.current.htmlUrl,
			forgeDescription: `#${pr.current.number}`
		});
	});
}
