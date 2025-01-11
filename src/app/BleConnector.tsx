"use client";

import { useEffect } from "react";
import BleManager, { TreadmillEvent } from "./BleManager";

export default function BleConnector() {
  useEffect(() => {
    const removeEvent = BleManager.subscribe(onEventOccured);
    return () => removeEvent();
  }, []);

  function onEventOccured(data: TreadmillEvent): void {
    console.log(data);
  }

  function connect(): void {
    BleManager.initBTConnection();
  }

  function start() {
    BleManager.start();
  }

  function set() {
    BleManager.sendIncAndSpeed(2, 3);
  }

  function stop() {
    BleManager.stop();
  }

  return (
    <>
      <button onClick={connect}>Connect</button>
      <button onClick={start}>Start</button>
      <button onClick={set}>Set</button>
      <button onClick={stop}>Stop</button>
    </>
  );
}
