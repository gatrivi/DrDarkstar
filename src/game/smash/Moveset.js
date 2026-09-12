// Andy's moveset — Wing Tsun flurry, golf drive, ping-pong serve, Todd the Vegan power.
// All damage/knockback numbers feed SmashStage.knockback() at hit time.
export const MOVES = {
  punch: {
    label: 'Wing Tsun chain punch',
    pose: 'punch1',
    duration: 0.34,
    animRate: 0.09,
    active: [0.04, 0.22],
    reach: 46, heightRatio: 0.35,
    damage: 3, base: 130, scaling: 0.6, angle: -0.2,
  },
  windup: { // charging stance; releases into golfswing
    label: 'Golf drive (charging)',
    pose: 'windup',
    duration: Infinity,
    animRate: 0.3,
  },
  golfswing: {
    label: 'Golf drive',
    pose: 'swing',
    duration: 0.45,
    animRate: 0.2,
    active: [0.05, 0.2],
    reach: 70, heightRatio: 0.6,
    damage: 9, base: 240, scaling: 2.1, angle: -0.45,
  },
  serve: {
    label: 'Ping-pong serve',
    pose: 'serve',
    duration: 0.4,
    animRate: 0.2,
    active: [0.12, 0.14], // spawn window for the ball
    spawn: 'pongball',
    damage: 0,
  },
  retriever: {
    label: 'Retriever summon',
    pose: 'whistle',
    duration: 0.5,
    animRate: 0.2,
    active: [0.15, 0.17], // spawn window for the dog
    spawn: 'retriever',
  },
  super: {
    label: 'Todd the Vegan power',
    pose: 'super',
    duration: 0.6,
    animRate: 0.3,
  },
};
