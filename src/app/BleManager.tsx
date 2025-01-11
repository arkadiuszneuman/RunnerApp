const S_SERIAL_PORT = "0000fff0-0000-1000-8000-00805f9b34fb";
const C_SERIAL_PORT_READ = "0000fff1-0000-1000-8000-00805f9b34fb";
const C_SERIAL_PORT_WRITE = "0000fff2-0000-1000-8000-00805f9b34fb";

const STATUS_COMMAND = [2, 81];
export const START_COMMAND = [2, 83, 1, 0, 0, 0, 0, 0];
const INC_SPEED_COMMAND = [2, 83, 2];
export const STOP_COMMAND = [2, 83, 3];
const SPEED_INFO_COMMAND = [2, 80, 2];
const INCLINE_INFO_COMMAND = [2, 80, 3];
const TOTAL_INFO_COMMAND = [2, 80, 4];
export const SPORT_DATA_COMMAND = [2, 82, 0];
export const EVENT_RUNNING = "running";
export const EVENT_STARTING = "starting";
export const EVENT_STOPPED = "stopped";

const MESAGE_ENDING = [3];
const MAX_RETRIES = 5;

let s_serialPort: BluetoothRemoteGATTService | undefined,
  c_serialPortRead: BluetoothRemoteGATTCharacteristic | undefined,
  c_serialPortWrite: BluetoothRemoteGATTCharacteristic | undefined;

type RunState = {
  status: string;
  value: DataView<ArrayBufferLike> | undefined;
  currentSpeed: number;
  currentIncline: number;
};

export type TreadmillEvent =
  | {
      type: "btConnected" | "btDisconnected" | "btSpeedInfo";
    }
  | {
      type: "btStarting" | "btStopped" | "btRunning";
      state: RunState;
    }
  | {
      type: "btSpeedInfo";
      state: {
        minSpeed: number;
        maxSpeed: number;
        unitSpeed: number;
      };
    };

class BleManager {
  private static instance: BleManager;
  private listeners: ((data: TreadmillEvent) => void)[] = [];

  private _isRunning = false;
  private lastMessage: number[] | undefined = undefined;
  private messageQueue: number[][] = [];
  private states: RunState = {
    status: "",
    value: undefined,
    currentSpeed: 0,
    currentIncline: 0,
  };
  private retries = MAX_RETRIES;
  private connected = false;

  private constructor() {}

  static getInstance(): BleManager {
    if (!BleManager.instance) {
      BleManager.instance = new BleManager();
    }
    return BleManager.instance;
  }

  mergeTypedArraysUnsafe(
    a: Uint8Array<any>,
    b: Uint8Array<any>,
    c: Uint8Array<any>
  ) {
    var d = new Uint8Array(a.length + b.length + c.length);
    d.set(a);
    d.set(b, a.length);
    d.set(c, a.length + b.length);
    return d;
  }

  handleNotifications(event: Event) {
    let value = (event.target as BluetoothRemoteGATTCharacteristic)?.value;
    if (value) {
      let prevStatus = this.states.status;
      this.states.value = value;
      let valueLength = value.byteLength;
      if (
        this.lastMessage &&
        valueLength > 0 &&
        value.getUint8(0) === 2 &&
        value.getUint8(valueLength - 1) === 3
      ) {
        let success = this.isCommandResult(this.lastMessage, value);
        if (success) {
          if (this.lastMessage === SPEED_INFO_COMMAND) {
            let maxSpeed = value.getUint8(3);
            let minSpeed = value.getUint8(4);
            let unitSpeed = value.getUint8(5);
            this.emit({
              type: "btSpeedInfo",
              state: {
                maxSpeed,
                minSpeed,
                unitSpeed,
              },
            });
            /* } else if (this.lastMessage === INCLINE_INFO_COMMAND) {
          } else if (this.lastMessage === TOTAL_INFO_COMMAND) { */
          } else if (this.lastMessage === STATUS_COMMAND) {
            if (
              valueLength === 5 &&
              value.getUint8(2) === 0 &&
              value.getUint8(3) === 81
            ) {
              this._isRunning = false;
              this.states.status = "Stopped";
              this.states.currentSpeed = 0;
              this.states.currentIncline = 0;

              if (prevStatus !== this.states.status) {
                this.emit({ type: "btStopped", state: this.states });
                console.log("btStopped emit");
              }
            } else if (valueLength > 5 && valueLength < 17) {
              this.states.status = "Starting";
              this.states.currentSpeed = 0;
              this.states.currentIncline = 0;
              if (prevStatus !== this.states.status) {
                this.emit({ type: "btStarting", state: this.states });
                console.log("btStarting emit");
              }
              //statusDiv.innerHTML = "Starting";
            } else if (valueLength === 17) {
              this.states.status = "Running";
              this._isRunning = true;

              this.states.currentSpeed = value.getUint8(3) / 10;
              this.states.currentIncline = value.getUint8(4);

              this.emit({ type: "btRunning", state: this.states });
              console.log("btRunning emit");
            }
          }
          this.lastMessage = undefined;
        } else {
          console.log("invalid response");
          this.retries--;
        }
      } else {
        console.log("invalid response");
        this.retries--;
      }
      if (this.retries <= 0) {
        this.lastMessage = undefined;
        this.retries = MAX_RETRIES;
      }
    }
  }

  checksum(bytesArray: Uint8Array<any>) {
    var maxIndex = bytesArray.length;
    var currentIndex = 1;

    var checksum;
    for (checksum = 0; currentIndex < maxIndex; ++currentIndex) {
      checksum ^= bytesArray[currentIndex];
    }

    return new Uint8Array([checksum]);
  }

  intervalHandler() {
    // check queue
    if (this.lastMessage) {
      this.sendMessage(this.lastMessage);
    } else {
      if (this.messageQueue.length > 0) {
        this.lastMessage = this.messageQueue.shift();
      } else {
        // request status info
        this.addMessage(STATUS_COMMAND);
      }
    }
  }

  sendMessage(valueArray: number[]) {
    const command = new Uint8Array(valueArray);
    const ending = new Uint8Array(MESAGE_ENDING);
    const commandMerged = this.mergeTypedArraysUnsafe(
      command,
      this.checksum(command),
      ending
    );

    try {
      c_serialPortWrite?.writeValue(commandMerged);
    } catch (err) {
      this.connected = false;
      this.emit({ type: "btDisconnected" });
    }
  }

  isCommandResult(command: number[], result: DataView<ArrayBufferLike>) {
    var success = true;
    var resultLength = result.byteLength;
    var compareLength = command === START_COMMAND ? 3 : command.length;
    for (var i = 0; i < compareLength; i++) {
      if (!success) {
        break;
      }
      if (i >= resultLength) {
        success = false;
      } else {
        success = success && command[i] === result.getUint8(i);
      }
    }
    return success;
  }

  sendIncAndSpeed(incline: number, speed: number) {
    if (this.isRunning()) {
      let newSpeed = speed === -1 ? this.states.currentSpeed : speed;
      let newIncline = incline === -1 ? this.states.currentIncline : incline;
      let customIncSpeed = this.mergeTypedArraysUnsafe(
        new Uint8Array(INC_SPEED_COMMAND),
        new Uint8Array([newSpeed * 10]),
        new Uint8Array([newIncline])
      );
      this.addMessage(Array.from(customIncSpeed));
    }
  }

  isConnected() {
    return this.connected;
  }

  isRunning() {
    return this._isRunning;
  }

  addMessage(msg: number[]) {
    this.messageQueue.push(msg);
  }

  initBTConnection() {
    let thisObj = this;
    navigator.bluetooth
      .requestDevice({
        filters: [{ namePrefix: "FS-" }, { services: [S_SERIAL_PORT] }],
      })
      .then((device) => device?.gatt?.connect())
      .then((server) => {
        return server?.getPrimaryService(S_SERIAL_PORT);
      })
      .then((service) => {
        s_serialPort = service;
        return s_serialPort?.getCharacteristic(C_SERIAL_PORT_READ);
      })
      .then((characteristic) => {
        c_serialPortRead = characteristic;
        return c_serialPortRead?.startNotifications().then(() => {
          console.log("> Notifications started for c_serialPortRead");
          c_serialPortRead?.addEventListener(
            "characteristicvaluechanged",
            (e) => {
              thisObj.handleNotifications(e);
            }
          );
          c_serialPortRead?.addEventListener("characteristicvalueread", (e) => {
            thisObj.handleNotifications(e);
          });
          return s_serialPort?.getCharacteristic(C_SERIAL_PORT_WRITE);
        });
      })
      .then((characteristic) => {
        c_serialPortWrite = characteristic;
        thisObj.addMessage(SPEED_INFO_COMMAND);
        thisObj.addMessage(INCLINE_INFO_COMMAND);
        thisObj.addMessage(TOTAL_INFO_COMMAND);
        setInterval(() => {
          thisObj.intervalHandler();
        }, 200);
        this.emit({ type: "btConnected" });
        thisObj.connected = true;
      })
      .catch((error) => {
        console.log(error);
      });
  }

  public start() {
    this.sendMessage(START_COMMAND);
  }

  public stop() {
    this.sendMessage(STOP_COMMAND);
  }

  subscribe(callback: (data: TreadmillEvent) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  emit(data: TreadmillEvent) {
    this.listeners.forEach((callback) => callback(data));
  }
}

export default BleManager.getInstance();
