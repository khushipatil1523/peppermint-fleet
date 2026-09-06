import { useEffect, useMemo, useState } from 'react';
import { useFleetSocket } from './hooks/useFleetSocket';
import { FleetStats } from './components/FleetStats';
import { FleetMap } from './components/FleetMap';
import { RobotList } from './components/RobotList';
import { RobotDetails } from './components/RobotDetails';
import { TrendChart } from './components/TrendChart';
import './styles.css';

const working = new Set(['active', 'on_mission']);

type Point = { timestamp: number; active: number };

export default function App() {
  const { robots, connected } = useFleetSocket();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [history, setHistory] = useState<Point[]>([]);
  const [windowSize, setWindowSize] = useState(15);
  const all = useMemo(() => [...robots.values()], [robots]);
  const selectedRobot = selected ? robots.get(selected) : undefined;

  useEffect(() => {
    const sample = () => {
      if (!all.length) return;
      const active = all.filter((robot) => working.has(robot.status)).length;
      setHistory((points) => [...points, { timestamp: Date.now(), active: Number(((active / all.length) * 100).toFixed(1)) }].slice(-1800));
    };
    sample();
    const id = window.setInterval(sample, 2000);
    return () => window.clearInterval(id);
  }, [all]);

  return <div className="app">
    <header>
      <div><div className="eyebrow">PEPPERMINT ROBOTICS</div><h1>Fleet Command</h1><p>Live fleet operations dashboard</p></div>
      <div className={connected ? 'live on' : 'live'}><span /> {connected ? 'LIVE' : 'RECONNECTING'}</div>
    </header>
    <FleetStats robots={all} />
    <main>
      <section className="panel map-panel"><div className="panel-head"><div><h2>Site map</h2><span>900 × 560 coordinate space</span></div><span className="muted">{all.length} robots</span></div><FleetMap robots={all} selected={selected} onSelect={setSelected} /></section>
      <RobotList robots={all} selected={selected} onSelect={setSelected} query={query} onQueryChange={setQuery} attentionOnly={attentionOnly} onAttentionChange={setAttentionOnly} />
      <TrendChart history={history} windowSize={windowSize} setWindowSize={setWindowSize} />
      <RobotDetails robot={selectedRobot} />
    </main>
  </div>;
}
