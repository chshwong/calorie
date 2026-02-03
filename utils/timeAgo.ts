/**
 * Time-ago formatting for display
 * - < 60 min: "{N}m ago"
 * - < 24h: "{N}h ago"
 * - >= 24h: "{N}d ago"
 */

export function formatTimeAgo(createdAt: string): string {
  const then = new Date(createdAt).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
