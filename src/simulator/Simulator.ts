import type { Affordances } from '../shared/types.ts';

export class Simulator {
  constructor(
    readonly udid: string,
    readonly name: string,
    readonly state: string,
    readonly runtime: string,
    readonly displayRuntime: string,
    readonly affordances: Affordances,
  ) {}

  get id(): string { return this.udid; }
  get isBooted(): boolean { return this.state === 'Booted'; }

  static fromJSON(json: Record<string, unknown>): Simulator {
    return new Simulator(
      (json.udid ?? json.id ?? '') as string,
      (json.name as string) ?? '',
      (json.state as string) ?? 'Shutdown',
      (json.runtime as string) ?? '',
      (json.displayRuntime as string) ?? (json.runtime as string) ?? '',
      (json.affordances as Affordances) ?? {},
    );
  }
}
