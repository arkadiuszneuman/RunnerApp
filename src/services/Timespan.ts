export class Timespan {
  private _totalMilliseconds: number;

  constructor(milliseconds: number = 0) {
    this._totalMilliseconds = milliseconds;
  }

  static parse(text: string): Timespan {
    const splitted = text.split(':')

    if (splitted.length === 3) {
      return Timespan.fromHours(Number(splitted[0])).add(Timespan.fromMinutes(Number(splitted[1]))).add(Timespan.fromSeconds(Number(splitted[2])));
    }

    if (splitted.length === 2) {
      return Timespan.fromMinutes(Number(splitted[0])).add(Timespan.fromSeconds(Number(splitted[1])));
    }

    throw Error('Text to parse should be in 00:00:00 or 00:00 format');
  }

  static fromSeconds(seconds: number): Timespan {
    return new Timespan(seconds * 1000);
  }

  static fromMinutes(minutes: number): Timespan {
    return new Timespan(minutes * 60000);
  }

  static fromHours(hours: number): Timespan {
    return new Timespan(hours * 3600000);
  }

  get milliseconds(): number {
    return this._totalMilliseconds % 1000;
  }

  get seconds(): number {
    return Math.floor((this._totalMilliseconds / 1000) % 60);
  }

  get minutes(): number {
    return Math.floor((this._totalMilliseconds / 60000) % 60);
  }

  get hours(): number {
    return Math.floor(this._totalMilliseconds / 3600000);
  }

  get totalMilliseconds(): number {
    return this._totalMilliseconds;
  }

  get totalSeconds(): number {
    return this._totalMilliseconds / 1000;
  }

  get totalMinutes(): number {
    return this._totalMilliseconds / 60000;
  }

  get totalHours(): number {
    return this._totalMilliseconds / 3600000;
  }

  add(other: Timespan): Timespan {
    return new Timespan(this._totalMilliseconds + other._totalMilliseconds);
  }

  subtract(other: Timespan): Timespan {
    return new Timespan(this._totalMilliseconds - other._totalMilliseconds);
  }

  toString(): string {
    return `${this.hours.toString().padStart(2, '0')}:${this.minutes.toString().padStart(2, '0')}:${this.seconds.toString().padStart(2, '0')}`;
  }

  get [Symbol.toStringTag]() {
    return this.toString()
  }

  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.toString()
  }
}