#!/usr/bin/env node
import semver from "semver"; // @7.7.2

const PRIMARY_BRANCHES = new Set(["main", "trunk"]);
const INITIAL_VERSION = "1.0.0";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

const dryRun = args.get("dry-run") !== "false";

$.verbose = false;

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

function normalizeTag(tag) {
  const version = semver.valid(tag);
  return version ?? semver.valid(tag.replace(/^v/, ""));
}

async function currentBranch() {
  if (process.env.GITHUB_REF_NAME) {
    return process.env.GITHUB_REF_NAME;
  }

  return stdout($`git branch --show-current`);
}

async function semverTags() {
  const pattern = "v*";
  const tags = lines(await stdout($`git tag --list ${pattern}`));
  return tags
    .map((tag) => normalizeTag(tag))
    .filter(Boolean)
    .sort(semver.rcompare);
}

async function releaseBranches() {
  const format = "--format=%(refname:short)";
  const refs = lines(
    await stdout($`git for-each-ref ${format} refs/heads refs/remotes/origin`),
  );

  return new Set(
    refs
      .map((ref) => ref.replace(/^origin\//, ""))
      .filter((ref) => parseReleaseBranch(ref)),
  );
}

function releaseLine(version) {
  return `${semver.major(version)}.${semver.minor(version)}`;
}

function branchNameFor(version) {
  return `release/v${semver.major(version)}-${semver.minor(version)}`;
}

async function nextReleaseBranchVersion(tags, branches) {
  const usedLines = new Set(tags.map(releaseLine));
  for (const branch of branches) {
    const parsed = parseReleaseBranch(branch);
    usedLines.add(`${parsed.major}.${parsed.minor}`);
  }

  let candidate = tags.length > 0 ? semver.inc(tags[0], "minor") : INITIAL_VERSION;
  while (usedLines.has(releaseLine(candidate))) {
    candidate = semver.inc(candidate, "minor");
  }

  return candidate;
}

function nextPatchTagVersion(branch, tags) {
  const parsed = parseReleaseBranch(branch);
  if (!parsed) {
    throw new Error(
      `Release tagging must run from a branch named release/v<major>-<minor>; got ${branch}`,
    );
  }

  const matching = tags.filter(
    (tag) => semver.major(tag) === parsed.major && semver.minor(tag) === parsed.minor,
  );
  if (matching.length === 0) {
    return `${parsed.major}.${parsed.minor}.0`;
  }

  return semver.inc(matching[0], "patch");
}

async function runOrPrint(label, command) {
  if (dryRun) {
    console.log(`[dry-run] ${label}`);
    return;
  }

  console.log(label);
  await command();
}

const branch = await currentBranch();
const tags = await semverTags();
const branches = await releaseBranches();

console.log(`Current branch: ${branch}`);
console.log(`Dry run: ${dryRun}`);

if (PRIMARY_BRANCHES.has(branch)) {
  const version = await nextReleaseBranchVersion(tags, branches);
  const releaseBranch = branchNameFor(version);

  if (branches.has(releaseBranch)) {
    throw new Error(`Refusing to recreate existing release branch ${releaseBranch}`);
  }

  console.log(`Mode: cut release branch`);
  console.log(`Next release line: v${releaseLine(version)}.*`);
  console.log(`Release branch: ${releaseBranch}`);

  await runOrPrint(`git switch -c ${releaseBranch}`, async () => {
    await $`git switch -c ${releaseBranch}`;
  });
  await runOrPrint(`git push origin ${releaseBranch}`, async () => {
    await $`git push origin ${releaseBranch}`;
  });

} else if (parseReleaseBranch(branch)) {
  const version = nextPatchTagVersion(branch, tags);
  const tag = `v${version}`;

  if (tags.includes(version)) {
    throw new Error(`Refusing to recreate existing tag ${tag}`);
  }

  console.log(`Mode: release tag`);
  console.log(`Release branch: ${branch}`);
  console.log(`Next tag: ${tag}`);

  await runOrPrint(`git tag -a ${tag} -m "Release ${tag}"`, async () => {
    await $`git tag -a ${tag} -m ${`Release ${tag}`}`;
  });
  await runOrPrint(`git push origin ${tag}`, async () => {
    await $`git push origin ${tag}`;
  });

} else {
  throw new Error(
    `Unsupported branch ${branch}. Run this workflow on main/trunk to create a release branch, or on release/v<major>-<minor> to tag a release.`,
  );
}
