<script lang="ts">
	import Sidebar from '$components/Sidebar.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
	}

	const { children }: Props = $props();
</script>

<section class="profile-page">
	<Sidebar />
	{@render children?.()}
</section>

<style lang="postcss">
	.profile-page {
		display: flex;
		width: 100%;
	}
</style>
