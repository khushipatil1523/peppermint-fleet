export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
export const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';

export async function fetchRobots() {
  const response = await fetch(`${API_URL}/robots`);
  if (!response.ok) throw new Error(`Failed to fetch robots: ${response.status}`);
  return (await response.json()) as { robots: import('../types').Robot[] };
}
