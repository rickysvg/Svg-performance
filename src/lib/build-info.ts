/** Short commit of the running deploy. Vercel sets this at build time. */
export function shortBuildSha() {
  const sha = (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    ""
  ).trim();
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) return "";
  return sha.slice(0, 7);
}
