// "Today's building idea": a gentle creative prompt that changes every day.
export const IDEAS = [
  'Build a spaceship for a hamster 🐹🚀',
  'Build the tallest ice-cream cone you can 🍦',
  'Make a castle with a moat and a drawbridge 🏰',
  'Build a cozy treehouse with a ladder 🌳',
  'Make a rainbow bridge across a river 🌈',
  'Build a lighthouse with a glowing top 💡',
  'Make a maze for your friends to solve 🌀',
  'Build a zoo with a home for every animal 🦒',
  'Make a giant smiley face out of blocks 😀',
  'Build a pirate ship with a sail ⛵',
  'Make a music path that plays a song 🎵',
  'Build a bakery next to a wheat farm 🍞',
  'Make a trampoline park 🦘',
  'Build a robot statue that looks like Bit 🤖',
  'Make a secret base hidden under a hill 🕵️',
  'Build a garden with every colour of flower 🌷',
  'Make a waterfall into a pool 💧',
  'Build a tiny village for your pets 🐶',
  'Make a racetrack with speed strips 🏁',
  'Build a snowman on top of a mountain ⛄',
  'Make a neon city that glows at night 🌃',
  'Build a bridge from one hill to another 🌉',
  'Make a firefly lantern garden for night time ✨',
  'Build a dragon out of wool 🐉',
  'Make a portal maze with coloured doors 🚪',
  'Build a playground with a slide and swings 🛝',
  'Make a giant birthday cake 🎂',
  'Build an underground train station 🚇',
  'Make a frog pond with lily pads 🐸',
  'Hide a Hidden Star and challenge someone to find it ⭐',
];

/** Same idea all day; changes at midnight. */
export function ideaOfTheDay(date = new Date()) {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return IDEAS[day % IDEAS.length];
}
