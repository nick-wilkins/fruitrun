import { COURSES } from './progress';

/** Raised whenever the messages change, so devices that would misread each other refuse to race. */
export const PROTOCOL = 1;
/** How many can race together. */
export const PARTY_SIZE = 4;

/** Where a marble is: which road, how far along it, how far across, how high, how fast, and how much of the course is done. */
export interface Report {
  lane: number;
  s: number;
  x: number;
  h: number;
  /** Distance along the road per second. */
  v: number;
  /** 0 to 1. */
  p: number;
}

export interface Member {
  id: string;
  name: string;
}

export type Refusal = 'version' | 'full';

export type Message =
  | { t: 'hello'; v: number; courses: number; name: string }
  | { t: 'roster'; players: Member[]; you: string }
  | { t: 'refuse'; why: Refusal }
  | { t: 'start'; level: string }
  | ({ t: 'pos'; from?: string } & Report)
  | { t: 'done'; time: number; from?: string };

const round = (value: number, to: number) => Math.round(value * to) / to;

export function encode(message: Message): string {
  if (message.t !== 'pos') return JSON.stringify(message);
  const { lane, s, x, h, v, p, from } = message;
  return JSON.stringify({ t: 'pos', lane, s: round(s, 100), x: round(x, 100), h: round(h, 100), v: round(v, 10), p: round(p, 1000), ...(from ? { from } : {}) });
}

const num = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length < 80;

/** What another device sent, or null if it is not a message this game understands. Nothing from the air is trusted. */
export function decode(raw: string): Message | null {
  let m: Record<string, unknown>;
  try {
    m = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!m || typeof m !== 'object') return null;
  const from = text(m.from) ? { from: m.from } : {};
  switch (m.t) {
    case 'hello':
      return num(m.v) && num(m.courses) && text(m.name) ? { t: 'hello', v: m.v, courses: m.courses, name: m.name } : null;
    case 'roster': {
      if (!Array.isArray(m.players) || m.players.length > PARTY_SIZE || !text(m.you)) return null;
      const players = (m.players as Record<string, unknown>[]).filter((p) => p && text(p.id) && text(p.name)).map((p) => ({ id: p.id as string, name: p.name as string }));
      return players.length === m.players.length ? { t: 'roster', players, you: m.you } : null;
    }
    case 'refuse':
      return m.why === 'version' || m.why === 'full' ? { t: 'refuse', why: m.why } : null;
    case 'start':
      return text(m.level) ? { t: 'start', level: m.level } : null;
    case 'pos':
      return num(m.lane) && num(m.s) && num(m.x) && num(m.h) && num(m.v) && num(m.p) ? { t: 'pos', lane: m.lane, s: m.s, x: m.x, h: m.h, v: m.v, p: m.p, ...from } : null;
    case 'done':
      return num(m.time) && m.time > 0 ? { t: 'done', time: m.time, ...from } : null;
    default:
      return null;
  }
}

/** How long a marble is rolled on at its last speed when no report comes. */
const AHEAD = 0.25;
/** How long a marble takes to glide from where it was shown to where a new report says it is. */
const GLIDE = 0.15;

/**
 * A friend's marble, drawn from reports that come a few times a second. Between them it rolls on at its last
 * speed; a late or surprising report is glided to, so a hiccup in the air shows as a drift and never a jump.
 */
export class Marble {
  /** 0 to 1, as last reported. */
  progress = 0;
  /** The finishing time, once it has crossed the line. */
  time: number | null = null;
  /** Its player has left. */
  gone = false;
  private last: Report | null = null;
  private at = 0;
  private off = { s: 0, x: 0, h: 0 };

  hear(report: Report, now: number): void {
    const shown = this.spot(now);
    this.off = shown && shown.lane === report.lane ? { s: shown.s - report.s, x: shown.x - report.x, h: shown.h - report.h } : { s: 0, x: 0, h: 0 };
    this.last = report;
    this.at = now;
    this.progress = report.p;
  }

  /** Where to draw it at `now`, or null before the first report. */
  spot(now: number): { lane: number; s: number; x: number; h: number } | null {
    const { last, off } = this;
    if (!last) return null;
    const since = Math.max(0, now - this.at);
    const left = 1 - Math.min(1, since / GLIDE);
    return { lane: last.lane, s: last.s + last.v * Math.min(since, AHEAD) + off.s * left, x: last.x + off.x * left, h: Math.max(0, last.h + off.h * left) };
  }
}

export type NearbyEvent =
  | { type: 'hosts'; hosts: Member[] }
  | { type: 'peer'; id: string; joined: boolean }
  | { type: 'message'; from: string; text: string }
  | { type: 'failed'; why: 'denied' | 'error' };

/**
 * The air between devices, whatever carries it. One device hosts and the rest join it; a joiner knows the host as
 * 'host' and the host knows each joiner by an id of the transport's choosing.
 */
export interface Nearby {
  listen(handler: (event: NearbyEvent) => void): void;
  host(name: string): Promise<void>;
  browse(): Promise<void>;
  join(id: string): Promise<void>;
  /** To one peer, or to everyone connected. */
  send(text: string, to?: string): void;
  leave(): void;
}

const HOST = 'host';

/** A game being got together or played: who is in it, where their marbles are, and the passing of news between them. */
export class Party {
  phase: 'idle' | 'hosting' | 'browsing' | 'joining' | 'joined' | 'closed' = 'idle';
  /** Why it closed. */
  why: Refusal | 'denied' | 'error' | 'ended' | null = null;
  /** Games found nearby, while looking. */
  hosts: Member[] = [];
  /** Everyone in, the host first, in the order they joined. */
  players: Member[] = [];
  me = '';
  /** Every other player's marble, by player. */
  readonly marbles = new Map<string, Marble>();
  /** Something on show has changed. */
  onChange = (): void => {};
  onStart = (_level: string): void => {};

  constructor(
    private readonly net: Nearby,
    public name: string,
    private readonly now: () => number,
    private readonly version = { v: PROTOCOL, courses: COURSES },
  ) {
    net.listen((event) => this.hear(event));
  }

  host(): void {
    this.reset('hosting');
    this.me = HOST;
    this.players = [{ id: HOST, name: this.name }];
    void this.net.host(this.name).catch(() => this.close('error'));
    this.onChange();
  }

  browse(): void {
    this.reset('browsing');
    void this.net.browse().catch(() => this.close('error'));
    this.onChange();
  }

  join(id: string): void {
    if (this.phase !== 'browsing') return;
    this.phase = 'joining';
    void this.net.join(id).catch(() => this.close('error'));
    this.onChange();
  }

  /** The host sets everyone off on a level. */
  start(level: string): void {
    if (this.phase !== 'hosting' || this.players.length < 2) return;
    this.net.send(encode({ t: 'start', level }));
    this.begin(level);
  }

  leave(): void {
    this.net.leave();
    this.reset('idle');
    this.onChange();
  }

  friends(): Member[] {
    return this.players.filter((player) => player.id !== this.me);
  }

  /** Where this player lines up on the grid. */
  slot(): number {
    return Math.max(0, this.players.findIndex((player) => player.id === this.me));
  }

  /** Tell the others where this player's marble is. */
  report(spot: Report): void {
    if (!this.live()) return;
    this.net.send(encode({ t: 'pos', ...spot, ...(this.phase === 'hosting' ? { from: HOST } : {}) }));
  }

  /** Tell the others this player has crossed the line. */
  finished(time: number): void {
    if (!this.live()) return;
    this.net.send(encode({ t: 'done', time, ...(this.phase === 'hosting' ? { from: HOST } : {}) }));
  }

  private live(): boolean {
    return this.phase === 'hosting' || this.phase === 'joined';
  }

  private reset(phase: Party['phase']): void {
    this.phase = phase;
    this.why = null;
    this.hosts = [];
    this.players = [];
    this.me = '';
    for (const marble of this.marbles.values()) marble.gone = true;
    this.marbles.clear();
  }

  private close(why: NonNullable<Party['why']>): void {
    if (this.phase === 'idle' || this.phase === 'closed') return;
    this.net.leave();
    this.reset('closed');
    this.why = why;
    this.onChange();
  }

  private begin(level: string): void {
    // A fresh marble each race: nobody starts with last race's finishing time.
    for (const friend of this.friends()) this.marbles.set(friend.id, new Marble());
    this.onStart(level);
  }

  private seat(players: Member[]): void {
    this.players = players;
    for (const [id, marble] of this.marbles) {
      if (players.some((player) => player.id === id)) continue;
      marble.gone = true;
      this.marbles.delete(id);
    }
    for (const friend of this.friends()) if (!this.marbles.has(friend.id)) this.marbles.set(friend.id, new Marble());
  }

  private announce(): void {
    for (const player of this.players) if (player.id !== HOST) this.net.send(encode({ t: 'roster', players: this.players, you: player.id }), player.id);
    this.onChange();
  }

  private hear(event: NearbyEvent): void {
    if (event.type === 'failed') return this.close(event.why);
    if (event.type === 'hosts') {
      if (this.phase !== 'browsing') return;
      this.hosts = event.hosts;
      return this.onChange();
    }
    if (event.type === 'peer') {
      if (this.phase === 'hosting' && !event.joined && this.players.some((player) => player.id === event.id)) {
        this.seat(this.players.filter((player) => player.id !== event.id));
        this.announce();
      } else if (this.phase === 'joining' && event.joined) {
        this.net.send(encode({ t: 'hello', ...this.version, name: this.name }));
      } else if ((this.phase === 'joining' || this.phase === 'joined') && !event.joined) {
        this.close('ended');
      }
      return;
    }
    const message = decode(event.text);
    if (!message) return;
    if (this.phase === 'hosting') this.asHost(event.from, message);
    else if (this.phase === 'joining' || this.phase === 'joined') this.asGuest(message);
  }

  private asHost(from: string, message: Message): void {
    const known = this.players.some((player) => player.id === from);
    if (message.t === 'hello') {
      if (known) return;
      const refuse = message.v !== this.version.v || message.courses !== this.version.courses ? 'version' : this.players.length >= PARTY_SIZE ? 'full' : null;
      if (refuse) return this.net.send(encode({ t: 'refuse', why: refuse }), from);
      this.seat([...this.players, { id: from, name: message.name.slice(0, 12) }]);
      return this.announce();
    }
    if (!known || (message.t !== 'pos' && message.t !== 'done')) return;
    this.note({ ...message, from });
    // Pass it on to everyone else, saying whose it is.
    const relayed = encode({ ...message, from });
    for (const player of this.players) if (player.id !== HOST && player.id !== from) this.net.send(relayed, player.id);
  }

  private asGuest(message: Message): void {
    if (message.t === 'refuse') return this.close(message.why);
    if (message.t === 'roster') {
      this.me = message.you;
      this.phase = 'joined';
      this.seat(message.players);
      return this.onChange();
    }
    if (this.phase !== 'joined') return;
    if (message.t === 'start') return this.begin(message.level);
    if (message.t === 'pos' || message.t === 'done') this.note(message);
  }

  private note(message: Extract<Message, { t: 'pos' | 'done' }>): void {
    const marble = message.from ? this.marbles.get(message.from) : undefined;
    if (!marble) return;
    if (message.t === 'pos') marble.hear(message, this.now());
    else marble.time = message.time;
  }
}
