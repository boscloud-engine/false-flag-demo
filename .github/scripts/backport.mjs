#!/usr/bin/env node
import semver from "semver"; // @7.7.2

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const dryRun = args.get("dry-run") !== "false";
const mergeSha = args.get("merge-sha") ?? process.env.BACKPORT_MERGE_SHA;
const prNumber = args.get("pr-number") ?? process.env.BACKPORT_PR_NUMBER;
const prTitle = args.get("pr-title") ?? process.env.BACKPORT_PR_TITLE ?? "";
const repo = args.get("repo") ?? process.env.BACKPORT_REPO;

$.verbose = false;

if (!mergeSha) {
  throw new Error("Missing --merge-sha");
}
if (!prNumber) {
  throw new Error("Missing --pr-number");
}
if (!repo) {
  throw new Error("Missing --repo");
}

async function stdout(command) {
  return (await command).stdout.trim();
}

function lines(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseReleaseBranch(branch) {
  const match = /^release\/v(?<major>\d+)-(?<minor>\d+)$/.exec(branch);
  if (!match?.groups) {
    return null;
  }

  return {
    major: Number(match.groups.major),
    minor: Number(match.groups.minor),
  };
}

function releaseBranchVersion(branch) {
  const parsed = parseReleaseBranch(branch);
  if (!parsed) {
    return null;
  }

  return `${parsed.major}.${parsed.minor}.0`;
}

async function fetchReleaseRefs() {
  await $`git fetch origin +refs/heads/release/*:refs/remotes/origin/release/* +refs/tags/*:refs/tags/*`;
}

async function releaseBranches() {
  const format = "--format=%(refname:short)";
  const refs = lines(await stdout($`git for-each-ref ${format} refs/remotes/origin`));
  return refs
    .map((ref) => ref.replace(/^origin\//, ""))
    .filter((ref) => parseReleaseBranch(ref))
    .sort((a, b) => semver.rcompare(releaseBranchVersion(a), releaseBranchVersion(b)));
}

async function runOrPrint(label, command) {
  if (dryRun) {
    console.log(`[dry-run] ${label}`);
    return;
  }

  console.log(label);
  await command();
}

function sanitizedTitle(title) {
  return title.trim() || `PR #${prNumber}`;
}

await fetchReleaseRefs();

const branches = await releaseBranches();
const targetBranch = branches[0];
if (!targetBranch) {
  throw new Error("No release/v<major>-<minor> branch found on origin");
}

const backportBranch = `backport/pr-${prNumber}-to-${targetBranch.replace("/", "-")}`;
const title = `Backport PR #${prNumber} to ${targetBranch}`;
const body = [
  `Backports #${prNumber} to \`${targetBranch}\`.`,
  "",
  `Source merge commit: \`${mergeSha}\``,
  `Original PR title: ${sanitizedTitle(prTitle)}`,
].join("\n");

console.log(`Dry run: ${dryRun}`);
console.log(`Source merge commit: ${mergeSha}`);
console.log(`Target release branch: ${targetBranch}`);
console.log(`Backport branch: ${backportBranch}`);

await runOrPrint(`git switch -c ${backportBranch} origin/${targetBranch}`, async () => {
  await $`git switch -c ${backportBranch} ${`origin/${targetBranch}`}`;
});
await runOrPrint(`git cherry-pick -x -m 1 ${mergeSha}`, async () => {
  await $`git cherry-pick -x -m 1 ${mergeSha}`;
});
await runOrPrint(`git push origin ${backportBranch}`, async () => {
  await $`git push origin ${backportBranch}`;
});
await runOrPrint(`gh pr create --repo ${repo} --base ${targetBranch} --head ${backportBranch}`, async () => {
  await $`gh pr create --repo ${repo} --base ${targetBranch} --head ${backportBranch} --title ${title} --body ${body} --label backport`;
});
