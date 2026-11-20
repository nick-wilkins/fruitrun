import { CUP_POINTS } from './cups';
import { COURSES } from './progress';

/** Raised whenever the messages change, so devices that would misread each other refuse to race. */
export const PROTOCOL = 2;
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

export type Refusal = 'version' | 'full' | 'racing';

export type Message =
  | { t: 'hello'; v: number; courses: number; name: string }
  | { t: 'roster'; players: Member[]; you: string }
  | { t: 'refuse'; why: Refusal }
  | { t: 'start'; n: number; level: string }
  | ({ t: 'pos'; n: number; from?: string } & Report)
  | { t: 'done'; n: number; time: number; from?: string }
  | { t: 'out'; n: number; from?: string }
  | { t: 'cup'; id: string; race: number; of: number; points: { id: string; p: number }[] }
  | { t: 'nocup' };

/** A cup being raced by the party: which one, how many of its races are run, and everyone's points so far. */
export interface PartyCup {
  id: string;
  race: number;
  of: number;
  points: Record<string, number>;
}

const round = (value: number, to: number) => Math.round(value * to) / to;

export function encode(message: Message): string {
  if (message.t !== 'pos') return JSON.stringify(message);
  const { n, lane, s, x, h, v, p, from } = message;
  return JSON.stringify({ t: 'pos', n, lane, s: round(s, 100), x: round(x, 100), h: round(h, 100), v: round(v, 10), p: round(p, 1000), ...(from ? { from } : {}) });
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
      return m.why === 'version' || m.why === 'full' || m.why === 'racing' ? { t: 'refuse', why: m.why } : null;
    case 'start':
      return num(m.n) && text(m.level) ? { t: 'start', n: m.n, level: m.level } : null;
    case 'pos':
      return num(m.n) && num(m.lane) && num(m.s) && num(m.x) && num(m.h) && num(m.v) && num(m.p) ? { t: 'pos', n: m.n, lane: m.lane, s: m.s, x: m.x, h: m.h, v: m.v, p: m.p, ...from } : null;
    case 'done':
      return num(m.n) && num(m.time) && m.time > 0 ? { t: 'done', n: m.n, time: m.time, ...from } : null;
    case 'out':
      return num(m.n) ? { t: 'out', n: m.n, ...from } : null;
    case 'cup': {
      if (!text(m.id) || !num(m.race) || !num(m.of) || !Array.isArray(m.points) || m.points.length > PARTY_SIZE) return null;
      const points = (m.points as Record<string, unknown>[]).filter((row) => row && text(row.id) && num(row.p)).map((row) => ({ id: row.id as string, p: row.p as number }));
      return points.length === m.points.length ? { t: 'cup', id: m.id, race: m.race, of: m.of, points } : null;
    }
    case 'nocup':
      return { t: 'nocup' };
    default:
      return null;
  }
}

/** The helping hand: no help within `near` of the leader, the `most` from `far` back, in road covered for the same rolling. */
const HELP = { near: 35, far: 150, most: 0.06, notBefore: 4, fadeFrom: 0.8 };

/**
 * How much further a player behind in a race with friends rolls for their speed, as a share: 0 to 0.06. Only the
 * one behind is ever helped and nobody is held back. It grows with the gap, so it narrows one without closing it,
 * and it is gone by the time the leader reaches the line, so the finish is the players' own.
 * `gap` is how far behind the leader in road, `leader` how much of the course the leader has done, `time` seconds raced.
 */
export function catchUp(gap: number, leader: number, time: number): number {
  if (time < HELP.notBefore || gap <= HELP.near) return 0;
  const share = Math.min(1, (gap - HELP.near) / (HELP.far - HELP.near));
  const fade = Math.min(1, Math.max(0, (1 - leader) / (1 - HELP.fadeFrom)));
  return HELP.most * share * fade;
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
  /** The cup being raced, if the host chose one. */
  cup: PartyCup | null = null;
  /** Whose game it was, once it has closed: they closed it, or the way to them was lost. */
  closedBy = '';
  /** Which race this is, counted by the host. News from any other race is ignored. */
  private race = 0;
  /** The host's list of the cup's levels, and of who has finished the race under way and when. */
  private cupLevels: string[] = [];
  private readonly times = new Map<string, number>();
  /** The host's list of who is still out on the course. */
  private readonly busy = new Set<string>();
  /** Something on show has changed. */
  onChange = (): void => {};
  /** A race is starting. Answer false if this player cannot take part just now: they sit this one out. */
  onStart = (_level: string): boolean => true;

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

  /** The host sets everyone off on a single level. A cup under way is given up. */
  start(level: string): void {
    if (!this.canStart()) return;
    if (this.cup) {
      this.cup = null;
      this.tell(encode({ t: 'nocup' }));
    }
    this.launch(level);
  }

  /** The host enters everyone in a cup and sets off its first race. */
  startCup(id: string, levels: string[]): void {
    if (!this.canStart() || !levels.length) return;
    this.cup = { id, race: 0, of: levels.length, points: {} };
    this.cupLevels = levels;
    this.tellCup();
    this.launch(levels[0]);
  }

  /** The host calls the cup off, or clears away one that is over, to choose something new. */
  dropCup(): void {
    if (this.phase !== 'hosting' || !this.cup || this.busy.size) return;
    this.cup = null;
    this.tell(encode({ t: 'nocup' }));
    this.onChange();
  }

  /** The host sets off the cup's next race, if it has one. */
  nextRace(): void {
    if (!this.canStart() || !this.cup || this.cup.race >= this.cup.of) return;
    this.launch(this.cupLevels[this.cup.race]);
  }

  private launch(level: string): void {
    this.race++;
    this.busy.clear();
    this.times.clear();
    for (const player of this.players) this.busy.add(player.id);
    this.begin(level, () => this.tell(encode({ t: 'start', n: this.race, level })));
  }

  private tellCup(): void {
    const { cup } = this;
    if (cup) this.tell(encode({ t: 'cup', id: cup.id, race: cup.race, of: cup.of, points: Object.entries(cup.points).map(([id, p]) => ({ id, p })) }));
  }

  /** Everyone is home or out: the host counts the cup race, quickest first by each player's own clock. Not finishing scores nothing. */
  private score(): void {
    const { cup } = this;
    if (!cup || cup.race >= cup.of) return;
    const home = [...this.times].sort((a, b) => a[1] - b[1]).map(([id]) => id);
    const points: Record<string, number> = {};
    for (const { id } of this.players) points[id] = (cup.points[id] ?? 0) + (CUP_POINTS[home.indexOf(id)] ?? 0);
    this.cup = { ...cup, race: cup.race + 1, points };
    this.tellCup();
  }

  /** Whether the host may set a race off: somebody to race, and nobody still out from the last one. */
  canStart(): boolean {
    return this.phase === 'hosting' && this.players.length > 1 && this.busy.size === 0;
  }

  /** Whether anyone is still out on the course, as far as this device has heard. */
  racing(): boolean {
    if (this.phase === 'hosting') return this.busy.size > 0;
    return this.race > 0 && [...this.marbles.values()].some((marble) => !marble.gone && marble.time === null);
  }

  raceNow(): number {
    return this.race;
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
    if (this.live()) this.tell(encode({ t: 'pos', n: this.race, ...spot, ...this.asMe() }));
  }

  /** Tell the others this player has crossed the line. */
  finished(time: number, race = this.race): void {
    if (!this.live()) return;
    this.tell(encode({ t: 'done', n: race, time, ...this.asMe() }));
    if (race !== this.race) return;
    if (this.phase === 'hosting') this.times.set(HOST, time);
    this.home(HOST);
  }

  /** Tell the others this player has given the race up, or could not start it. */
  out(): void {
    if (!this.live()) return;
    this.tell(encode({ t: 'out', n: this.race, ...this.asMe() }));
    this.home(HOST);
  }

  private asMe(): { from?: string } {
    return this.phase === 'hosting' ? { from: HOST } : {};
  }

  /** To the host from a guest; from the host, to everyone who has been let in, except perhaps one. */
  private tell(line: string, except?: string): void {
    if (this.phase !== 'hosting') return this.net.send(line);
    for (const player of this.players) if (player.id !== HOST && player.id !== except) this.net.send(line, player.id);
  }

  /** The host notes that a player is no longer out on the course. */
  private home(id: string): void {
    if (this.phase !== 'hosting' || !this.busy.delete(id)) return;
    if (!this.busy.size) this.score();
    this.onChange();
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
    this.race = 0;
    this.cup = null;
    this.closedBy = '';
    this.cupLevels = [];
    this.times.clear();
    this.busy.clear();
    for (const marble of this.marbles.values()) marble.gone = true;
    this.marbles.clear();
  }

  private close(why: NonNullable<Party['why']>): void {
    if (this.phase === 'idle' || this.phase === 'closed') return;
    this.net.leave();
    const by = this.players[0]?.name ?? '';
    this.reset('closed');
    this.closedBy = by;
    this.why = why;
    this.onChange();
  }

  private begin(level: string, announce = (): void => {}): void {
    // A fresh marble each race: nobody starts with last race's finishing time. They are made before anyone is
    // told, so an answer that comes straight back lands on the new one.
    for (const friend of this.friends()) this.marbles.set(friend.id, new Marble());
    announce();
    if (!this.onStart(level)) this.out();
  }

  private seat(players: Member[]): void {
    this.players = players;
    const out = this.busy.size;
    for (const [id, marble] of this.marbles) {
      if (players.some((player) => player.id === id)) continue;
      marble.gone = true;
      this.marbles.delete(id);
      this.busy.delete(id);
      // Whoever has gone is in no table: their time takes no place from those who stayed.
      this.times.delete(id);
    }
    // The one everybody was waiting for has gone: the race is over.
    if (this.phase === 'hosting' && out && !this.busy.size) this.score();
    for (const friend of this.friends()) if (!this.marbles.has(friend.id)) this.marbles.set(friend.id, new Marble());
  }

  private announce(): void {
    for (const player of this.players) if (player.id !== HOST) this.net.send(encode({ t: 'roster', players: this.players, you: player.id }), player.id);
    this.tellCup();
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
      const refuse = message.v !== this.version.v || message.courses !== this.version.courses ? 'version' : this.players.length >= PARTY_SIZE ? 'full' : this.busy.size ? 'racing' : null;
      if (refuse) return this.net.send(encode({ t: 'refuse', why: refuse }), from);
      this.seat([...this.players, { id: from, name: message.name.slice(0, 12) }]);
      return this.announce();
    }
    if (!known || (message.t !== 'pos' && message.t !== 'done' && message.t !== 'out') || message.n !== this.race) return;
    this.note({ ...message, from });
    if (message.t === 'done') this.times.set(from, message.time);
    // Pass it on to everyone else, saying whose it is.
    this.tell(encode({ ...message, from }), from);
    if (message.t !== 'pos') this.home(from);
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
    if (message.t === 'cup' || message.t === 'nocup') {
      this.cup = message.t === 'cup' ? { id: message.id, race: message.race, of: message.of, points: Object.fromEntries(message.points.map((row) => [row.id, row.p])) } : null;
      return this.onChange();
    }
    if (message.t === 'start') {
      this.race = message.n;
      return this.begin(message.level);
    }
    if ((message.t === 'pos' || message.t === 'done' || message.t === 'out') && message.n === this.race) this.note(message);
  }

  private note(message: Extract<Message, { t: 'pos' | 'done' | 'out' }>): void {
    const marble = message.from ? this.marbles.get(message.from) : undefined;
    if (!marble) return;
    if (message.t === 'pos') return marble.hear(message, this.now());
    if (message.t === 'done') marble.time = message.time;
    else marble.gone = true;
    // Who is still out has changed, which a waiting room shows.
    if (this.phase === 'joined') this.onChange();
  }
}
