import type { Robot } from '../types';

const attention = new Set(['blocked', 'error', 'maintenance', 'offline']);

export function RobotList({ robots, selected, onSelect, query, onQueryChange, attentionOnly, onAttentionChange }: {
  robots: Robot[]; selected: string | null; onSelect: (id: string) => void; query: string; onQueryChange: (value: string) => void; attentionOnly: boolean; onAttentionChange: (value: boolean) => void;
}) {
  const filtered = robots.filter((robot) => robot.robot_id.toLowerCase().includes(query.toLowerCase()) && (!attentionOnly || attention.has(robot.status)));
  return <aside className="panel">
    <div className="panel-head"><div><h2>Robots</h2><span>Search and triage</span></div><button className={attentionOnly ? 'filter active' : 'filter'} onClick={() => onAttentionChange(!attentionOnly)}>Attention</button></div>
    <input className="search" placeholder="Search robot ID…" value={query} onChange={(e) => onQueryChange(e.target.value)} />
    <div className="robot-list">
      {filtered.slice(0, 300).map((robot) => <button key={robot.robot_id} className={selected === robot.robot_id ? 'robot selected' : 'robot'} onClick={() => onSelect(robot.robot_id)}>
        <span className={`dot ${robot.status}`} /><span className="robot-main"><b>{robot.robot_id}</b><small>{robot.robot_type} · {robot.status.replace('_', ' ')}</small></span><span className="battery">{Math.round(robot.battery)}%</span>
      </button>)}
    </div>
    {filtered.length > 300 && <p className="muted">Showing first 300 for prototype responsiveness.</p>}
  </aside>;
}
