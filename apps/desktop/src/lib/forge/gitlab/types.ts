import type { DetailedPullRequest, Label, PullRequest } from '$lib/forge/interface/types';
import type { ExpandedMergeRequestSchema, MergeRequestSchema } from '@gitbeaker/rest';

export function detailedMrToInstance(data: ExpandedMergeRequestSchema): DetailedPullRequest {
	return {
		id: data.id,
		number: data.iid,
		title: data.title,
		body: data.description ?? undefined,
		baseBranch: data.target_branch,
		sourceBranch: data.source_branch,
		draft: data.draft,
		htmlUrl: data.web_url,
		createdAt: data.created_at,
		mergedAt: data.merged_at || undefined,
		closedAt: data.closed_at || undefined,
		updatedAt: data.updated_at,
		merged: !!data.merged_at,
		mergeable: data.merge_status === 'can_be_merged',
		mergeableState: data.merge_status,
		rebaseable: data.merge_status === 'can_be_merged',
		squashable: data.merge_status === 'can_be_merged',
		state: data.state === 'opened' ? 'open' : 'closed',
		fork: false // seems hard to get
	};
}

export function mrToInstance(pr: MergeRequestSchema): PullRequest {
	const labels: Label[] = pr.labels?.map((label) => {
		if (typeof label === 'string') {
			return {
				name: label,
				description: undefined,
				color: 'pink'
			};
		} else {
			return {
				name: label.name,
				description: label.description || undefined,
				color: label.color
			};
		}
	});

	return {
		htmlUrl: pr.web_url,
		number: pr.iid,
		title: pr.title,
		body: pr.description || undefined,
		author: pr.author
			? {
					name: pr.author.name || undefined,
					email: pr.author.username || undefined,
					isBot: false,
					gravatarUrl: pr.author.avatar_url
				}
			: null,
		labels: labels,
		draft: pr.draft || false,
		createdAt: pr.created_at,
		modifiedAt: pr.created_at,
		sourceBranch: pr.source_branch,
		targetBranch: pr.target_branch,
		sha: pr.sha,
		mergedAt: pr.merged_at || undefined,
		closedAt: pr.closed_at || undefined,
		repoOwner: '', // This is fine
		repositorySshUrl: '', // This is hopfully not used
		repositoryHttpsUrl: '' // This is hopfully not used
	};
}
