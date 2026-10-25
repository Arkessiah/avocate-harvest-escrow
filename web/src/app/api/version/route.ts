// Identifies the running deployment, so an open tab can tell that a newer one is live.
// Vercel sets these at runtime; a local server answers "local" and never asks for a reload.
export const dynamic = "force-dynamic";

export function GET() {
  const version = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
  return Response.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
