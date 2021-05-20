import * as packageCache from '../../util/cache/package';
import { GitlabHttp } from '../../util/http/gitlab';
import { resolveUrl } from '../../util/url';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { GitlabTag } from './types';

const gitlabApi = new GitlabHttp();

export const id = 'gitlab-tags';
export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://gitlab.com'];
export const registryStrategy = 'first';

const cacheNamespace = 'datasource-gitlab';

function getCacheKey(depHost: string, repo: string): string {
  const type = 'tags';
  return `${depHost}:${repo}:${type}`;
}

export async function getReleases({
  registryUrl: depHost,
  lookupName: repo,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    getCacheKey(depHost, repo)
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  const urlEncodedRepo = encodeURIComponent(repo);

  // tag
  const url = resolveUrl(
    depHost,
    `/api/v4/projects/${urlEncodedRepo}/repository/tags?per_page=100`
  );

  const gitlabTags = (
    await gitlabApi.getJson<GitlabTag[]>(url, {
      paginate: true,
    })
  ).body;

  const dependency: ReleaseResult = {
    sourceUrl: resolveUrl(depHost, repo),
    releases: null,
  };
  dependency.releases = gitlabTags.map(({ name, commit }) => ({
    version: name,
    gitRef: name,
    releaseTimestamp: commit?.created_at,
  }));

  const cacheMinutes = 10;
  await packageCache.set(
    cacheNamespace,
    getCacheKey(depHost, repo),
    dependency,
    cacheMinutes
  );
  return dependency;
}
