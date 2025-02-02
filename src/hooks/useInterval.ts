import { useEffect } from 'react';

export default function useInterval(props: { loop: () => void; interval: number }) {
  useEffect(() => {
    const interval = setInterval(props.loop, props.interval);
    return () => clearInterval(interval);
  }, [props.interval, props.loop]);
}
