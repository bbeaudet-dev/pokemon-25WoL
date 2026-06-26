<div align="center">

<img src="src/app/icon.svg" alt="Pokeball logo" width="96" height="96" />

# 25 Words or Less: Pokémon Edition!

### Get your friends to guess your target words using as few hints as possible.

A fast, friendly, realtime party game where one player drops one-word clues and everyone else races to guess what they mean. Pokémon, items, gym leaders, towns, and more — all live in your browser, no install required.

**[▶ Play it now](https://pokemon-25-wol.vercel.app)** &nbsp;•&nbsp; **[Watch the inspiration](https://www.youtube.com/watch?v=10x-S7t1Tq0&t=1550s)**

</div>

---

## What is this?

Think of it like charades, but with words instead of acting. Each round, one person becomes the **Hintmaster**. They get a secret list of 10 Pokémon-themed answers and have to get everyone else to guess them — *in order* — by giving short clues, one word at a time.

The catch? You want to use as **few** words as possible. The fewer clues it takes, the more points the Hintmaster scores. Everyone else is racing to be the first to shout out the right answer.

Grab a few friends, share a link, and see who's got the best Pokémon brain.

## How to play

1. **Create a lobby** and send the link (or 6-character code) to your friends.
2. **Ready up.** Once everyone's in, the host kicks things off.
3. **Hintmaster's turn:** you see 10 secret answers. Feed the group one-word clues — e.g. `grass` + `starter` to nudge them toward *Bulbasaur*. Don't love your words? You can reroll, but it'll cost you.
4. **Everyone else guesses.** Type to search the Pokémon database and lock in your answer. First correct guess wins the point — but guess twice on the same clue and it costs you, so don't jump the gun!
5. **Score it.** Answers reveal one by one as they're solved. The Hintmaster earns points for every clue they *didn't* need to use.
6. **Pass the torch.** The next player becomes Hintmaster, and a new round begins.

## Game modes

- **Classic** — Pokémon, items, gym leaders, professors, badges, games, regions, and towns. A great mix for any group.
- **Advanced** — everything in Classic plus trickier categories like types, moves, and abilities. For the Pokémon experts.

Hosts can tweak the rules too: how many turns each player gets as Hintmaster, the scoring word limit, and the hard cap on clues.

## Built with

- **[Next.js](https://nextjs.org/)** (App Router) + **React** + **TypeScript** for the web app
- **[Convex](https://convex.dev/)** for the realtime backend — live queries keep every player's screen in sync instantly
- **[Tailwind CSS](https://tailwindcss.com/)** for the bright, geometric look
- **[Vercel](https://vercel.com/)** for hosting
- Pokémon data seeded from **[PokéAPI](https://pokeapi.co/)**

## Run it locally

You'll need [Node.js](https://nodejs.org/) and a free [Convex](https://convex.dev/) account.

```sh
# 1. Install dependencies
npm install

# 2. Start the web app (in one terminal)
npm run dev

# 3. Start the Convex backend (in another terminal)
npm run dev:convex

# 4. Seed the Pokémon content (once Convex is linked)
npm run seed:content
```

Then open [http://localhost:3000](http://localhost:3000) and you're off!

More detail lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Feedback

Played it and have thoughts? I'd genuinely love to hear them — good, bad, or bug. It takes about a minute:

**[Share feedback](https://docs.google.com/forms/d/e/1FAIpQLScTsZ4dWwLgLwfDaOZYTmbj6t6GScRlnrMcs7TKB5fpbOkrIw/viewform)**

## Credits

This whole thing exists because of **[ZaneGames](https://www.youtube.com/watch?v=10x-S7t1Tq0&t=1550s)**, who built the original Pokémon spin on *25 Words or Less* and said in his video:

> "I give full permission to anybody out there to turn this into a website in their free time."

Challenge accepted.

## Support

This is a passion project, built for fun and given away for free. If you enjoyed it and want to chip in toward server costs (or just a literal coffee), it's genuinely appreciated — but never expected.

[Buy me a coffee](https://buymeacoffee.com/benbeaudet)

Either way, thanks for playing!
 