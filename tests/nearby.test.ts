import { describe, expect, it } from 'vitest';
import { COURSES } from '../src/core/progress';
import { catchUp, decode, encode, Marble, Party, PROTOCOL, type Nearby, type NearbyEvent } from '../src/core/nearby';

/** Devices within reach of each other, with no radio: whatever one sends arrives at once. */
function air() {
  const devices = new Map<string, { name: string; hosting: boolean; hear: (event: NearbyEvent) => void; links: Map<string, string> }>();
  let count = 0;
  const device = (): Nearby => {
    const id = `d${++count}`;
    const me = { name: '', hosting: false, hear: (_: NearbyEvent) => {}, links: new Map<string, string>() };
    devices.set(id, me);
    const hosts = () => [...devices].filter(([, each]) => each.hosting).map(([hostId, each]) => ({ id: hostId, name: each.name }));
    return {
      listen: (handler) => (me.hear = handler),
      host: async (name) => {
        me.name = name;
        me.hosting = true;
      },
      browse: async () => me.hear({ type: 'hosts', hosts: hosts() }),
      join: async (hostId) => {
        const host = devices.get(hostId)!;
        // The host knows the joiner by its own id; the joiner knows the host as 'host'.
        me.links.set('host', hostId);
        host.links.set(id, id);
        host.hear({ type: 'peer', id, joined: true });
        me.hear({ type: 'peer', id: 'host', joined: true });
      },
      send: (text, to) => {
        for (const [as, other] of me.links) {
          if (to && to !== as) continue;
          const there = devices.get(other)!;
          const from = [...there.links].find(([, target]) => target === id)?.[0] ?? id;
          there.hear({ type: 'message', from: as === 'host' ? id : from === id ? 'host' : from, text });
        }
      },
      leave: () => {
        me.hosting = false;
        for (const [as, other] of me.links) devices.get(other)!.hear({ type: 'peer', id: as === 'host' ? id : 'host', joined: false });
        me.links.clear();
      },
    };
  };
  return device;
}

describe('messages between devices', () => {
  it('survive the trip', () => {
    const spot = { t: 'pos' as const, n: 3, lane: 1, s: 123.4, x: -2.25, h: 0.5, v: 31.2, p: 0.25 };
    expect(decode(encode(spot))).toEqual(spot);
    expect(decode(encode({ t: 'start', n: 2, level: 'level-3' }))).toEqual({ t: 'start', n: 2, level: 'level-3' });
  });

  it('carry word of a smash, and only of a thing that can be on a course', () => {
    expect(decode(encode({ t: 'hit', n: 2, i: 14 }))).toEqual({ t: 'hit', n: 2, i: 14 });
    expect(decode('{"t":"hit","n":2,"i":-1}')).toBeNull();
    expect(decode('{"t":"hit","n":2,"i":1.5}')).toBeNull();
  });

  it('carry a cup table', () => {
    const table = { t: 'cup' as const, id: 'cup-0-1', race: 1, of: 4, points: [{ id: 'host', p: 10 }, { id: 'd2', p: 7 }] };
    expect(decode(encode(table))).toEqual(table);
    expect(decode('{"t":"cup","id":"cup-0-1","race":1,"of":4,"points":[{"id":"host","p":"lots"}]}')).toBeNull();
    expect(decode(encode({ t: 'nocup' }))).toEqual({ t: 'nocup' });
  });

  it('are dropped when they are not what they claim', () => {
    expect(decode('not json')).toBeNull();
    expect(decode('{"t":"pos","lane":"x"}')).toBeNull();
    expect(decode('{"t":"start"}')).toBeNull();
    expect(decode('{"t":"launch-missiles"}')).toBeNull();
  });
});

describe("a friend's marble", () => {
  const report = (s: number, v = 30, extra = {}) => ({ lane: 0, s, x: 0, h: 0, v, p: s / 1000, ...extra });

  it('is nowhere until it has been heard from', () => {
    expect(new Marble().spot(0)).toBeNull();
  });

  it('is known to have gone quiet when no report has come for a while', () => {
    const marble = new Marble();
    expect(marble.quiet(5)).toBe(true);
    marble.hear(report(100), 10);
    expect(marble.quiet(11)).toBe(false);
    expect(marble.quiet(13)).toBe(true);
  });

  it('says how fast it is rolling, and that it has stopped when the reports do', () => {
    const marble = new Marble();
    expect(marble.speed(0)).toBe(0);
    marble.hear(report(100, 30), 10);
    expect(marble.speed(10.1)).toBe(30);
    expect(marble.speed(13)).toBe(0);
  });

  it('keeps rolling at its last speed between reports', () => {
    const marble = new Marble();
    marble.hear(report(100), 10);
    expect(marble.spot(10)!.s).toBeCloseTo(100);
    expect(marble.spot(10.05)!.s).toBeCloseTo(101.5);
  });

  it('does not run on for ever when the reports stop', () => {
    const marble = new Marble();
    marble.hear(report(100), 10);
    expect(marble.spot(15)!.s).toBeCloseTo(marble.spot(11)!.s);
    expect(marble.spot(15)!.s).toBeLessThan(110);
  });

  it('glides to a late report with no jump', () => {
    const marble = new Marble();
    marble.hear(report(100), 10);
    const before = marble.spot(10.2)!.s;
    marble.hear(report(103), 10.2);
    expect(marble.spot(10.2)!.s).toBeCloseTo(before);
    expect(marble.spot(10.5)!.s).toBeCloseTo(103 + 30 * 0.25);
  });

  it('goes straight to another road', () => {
    const marble = new Marble();
    marble.hear(report(100), 10);
    marble.hear(report(20, 30, { lane: 2 }), 10.1);
    expect(marble.spot(10.1)).toMatchObject({ lane: 2, s: 20 });
  });
});

describe('a party', () => {
  const gather = () => {
    const device = air();
    const sam = new Party(device(), 'Sam', () => 0);
    const ada = new Party(device(), 'Ada', () => 0);
    const kit = new Party(device(), 'Kit', () => 0);
    sam.host();
    for (const guest of [ada, kit]) {
      guest.browse();
      guest.join(guest.hosts[0].id);
    }
    return { sam, ada, kit };
  };

  it('finds a game and joins it', () => {
    const { sam, ada, kit } = gather();
    expect(sam.phase).toBe('hosting');
    expect(ada.phase).toBe('joined');
    for (const party of [sam, ada, kit]) expect(party.players.map((p) => p.name)).toEqual(['Sam', 'Ada', 'Kit']);
    expect(ada.friends().map((p) => p.name)).toEqual(['Sam', 'Kit']);
    expect(kit.slot()).toBe(2);
  });

  it('starts everyone on the level the host picks', () => {
    const { sam, ada, kit } = gather();
    const started: string[] = [];
    for (const party of [sam, ada, kit]) party.onStart = (level) => (started.push(level), true);
    sam.start('level-4');
    expect(started).toEqual(['level-4', 'level-4', 'level-4']);
  });

  it('only lets the host start, and only with somebody to race', () => {
    const { sam, ada } = gather();
    const started: string[] = [];
    sam.onStart = ada.onStart = (level) => (started.push(level), true);
    ada.start('level-4');
    expect(started).toEqual([]);
    const alone = new Party(air()(), 'Solo', () => 0);
    alone.onStart = (level) => (started.push(level), true);
    alone.host();
    alone.start('level-1');
    expect(started).toEqual([]);
  });

  it('shows each player where the others are, the host passing it on', () => {
    const { sam, ada, kit } = gather();
    sam.start('level-1');
    ada.report({ lane: 0, s: 50, x: 1, h: 0, v: 20, p: 0.1 });
    const adaAtSam = sam.marbles.get(sam.players[1].id)!;
    const adaAtKit = kit.marbles.get(kit.players[1].id)!;
    expect(adaAtSam.spot(0)).toMatchObject({ s: 50, x: 1 });
    expect(adaAtKit.spot(0)).toMatchObject({ s: 50, x: 1 });
    expect(adaAtKit.progress).toBe(0.1);
    // Nobody is sent their own marble back.
    expect(ada.marbles.get(ada.me)).toBeUndefined();
  });

  it('tells everyone when a player crosses the line', () => {
    const { sam, ada, kit } = gather();
    sam.start('level-1');
    kit.finished(41.5);
    expect(sam.marbles.get(sam.players[2].id)!.time).toBe(41.5);
    expect(ada.marbles.get(ada.players[2].id)!.time).toBe(41.5);
  });

  it('carries on without a friend who drops out', () => {
    const { sam, ada, kit } = gather();
    ada.leave();
    expect(sam.players.map((p) => p.name)).toEqual(['Sam', 'Kit']);
    expect(kit.players.map((p) => p.name)).toEqual(['Sam', 'Kit']);
    expect(ada.phase).toBe('idle');
  });

  it('closes for everyone when the host leaves', () => {
    const { sam, ada, kit } = gather();
    sam.leave();
    expect(ada.phase).toBe('closed');
    expect(kit.why).toBe('ended');
  });

  it('turns away a device on another version of the game', () => {
    const device = air();
    const sam = new Party(device(), 'Sam', () => 0);
    const old = new Party(device(), 'Old', () => 0, { v: PROTOCOL, courses: COURSES - 1 });
    sam.host();
    old.browse();
    old.join(old.hosts[0].id);
    expect(old.phase).toBe('closed');
    expect(old.why).toBe('version');
    expect(sam.players.map((p) => p.name)).toEqual(['Sam']);
  });

  it('turns away a fifth player', () => {
    const device = air();
    const sam = new Party(device(), 'Sam', () => 0);
    sam.host();
    const guests = ['A', 'B', 'C', 'D'].map((name) => new Party(device(), name, () => 0));
    for (const guest of guests) {
      guest.browse();
      guest.join(guest.hosts[0].id);
    }
    expect(sam.players).toHaveLength(4);
    expect(guests[3].why).toBe('full');
  });

  it('cannot be started again until everyone racing is home or out', () => {
    const { sam, ada, kit } = gather();
    const started: string[] = [];
    sam.onStart = (level) => (started.push(level), true);
    sam.start('level-1');
    sam.start('level-2');
    expect(started).toEqual(['level-1']);
    expect(sam.canStart()).toBe(false);
    sam.finished(40);
    ada.finished(41);
    kit.out();
    expect(sam.canStart()).toBe(true);
    sam.start('level-2');
    expect(started).toEqual(['level-1', 'level-2']);
  });

  it('takes a player who gives up off the road for everyone', () => {
    const { sam, ada, kit } = gather();
    sam.start('level-1');
    ada.out();
    expect(sam.marbles.get(sam.players[1].id)!.gone).toBe(true);
    expect(kit.marbles.get(kit.players[1].id)!.gone).toBe(true);
  });

  it('leaves out a player who is busy elsewhere when the race starts', () => {
    const { sam, ada, kit } = gather();
    // Kit hears of the start last, as the last to join: over the air, everyone has been told before any answer comes back.
    kit.onStart = () => false;
    sam.start('level-1');
    expect(sam.marbles.get(sam.players[2].id)!.gone).toBe(true);
    expect(ada.marbles.get(ada.players[2].id)!.gone).toBe(true);
    sam.finished(40);
    ada.finished(41);
    expect(sam.canStart()).toBe(true);
  });

  it('takes no notice of news from the race before', () => {
    const { sam, ada, kit } = gather();
    sam.start('level-1');
    const stale = ada.raceNow();
    for (const party of [sam, ada, kit]) party.finished(40);
    sam.start('level-2');
    ada.finished(39, stale);
    expect(sam.marbles.get(sam.players[1].id)!.time).toBeNull();
    expect(kit.marbles.get(kit.players[1].id)!.time).toBeNull();
  });

  it('turns a newcomer away while a race is on', () => {
    const device = air();
    const sam = new Party(device(), 'Sam', () => 0);
    const ada = new Party(device(), 'Ada', () => 0);
    const kit = new Party(device(), 'Kit', () => 0);
    sam.host();
    ada.browse();
    ada.join(ada.hosts[0].id);
    sam.start('level-1');
    kit.browse();
    kit.join(kit.hosts[0].id);
    expect(kit.why).toBe('racing');
    expect(sam.players).toHaveLength(2);
  });

  it('races a cup: points for each place by the host\'s count, the same on every device', () => {
    const { sam, ada, kit } = gather();
    const started: string[] = [];
    for (const party of [sam, ada, kit]) party.onStart = (level) => (started.push(level), true);
    sam.startCup('cup-0-1', ['level-1', 'level-2']);
    expect(started).toEqual(['level-1', 'level-1', 'level-1']);
    expect(kit.cup).toEqual({ id: 'cup-0-1', race: 0, of: 2, points: {} });
    sam.finished(30);
    ada.finished(25);
    // Nothing is counted until everyone is home or out.
    expect(sam.cup!.race).toBe(0);
    kit.out();
    const [, adaId, kitId] = sam.players.map((p) => p.id);
    for (const party of [sam, ada, kit]) expect(party.cup).toEqual({ id: 'cup-0-1', race: 1, of: 2, points: { [adaId]: 10, host: 7, [kitId]: 0 } });
    sam.nextRace();
    expect(started.slice(3)).toEqual(['level-2', 'level-2', 'level-2']);
    kit.finished(20);
    ada.finished(21);
    sam.finished(22);
    for (const party of [sam, ada, kit]) expect(party.cup).toMatchObject({ race: 2, points: { [adaId]: 17, host: 12, [kitId]: 10 } });
    // The cup is over: there is no next race.
    sam.nextRace();
    expect(started).toHaveLength(6);
  });

  it('counts a cup race when the last one out drops off, and leaves a leaver out of the places', () => {
    const { sam, ada, kit } = gather();
    sam.startCup('cup-0-1', ['level-1', 'level-2']);
    ada.finished(20);
    sam.finished(30);
    kit.leave();
    expect(sam.cup).toMatchObject({ race: 1, points: { [sam.players[1].id]: 10, host: 7 } });
    expect(ada.cup).toMatchObject({ race: 1 });
    // Ada wins the next and then goes: Sam, the only one left in the table, is its winner.
    sam.nextRace();
    ada.finished(20);
    ada.leave();
    sam.finished(30);
    expect(sam.cup).toMatchObject({ race: 2, points: { host: 17 } });
  });

  it('lets a guest see whether the others are still out racing', () => {
    const { sam, ada, kit } = gather();
    let told = 0;
    ada.onChange = () => told++;
    expect(ada.racing()).toBe(false);
    sam.start('level-1');
    ada.finished(20);
    expect(ada.racing()).toBe(true);
    sam.finished(25);
    told = 0;
    kit.out();
    expect(ada.racing()).toBe(false);
    expect(told).toBeGreaterThan(0);
  });

  it('does not take a newcomer between races for somebody still out', () => {
    const device = air();
    const sam = new Party(device(), 'Sam', () => 0);
    const ada = new Party(device(), 'Ada', () => 0);
    const kit = new Party(device(), 'Kit', () => 0);
    sam.host();
    ada.browse();
    ada.join(ada.hosts[0].id);
    sam.start('level-1');
    sam.finished(20);
    ada.finished(21);
    kit.browse();
    kit.join(kit.hosts[0].id);
    expect(ada.racing()).toBe(false);
    expect(kit.racing()).toBe(false);
  });

  it('settles a dead heat by who sits nearer the starter, whoever was heard from first', () => {
    const { sam, ada, kit } = gather();
    sam.startCup('cup-0-1', ['level-1']);
    kit.finished(30);
    ada.finished(30);
    sam.finished(40);
    const [, adaId, kitId] = sam.players.map((p) => p.id);
    expect(sam.cup!.points).toEqual({ [adaId]: 10, [kitId]: 7, host: 5 });
  });

  it('tells everyone else what a player smashes, so it is gone on every road', () => {
    const { sam, ada, kit } = gather();
    const seen: string[] = [];
    sam.onHit = (from, index) => seen.push(`sam:${from}:${index}`);
    ada.onHit = (from, index) => seen.push(`ada:${from}:${index}`);
    kit.onHit = (from, index) => seen.push(`kit:${from}:${index}`);
    sam.start('level-1');
    const [, adaId, kitId] = sam.players.map((p) => p.id);
    ada.hit(7);
    expect(seen).toEqual([`sam:${adaId}:7`, `kit:${adaId}:7`]);
    seen.length = 0;
    sam.hit(3);
    expect(seen).toEqual(['ada:host:3', 'kit:host:3']);
    void kitId;
  });

  it('only lets the host start a cup', () => {
    const { ada, sam } = gather();
    ada.startCup('cup-0-1', ['level-1']);
    expect(ada.cup).toBeNull();
    expect(sam.cup).toBeNull();
  });

  it('drops the cup for everyone when the host picks a single race instead', () => {
    const { sam, ada, kit } = gather();
    sam.startCup('cup-0-1', ['level-1', 'level-2']);
    for (const party of [sam, ada, kit]) party.finished(30);
    sam.start('level-5');
    for (const party of [sam, ada, kit]) expect(party.cup).toBeNull();
  });

  it('clears a finished cup away for everyone when the host goes to choose again', () => {
    const { sam, ada, kit } = gather();
    sam.startCup('cup-0-1', ['level-1']);
    for (const party of [sam, ada, kit]) party.finished(30);
    expect(kit.cup!.race).toBe(1);
    ada.dropCup();
    expect(ada.cup).not.toBeNull();
    sam.dropCup();
    for (const party of [sam, ada, kit]) expect(party.cup).toBeNull();
  });

  it('shows a newcomer the cup as it stands', () => {
    const device = air();
    const sam = new Party(device(), 'Sam', () => 0);
    const ada = new Party(device(), 'Ada', () => 0);
    const kit = new Party(device(), 'Kit', () => 0);
    sam.host();
    ada.browse();
    ada.join(ada.hosts[0].id);
    sam.startCup('cup-0-1', ['level-1', 'level-2']);
    sam.finished(30);
    ada.finished(31);
    kit.browse();
    kit.join(kit.hosts[0].id);
    expect(kit.cup).toMatchObject({ race: 1, points: { host: 10 } });
  });

  it('remembers whose game it was once it has closed', () => {
    const { sam, ada } = gather();
    sam.leave();
    expect(ada.phase).toBe('closed');
    expect(ada.closedBy).toBe('Sam');
  });
});

describe('getting everyone ready', () => {
  const gather = () => {
    const device = air();
    const sam = new Party(device(), 'Sam', () => 0);
    const ada = new Party(device(), 'Ada', () => 0);
    const kit = new Party(device(), 'Kit', () => 0);
    sam.host();
    for (const guest of [ada, kit]) {
      guest.browse();
      guest.join(guest.hosts[0].id);
    }
    const started: string[] = [];
    for (const party of [sam, ada, kit]) party.onStart = (level) => (started.push(level), true);
    return { sam, ada, kit, started };
  };

  it('starts nothing until every player has said they are ready', () => {
    const { sam, ada, kit, started } = gather();
    sam.pick({ level: 'level-4' });
    for (const party of [sam, ada, kit]) expect(party.offer).toEqual({ level: 'level-4' });
    expect(started).toEqual([]);
    ada.ready();
    expect(started).toEqual([]);
    const [, adaId] = sam.players.map((p) => p.id);
    for (const party of [sam, ada, kit]) expect(party.readyIds).toEqual(['host', adaId]);
    kit.ready();
    expect(started).toEqual(['level-4', 'level-4', 'level-4']);
    for (const party of [sam, ada, kit]) expect(party.offer).toBeNull();
  });

  it('only takes a pick from whoever started the game', () => {
    const { sam, ada, started } = gather();
    ada.pick({ level: 'level-4' });
    expect(sam.offer).toBeNull();
    expect(ada.offer).toBeNull();
    expect(started).toEqual([]);
  });

  it('lets the starter change their mind before everyone is ready', () => {
    const { sam, ada, kit, started } = gather();
    sam.pick({ level: 'level-4' });
    ada.ready();
    sam.unpick();
    for (const party of [sam, ada, kit]) expect(party.offer).toBeNull();
    kit.ready();
    expect(started).toEqual([]);
  });

  it('runs a cup the same way, a race at a time', () => {
    const { sam, ada, kit, started } = gather();
    sam.pick({ cup: 'cup-0-1', levels: ['level-1', 'level-2'] });
    expect(kit.offer).toEqual({ level: 'level-1', cup: 'cup-0-1' });
    ada.ready();
    kit.ready();
    expect(started).toEqual(['level-1', 'level-1', 'level-1']);
    for (const party of [sam, ada, kit]) party.finished(30);
    expect(kit.cup).toMatchObject({ race: 1 });
    sam.pick('next');
    expect(ada.offer).toEqual({ level: 'level-2', cup: 'cup-0-1' });
    expect(started).toHaveLength(3);
    ada.ready();
    kit.ready();
    expect(started.slice(3)).toEqual(['level-2', 'level-2', 'level-2']);
  });

  it('goes without a player who leaves instead of getting ready, and calls it off if nobody is left to race', () => {
    const { sam, ada, kit, started } = gather();
    sam.pick({ level: 'level-4' });
    ada.ready();
    kit.leave();
    expect(started).toEqual(['level-4', 'level-4']);
    sam.finished(20);
    ada.finished(21);
    sam.pick({ level: 'level-5' });
    ada.leave();
    expect(sam.offer).toBeNull();
    expect(started).toHaveLength(2);
  });

  it('shows a newcomer what has been picked', () => {
    const device = air();
    const sam = new Party(device(), 'Sam', () => 0);
    const ada = new Party(device(), 'Ada', () => 0);
    const kit = new Party(device(), 'Kit', () => 0);
    sam.host();
    ada.browse();
    ada.join(ada.hosts[0].id);
    sam.pick({ level: 'level-4' });
    kit.browse();
    kit.join(kit.hosts[0].id);
    expect(kit.offer).toEqual({ level: 'level-4' });
    expect(kit.readyIds).toEqual(['host']);
    // And the race now waits for them too.
    const started: string[] = [];
    kit.onStart = (level) => (started.push(level), true);
    ada.ready();
    expect(started).toEqual([]);
    kit.ready();
    expect(started).toEqual(['level-4']);
  });

  it('brings everyone back to the waiting room when the starter moves on from the finishing order', () => {
    const { sam, ada, kit } = gather();
    const moved: string[] = [];
    ada.onRoom = () => moved.push('ada');
    kit.onRoom = () => moved.push('kit');
    sam.toRoom();
    expect(moved).toEqual(['ada', 'kit']);
    moved.length = 0;
    sam.pick({ level: 'level-4' });
    expect(moved).toEqual(['ada', 'kit']);
  });
});

describe('a helping hand for whoever is behind', () => {
  // How far behind the leader, in road; how far the leader has got, 0 to 1; seconds into the race.
  it('is nothing for the leader, or for anyone close behind', () => {
    expect(catchUp(-50, 0.5, 20)).toBe(0);
    expect(catchUp(0, 0.5, 20)).toBe(0);
    expect(catchUp(30, 0.5, 20)).toBe(0);
  });

  it('grows with the gap, up to a small most', () => {
    expect(catchUp(92.5, 0.5, 20)).toBeCloseTo(0.03);
    expect(catchUp(150, 0.5, 20)).toBeCloseTo(0.06);
    expect(catchUp(2000, 0.5, 20)).toBeCloseTo(0.06);
  });

  it('is not there at the very start, and fades away as the leader nears the line', () => {
    expect(catchUp(150, 0.05, 2)).toBe(0);
    expect(catchUp(150, 0.8, 20)).toBeCloseTo(0.06);
    expect(catchUp(150, 0.9, 20)).toBeCloseTo(0.03);
    expect(catchUp(150, 1, 20)).toBe(0);
  });
});
