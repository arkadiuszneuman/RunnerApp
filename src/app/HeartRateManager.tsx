export type HeartRateData = {
  heartRate: number;
};

let device: BluetoothDevice | undefined;
let heartRate: BluetoothRemoteGATTCharacteristic | undefined;

class HeartRateManager {
  private static instance: HeartRateManager;
  private listeners: ((data: HeartRateData) => void)[] = [];

  private constructor() {}

  static getInstance(): HeartRateManager {
    if (!HeartRateManager.instance) {
      HeartRateManager.instance = new HeartRateManager();
    }
    return HeartRateManager.instance;
  }

  handleRateChange(event: Event) {
    const value = (event.target as BluetoothRemoteGATTCharacteristic)?.value;
    if (value) {
      const is16Bits = value.getUint8(0) & 0x1;
      if (is16Bits) return value.getUint16(1, true);
      const heartRate = value.getUint8(1);
      this.emit({ heartRate });
    }
  }

  public isConnected() {
    return device?.gatt?.connected ?? false;
  }

  async connectDevice() {
    if (device?.gatt?.connected) return;

    const server = await device?.gatt?.connect();
    const service = await server?.getPrimaryService('heart_rate');

    heartRate = await service?.getCharacteristic('heart_rate_measurement');
    heartRate?.addEventListener('characteristicvaluechanged', (e) => this.handleRateChange(e));
  }

  public async requestDevice() {
    device = undefined;

    // Try to auto-connect to previously selected device
    const savedDeviceId = localStorage.getItem('heartRateDeviceId');
    if (savedDeviceId && navigator.bluetooth.getDevices) {
      const devices = await navigator.bluetooth.getDevices();
      const found = devices.find((d) => d.id === savedDeviceId);
      if (found) {
        device = found;
      }
    }

    // Fallback: show modal to select device
    if (!device) {
      const _options = { filters: [{ services: ['heart_rate'] }] };
      device = await navigator.bluetooth.requestDevice(_options);
      localStorage.setItem('heartRateDeviceId', device.id);
    }
    
    device.addEventListener('gattserverdisconnected', this.connectDevice);
    await this.connectDevice();
    await heartRate?.startNotifications();
  }

  subscribe(callback: (data: HeartRateData) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  emit(data: HeartRateData) {
    this.listeners.forEach((callback) => callback(data));
  }
}

export default HeartRateManager.getInstance();
