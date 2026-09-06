import type { Robot } from '../types';
export function RobotDetails({ robot }: { robot?: Robot }) {
  return <section className="panel detail"><div className="panel-head"><div><h2>Selected robot</h2><span>Operator detail</span></div></div>{robot ? <div className="detail-grid">
    <div><b>{robot.robot_id}</b><span>ID</span></div><div><b>{robot.robot_type}</b><span>Type</span></div><div><b>{robot.status.replace('_', ' ')}</b><span>Status</span></div><div><b>{robot.battery.toFixed(1)}%</b><span>Battery</span></div><div><b>{robot.x.toFixed(1)}, {robot.y.toFixed(1)}</b><span>Position</span></div><div><b>{robot.seq}</b><span>Sequence</span></div>
  </div> : <p className="muted">Select a robot on the map or list.</p>}</section>;
}
