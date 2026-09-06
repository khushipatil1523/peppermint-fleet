import { useEffect, useRef, useState } from 'react';
import type { Robot } from '../types';

const attention = new Set(['blocked', 'error', 'maintenance', 'offline']);
const working = new Set(['active', 'on_mission']);

export function FleetMap({ robots, selected, onSelect }: { robots: Robot[]; selected: string | null; onSelect: (id: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [background, setBackground] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const image = new Image();
    image.src = '/layout.png';
    image.onload = () => setBackground(image);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 900 * dpr;
    canvas.height = 560 * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 900, 560);
    if (background) ctx.drawImage(background, 0, 0, 900, 560);

    for (const robot of robots) {
      ctx.beginPath();
      ctx.arc(robot.x, robot.y, robot.robot_id === selected ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = attention.has(robot.status) ? '#dc2626' : robot.status === 'charging' ? '#d97706' : working.has(robot.status) ? '#2563eb' : '#16a34a';
      ctx.fill();
      if (robot.robot_id === selected) {
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (robots.length <= 120) {
        ctx.fillStyle = '#111827';
        ctx.font = '11px sans-serif';
        ctx.fillText(robot.robot_id, robot.x + 8, robot.y - 8);
      }
    }
  }, [robots, selected, background]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 900;
    const y = ((event.clientY - rect.top) / rect.height) * 560;
    let closest: Robot | undefined;
    let distance = Infinity;
    for (const robot of robots) {
      const d = Math.hypot(robot.x - x, robot.y - y);
      if (d < distance && d < 18) { closest = robot; distance = d; }
    }
    if (closest) onSelect(closest.robot_id);
  };

  return <canvas ref={canvasRef} onClick={handleClick} className="map" aria-label="Robot site map" />;
}
