#!/usr/bin/env node
/**
 * Resolve the next version to publish.
 *
 *   node scripts/next-version.mjs <publishedVersion|none> <localVersion>
 *
 * The npm registry is the source of truth: the next version is normally the
 * published version with its patch incremented. If the local package.json has
 * been manually raised higher than that (a deliberate minor or major release),
 * the local version wins instead.
 */

/** Parse "1.2.3" into [1, 2, 3]. Returns null when malformed. */
function parse(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Numeric semver ordering: negative when a < b, positive when a > b. */
function compare(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function main(argv) {
  const [publishedRaw, localRaw] = argv;
  if (!publishedRaw || !localRaw) {
    throw new Error("usage: next-version.mjs <published|none> <local>");
  }

  const local = parse(localRaw);
  if (!local) throw new Error(`invalid local version: ${localRaw}`);

  // Never published yet: ship the local version untouched.
  if (publishedRaw.trim() === "none") return localRaw.trim();

  const published = parse(publishedRaw);
  if (!published) throw new Error(`invalid published version: ${publishedRaw}`);

  const candidate = [published[0], published[1], published[2] + 1];
  return compare(local, candidate) > 0 ? localRaw.trim() : candidate.join(".");
}

try {
  process.stdout.write(main(process.argv.slice(2)));
} catch (err) {
  process.stderr.write(`[next-version] ${err.message}\n`);
  process.exit(1);
}
