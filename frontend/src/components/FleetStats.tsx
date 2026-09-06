import type { Robot } from '../types';

const working = new Set(['active', 'on_mission']);
const attention = new Set(['blocked', 'error', 'maintenance', 'offline']);

export function FleetStats({ robots }: { robots: Robot[] }) {
  const active = robots.filter((r) => working.has(r.status)).length;
  const needs = robots.filter((r) => attention.has(r.status) || r.battery < 20).length;
  const charging = robots.filter((r) => r.status === 'charging').length;
  const avg = robots.length ? Math.round(robots.reduce((sum, r) => sum + r.battery, 0) / robots.length) : 0;
  return <section className="cards">
    <Card label="Total robots" value={robots.length} />
    <Card label="Working" value={active} />
    <Card label="Need attention" value={needs} />
    <Card label="Charging" value={charging} />
    <Card label="Avg battery" value={`${avg}%`} />
  </section>;
}
function Card({ label, value }: { label: string; value: string | number }) {
  return <div className="card"><span>{label}</span><strong>{value}</strong></div>;
}
