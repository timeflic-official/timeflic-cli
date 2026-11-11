# Releasing @timeflic/cli

Releases are published from GitHub Actions (`.github/workflows/release.yml`) through npm trusted publishing: no npm token exists anywhere, every release waits for an owner's approval, and every version carries npm provenance because this repository is public. Only the tarball made by `pnpm release:check` is ever published.

## One-time setup

1. **npm organisation** `timeflic`, owned by the `timeflic-official` npm account with two-factor authentication for sign-in and writes. (Done.)
2. **GitHub environment `npm`** in this repository (Settings → Environments):
   - Required reviewers: the owners.
   - Deployment branches and tags: Selected → tag rule `v*`.
3. **Trusted Publisher on npm**: npmjs.com → `@timeflic/cli` → Settings → Trusted Publisher → GitHub Actions:
   - Organization or user: `timeflic-official`
   - Repository: `timeflic-cli`
   - Workflow filename: `release.yml`
   - Environment: `npm`
4. **Release within 48 hours** of step 3 (below). npm drops a trusted-publisher setting that has not been used by then; if that happens, delete it and add it again.
5. **Lock it** once that release is on npm: package Settings → Publishing access → "Require two-factor authentication and disallow tokens". Releases from GitHub keep working; a leaked token can no longer publish.

## Every release

1. In a pull request: raise `version` in `package.json` and add a `## <version>` section to `CHANGELOG.md`. If TimeFlic's agent schema or tools changed, run `TIMEFLIC_API_URL=<TimeFlic production API> pnpm sync:schema` first; the build regenerates the README's tools and events tables.
2. Merge to `main`; the `ci` workflow must be green.
3. Tag `main` and push the tag:
   ```bash
   git checkout main && git pull
   git tag v0.1.1 && git push origin v0.1.1
   ```
4. GitHub → Actions → release → **Review deployments → Approve**. The workflow tests, builds, installs the package on Node 20, 22 and 24, publishes to npm with provenance, and creates the GitHub release with the changelog section.
5. Check `https://www.npmjs.com/package/@timeflic/cli` and `npx @timeflic/cli@<version> --version`.

Pre-releases: a version like `0.2.0-beta.1` is published under the `next` dist-tag (`npx @timeflic/cli@next`); `latest` only moves on a plain version.

## When something goes wrong

- **The workflow fails before "publish to npm"**: nothing was published. Fix it, then move the tag: `git push origin :refs/tags/v0.1.1 && git tag -d v0.1.1`, and tag again.
- **Publish fails with ENEEDAUTH, 401, 403 or 404**: the Trusted Publisher fields don't match (workflow filename including `.yml`, environment name, repository), or the 48-hour window passed (delete the setting, add it again, re-run).
- **A broken version is on npm**: `npm deprecate @timeflic/cli@<version> "Broken, use <fixed version>"`, then release the fix. Unpublish only for a leaked secret, and only within npm's 72-hour window.
- **Never** put an npm token in GitHub secrets, and never publish anything except the `release:check` tarball.

## Publishing by hand (only if GitHub Actions is unavailable)

From an owner's machine, signed in with `npm login`: `pnpm release:check`, then `npm publish release/timeflic-cli-<version>.tgz` and approve with the security key. npm refuses publishing from an account without two-factor authentication, and a token without "bypass 2FA" cannot publish. Versions published this way have no provenance.
