# Cabeaí

**Will it fit?** Draw your home's floor plan to scale, place your furniture and see whether you can walk around, open the doors and sit at the table. Free, open source, with AI.

**Use it:** https://cabeai.howlks.com

*Leia em português: [README.pt-BR.md](README.pt-BR.md)*

- A home with **floors** and **rooms**: look at one room, all rooms **side by side**, or the **assembled home plan** (floors side by side, draggable rooms that snap wall to wall, and arrows showing the distance between them).
- **Doors, windows, air conditioners and hookups** on every wall: switch, outlet, wall light, TV, network, water, drain and gas. A door on a wall shared by two rooms counts for both.
- Place a room **to the right, left, above or below** another one, add **hallways** that connect two rooms with the length you choose, and **straight or spiral stairs**.
- **Furniture with real measurements**: bed (with a **storage chest** at the headboard, at the foot or both, wider than the bed, centered, left, right or offset), wardrobe, crib, dresser, **table with chairs** (in front, on both sides or all around, including the space to pull them out), chair, sofa, TV stand, bookcase, fridge, stove, sink, washing machine, cabinet and more.
- **Free space in front of each piece** is calculated from its doors and drawers, and you can change it for custom-made furniture.
- **Warnings** when something doesn't fit: a door hitting furniture, a blocked window, a covered switch, outlet or hookup, chairs without room, overlapping rooms.
- **Scenarios** to compare layouts of one room or the whole home (update the one in use or save a new one), plus **3 suggestions** made by the built-in engine or by **AI**, which put the TV stand at the TV outlet, the sink and washer at the water and drain, and the stove at the gas.
- Everything is **saved in your browser**; you can **export and import** a file.
- Works on **phones** and **computers**, in **Simple** or **Advanced** mode (properties panel, exact positions, locked furniture), in **Portuguese** and **English**.

## Free AI

Cabeaí has three ways to suggest layouts, all free:

1. **Automatic suggestions**: a rules engine that runs in the browser. Always available.
2. **Online AI** (`/api/ia`): uses the **free models of the Vercel AI Gateway**. On Vercel, authentication is automatic (OIDC), no key needed. If you prefer Google's **Gemini**, create a free key at [Google AI Studio](https://aistudio.google.com/apikey) and set `GOOGLE_GENERATIVE_AI_API_KEY`.
3. **Browser AI**: in desktop Google Chrome (recent versions with built-in Gemini Nano), the AI runs on the device itself and nothing is sent anywhere.

Every AI answer is checked against the measurements before it is shown: furniture is brought back inside the room and problems are counted. If any problem is left, the AI gets the list and tries to fix it once.

The endpoint has a per-address rate limit, only accepts requests from the site itself and only receives the data of one room (measurements, doors, windows and furniture).

## Run it on your computer

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
git clone https://github.com/HerbertJulio/cabeai.git
cd cabeai
npm install
npm run dev
```

Open http://localhost:3000.

For the online AI to work locally, create a `.env.local` file (see `.env.example`) with **one** of these:

- `AI_GATEWAY_API_KEY`: an AI Gateway key (Vercel dashboard → AI Gateway → API Keys), or run `vercel env pull` in a project linked to Vercel to get the OIDC token;
- `GOOGLE_GENERATIVE_AI_API_KEY`: a free Google AI Studio key.

Other commands:

```bash
npm test          # geometry, home and suggestion tests (Vitest)
npm run typecheck # TypeScript
npm run build     # production build
npm start         # serve the build
```

## Deploy

The repository is connected to Vercel: every `git push` to `main` goes live, and every pull request gets a preview URL. To deploy your own copy, import the repository at [vercel.com/new](https://vercel.com/new) (Next.js preset, no extra settings).

Optional environment variables:

| Variable | What for |
| --- | --- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Use Gemini (Google AI Studio) before the free AI Gateway models |
| `CABEAI_GEMINI` | Which Gemini model to use (default `gemini-flash-latest`) |
| `CABEAI_MODELOS` | Comma-separated AI Gateway models (default: the free ones available) |

Diagnostics: `/api/ia` shows whether the online AI is configured; `/api/ia?teste=1` asks it a tiny question.

## How the code is organized

```
app/            pages (Next.js App Router), styles, fonts and the /api/ia route
components/     React UI (SVG floor plan, panels, dialogs, menus)
  desenho/      to-scale drawing of rooms and furniture (1 unit = 1 cm)
lib/            logic without UI: geometry, warnings, home, suggestions, AI, data, i18n
tests/          tests (Vitest)
```

- `lib/geometria.ts`: measurements, clearances, chairs, chests and the rule behind each warning.
- `lib/casa.ts`: rooms on the home plan, snapping, distances and doors on shared walls.
- `lib/motor.ts`: the automatic suggestions.
- `lib/ia.ts`: the AI request and the checking of its answers.
- `lib/i18n.ts`: Portuguese and English (`tx('português', 'English')`).
- `lib/store.ts`: app state (Zustand).

## Privacy

No account, sign-up or tracking. The floor plan stays in the user's browser. Only when someone taps "Ask the AI" is that room's data sent to the chosen AI, and nothing is stored on the server.

## Support the project

Cabeaí is free and ad-free. If it helped you, you can support it:

- [GitHub Sponsors](https://github.com/sponsors/HerbertJulio)
- PIX (Brazil, e-mail key): hvcotta@gmail.com

Ideas and bug reports are welcome in the [issues](https://github.com/HerbertJulio/cabeai/issues).

## License

[MIT](LICENSE). Barlow and Barlow Condensed fonts under the [SIL Open Font License](app/fontes/OFL-Barlow.txt).
