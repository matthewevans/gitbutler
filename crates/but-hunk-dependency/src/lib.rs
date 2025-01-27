#![feature(unsigned_signed_diff)]
#![deny(missing_docs, rust_2018_idioms)]
//! ## Terminology
//! * **CommittedHunk**
//!     - A change that was committed, typically in the form of a hunk, i.e. the range that a hunk occupied in an old version of a file,
//!       along with the range that it occupies in a current version.
//!
//! ## A possible future
//!
//! What follows is research on how one could implement a perfectly *accurate* version of the existing algorithm that *doesn't* use patch context lines,
//! while producing the result-blobs for each commit as needed 'automatically'.
//!
//! For now, this crate just ports `gitbutler-hunk-dependency` to `gix` types.
//!
//! ### Terminology
//!
//! * **WorktreeHunk**
//!     - A patch if applied to `HEAD^{tree}` would turn that resource into the `WorktreeState`.
//! * **CommitHunk**
//!     - A patch generated from a commit and its parent, indicating the change that the commit represents.
//!     - If there are multiple parents, only the first one is used for obtaining CommitHunks.
//! * **WorktreeState**
//!     - A file at a `Path` as it would be found in the *worktree*.
//!     - If that file is compared to the `HEAD^{tree}` we get `WorktreeHunks`.
//! * **CommitState**
//!     - A *Blob* in the *Git tree* at a `Path`.
//! * **Blob**
//!     - The bytes of a file, ready for storage in Git.
//! * **BranchTip**
//!     - The top-most commit in a Git branch.
//! * **BranchBase**
//!     - The floor of a Git branch, which itself isn't considered part of the branch anymore.
//!     - The *base* is used to compute a `CommitHunk` with its direct descendant commit, but its own `CommitHunk` is never used.
//! * **Branch**
//!     - A branch is all commits from a single `BranchTip` that is bounded by one or more `BranchBases`.
//!     - Just a Git branch.
//! * **Stack**
//!     - A list of `Branches` whose *commits* are naturally connected to each other, so the top-most `Branch` is connected with the bottom-most `Branch`.
//!     - These aren't represented directly here, as a `Stack` can be represented as `BranchTip` of the top-most branch to the `BranchBases` of the bottom-most branch,
//!       and we use the term `Branch` here for simplification instead of `Stack`.
//! * **BranchCommits**
//!     - The *commits* between the `BranchTip` and the `BranchBases`.
//! * **Workspace**
//!     - A set of `Stacks` which are all merged together into a single worktree, represented by a `WorkspaceCommit` that is an octopus merge between the `BranchTips` of all `Stacks`.
//! * **WorkspaceCommit**
//!     - The commit as the result of the octopus between the `BranchTips` of all `Stacks`.
//!     - Its tree is a merge of all `Stacks` and contains all their changes.
//! * **AmendableCommit**
//!     - A list of commits to which a `WorktreeHunk` cleanly applies without intersecting with any `CommitHunk`.
//! * **IntroducingCommit**
//!     - The first *commit* whose `CommitHunk` intersects with a `WorktreeHunk`. This means the hunk can override the overlapping portion of the `CommitHunk`
//!       and now knows the *last commit* (closest to `BranchBase`) that it can apply to without causing conflicts in future commits.
//!
//! ### Purpose
//!
//! This crate helps to associate one or more `WorktreeHunks` to one or more *commits* .
//! There are the following cases to consider, with varying levels of accuracy.
//! This algorithm is *state*-based and produces the `CommitState` for each `AmendableCommit` and `IntroducingCommit` so it contains all applicable `WorktreeHunks`.
//! It starts with the `WorktreeState` available, and the `CommitState` at `BranchTip` as well.
//! It's notable that even if commits would be amended with `WorkreeHunks`, the worktree itself does not change state at all.
//! (*Note that ContextLines aren't relevant here.*)
//!
//! ### Associate all `WorktreeHunks` to their `IntroducingCommits` in a `Workspace` TODO/Still unclear
//!
//! TODO: This *should* work with a blame-based-algorithm, as `git blame` can already do this. More testing required.
//!
//! A `Workspace` is the result of a merge of two or more `Branches`. This means its *worktree* is also the combination of two or more branches. If it is only one `Branch`,
//!
//! It seems easiest extract the `WorktreeHunks` (as `UnifiedDiff`) and then apply them one by one onto each candidate `Branch` in the `Workspace` with fuzzy matching
//! to find one that they apply to. When found, proceed with these patches similarly to how it's done with normal `Branches`.
//! This is probably helps with 80% of the `WorktreeHunks` that cleanly apply.
//! And then there are those that need to be split as they are partially in multiple `Branches`.
//!
//! Maybe another way to do this is to…
//!
//! - go through each `Branch`
//! - go through each `Commit` of a `Branch` from `BranchTip` to `BranchBases`
//! - merge in the `BranchTips` of the other `Branches` and cherry-pick the `WorktreeHunks` on top
//!
//! Essentially, perform the same algorithm as with simple `Branches`, but operate on a merge commit instead, simulating the effect of the `Workspace` at all times.
//! The problem here would be that it's very possible that the `Branches` don't merge cleanly in all cases.
//!
//! ### Associate all `WorktreeHunks` to their `IntroducingCommits` in `Branches`
//!
//! In standard Git `Branches`, the worktree matches the `BranchTip` and `WorktreeHunk` represent changes on top of that.
//! Here is an algorithm to associated `WorktreeHunks` with their `IntroducingCommits`.
//!
//! - prior to the walk, filter out all `WorktreeHunks` that aren't in any file that is touched by the `BranchCommits`.
//! - walk down from `BranchTip` to the `BranchBase`, and for each commit do a *three-way merge* such that we revert each commit, but pretend to have added `WorktreeHunk`
//!   at the same time. Alternatively, it's like cherry-picking the `WorktreeState` onto the parent of `BranchTip` as first iteration. Then it's like pushing `WorktreeHunk` down the
//!   commit-ancestry, starting at the `BranchTip` whose `State` we know with `WorktreeHunk` applied.
//!      - If there is a conflict, we know the clashing `CommitHunks` are to be superseded by the overlapping portions of the respective `WorktreeHunk`, which can be similar to choosing
//!        the *Ours* strategy. This removes the whole `WorktreeHunk` and if there are no more `WorktreeHunks` to track, we can stop iterating. This is the `IntroducingCommit` to record.
//!      - If the merge is without conflicts, we have the `State` of our side for use in the next iteration. Record this commit as `AmendableCommit`.
//!      - Keep iterating until all `WorktreeHunks` are associated with an `IntroducingCommit`.
//!      - Once the `BranchBase` is reached, stop the iteration
//! - All `WorktreeHunks` that were associated should be applied to the `BranchTip`, adding it as `AmendableCommit`
//! - `WorktreeHunks` that were *not* associated are returned and can be committed separately, for instance on top of the `BranchTip` whose `State` we have returned as well.
//!
//! The algorithm should be run for all hunks at all `Paths` at once to be able to get the most out of diffs between two trees.
//!
//! ### Associating selected `WorktreeHunks`
//!
//! Selected `WorktreeHunks`, as a subset of all available `WorktreeHunks`, are applied onto `HEAD^{tree}` if applying to `Branches` or to the `WorkspaceCommit` if applying to a `Workspace`.
//! This sets the initial `State` to contain only the selected `WorktreeHunks` and their association to `IntroducingCommits` can be performed as normal.
//!
//! ### Committing `WorktreeHunks`
//!
//! The outcome of associating `WorktreeHunks` with *commits* is the `State` of each `Path` with `WorktreeHunks` for each *commit*. Thus, each *commit* knows how it would look like with
//! all applicable `WorktreeHunks` applied.
//!
//! Commits are effectively amended with the new `State` that contains `WorktreeHunks`, from the commit closest to the `BranchBase` moving upwards to the `BranchTip`, inclusive, which
//! means there is no chance for conflict or unexpected behaviour.
//!
//! Unassociated `WorktreeHunks` either belong to another `Branch` of a `Workspace`, or they would be a candidate to be committed with `BranchTip` as parent.
//!
//! ### Watch out!
//!
//! - Worktree State needs to be converted to what would be Git stage, i.e. has to go through filters first!
//!
//! ### Questions
//!
//! #### What to do with multi-parent commits?
//!
//! In theory, would have to merge the parents, and diff it against the commit. That bears the risk of a conflict (that has been resolved in the commit),
//! so in that case it should be fine to fallback to using the first parent.
mod input;
pub use input::{InputCommit, InputDiffHunk, InputFile, InputStack};

mod ranges;
pub use ranges::{CalculationError, HunkRange, WorkspaceRanges};

mod utils;
