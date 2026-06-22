import { useState, useEffect, useRef, useCallback } from 'react';

export function usePlayback(duration: number) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();

  const animate = useCallback((time: number) => {
    if (lastTimeRef.current !== undefined) {
      const deltaTime = (time - lastTimeRef.current) / 1000;
      setCurrentTime((prevTime) => {
        const nextTime = prevTime + deltaTime;
        if (nextTime >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return nextTime;
      });
    }
    lastTimeRef.current = time;
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [isPlaying, duration]);

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = undefined;
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, animate]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  
  const seek = (time: number) => {
    setCurrentTime(time);
    lastTimeRef.current = undefined; // reset time so delta isn't huge
  };

  return { isPlaying, currentTime, togglePlay, seek, setIsPlaying };
}
