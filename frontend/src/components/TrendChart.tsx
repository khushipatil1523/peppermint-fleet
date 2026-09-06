import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Point = { timestamp: number; active: number };
export function TrendChart({ history, windowSize, setWindowSize }: { history: Point[]; windowSize: number; setWindowSize: (value: number) => void }) {
  const data = history.filter((point) => point.timestamp >= Date.now() - windowSize * 60_000).map((point) => ({ ...point, time: new Date(point.timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }) }));
  return <section className="panel trend"><div className="panel-head"><div><h2>Working fleet trend</h2><span>Active + on-mission percentage</span></div><div className="windows">{[5, 15, 30].map((value) => <button key={value} className={windowSize === value ? 'active' : ''} onClick={() => setWindowSize(value)}>{value}m</button>)}</div></div>
    <div className="chart"><ResponsiveContainer width="100%" height={230}><LineChart data={data}><XAxis dataKey="time" minTickGap={40} /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} /><Tooltip formatter={(value) => [`${value}%`, 'Working']} /><Line type="monotone" dataKey="active" name="Working" dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer></div>
  </section>;
}
