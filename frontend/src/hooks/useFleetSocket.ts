import { useEffect, useState } from 'react';
import { API_URL, WS_URL, fetchRobots } from '../api/client';
import type { Robot } from '../types';

export function useFleetSocket() {
  const [robots, setRobots] = useState<Map<string, Robot>>(new Map());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let retry: number | undefined;
    let disposed = false;
    let delay = 1000;

    const hydrate = async () => {
      try {
        const response = await fetchRobots();
        setRobots(new Map(response.robots.map((robot) => [robot.robot_id, robot])));
      } catch { /* WebSocket remains the live source */ }
    };

    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(WS_URL);
      socket.onopen = () => { delay = 1000; setConnected(true); void hydrate(); };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as { type: string; robots?: Robot[]; robot?: Robot };
          if (message.type === 'snapshot' && message.robots) setRobots(new Map(message.robots.map((robot) => [robot.robot_id, robot])));
          if (message.type === 'robot_update' && message.robot) {
            setRobots((current) => {
              const next = new Map(current);
              next.set(message.robot!.robot_id, message.robot!);
              return next;
            });
          }
        } catch { /* Ignore malformed socket messages. */ }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!disposed) {
          retry = window.setTimeout(connect, delay);
          delay = Math.min(delay * 2, 8000);
        }
      };
      socket.onerror = () => socket?.close();
    };

    void hydrate();
    connect();
    return () => {
      disposed = true;
      if (retry) window.clearTimeout(retry);
      socket?.close();
    };
  }, []);

  return { robots, connected, apiUrl: API_URL };
}
