/**
 * Groups a stream of items into consecutive batches whose JSON stays under `maxBytes` (and
 * `maxItems`), so each upload stays well inside the server's request-size limit (4.5 MB on
 * Vercel) whatever mix of short and long activities arrives. An item bigger than `maxBytes` on
 * its own still goes, alone. Each item is serialised once, to measure it.
 */
export class SizeBatcher<T> {
  private batch: T[] = [];
  private bytes = 2; // the surrounding brackets

  constructor(
    private readonly maxBytes: number,
    private readonly maxItems: number,
    private readonly onBatch: (batch: T[]) => void
  ) {}

  add(item: T): void {
    const size = JSON.stringify(item).length + 1;
    if (
      this.batch.length > 0 &&
      (this.bytes + size > this.maxBytes || this.batch.length >= this.maxItems)
    ) {
      this.flush();
    }
    this.batch.push(item);
    this.bytes += size;
  }

  /** Emits whatever is waiting as a (possibly short) final batch. */
  flush(): void {
    if (this.batch.length === 0) return;
    const batch = this.batch;
    this.batch = [];
    this.bytes = 2;
    this.onBatch(batch);
  }
}
