# Cabeaí

**Will it fit?** Draw your home's floor plan to scale, place your furniture and see whether you can walk around, open the doors and sit at the table. Free, open source, with AI.

**Use it:** https://cabeai.howlks.com

*Leia em português: [README.pt-BR.md](README.pt-BR.md)*

- **Step by step**: "The whole house" goes from the plot to the house outline, the rooms, the doors and windows and, last, the furniture; "Just one room" asks for its size, then the door, the window and the furniture. Each step says whether it's required or optional, optional ones can be skipped, and the plan shows the result while you type. Rooms can start from a template (studio, 1, 2 or 3 bedrooms) and the doors, windows and furniture can be placed for you.
- **The plot around the house**: front, depth and the street side, with the setbacks you type; the drawing gets the street, the sidewalk, the path to the front door and garden trees in the free corners, plus the overall dimensions of the house.
- **Draw the floor plan** with your finger or the mouse: pick living room, bedroom, bathroom, kitchen, hallway, porch… Drag a room by its floor or name to move it; near another room the walls snap together, and hallways and porches get a door or an opening to the rooms they touch (it goes away if they move apart). In the drawing bar, pick Door, Sliding, Opening or Window and tap a wall to put it there, or **Wall** to split a room by dragging from one wall to the other. Dragging a wall resizes the rooms on both sides at once.
- **Cut a wall** between two rooms: tap the scissors and drag along the wall from where to where to cut; the blue ends adjust it later, and "Whole wall" removes all of it so both become one open space (an L-shaped room, for example). Put it back whenever you want.
- **Photo of a paper sketch**: take a picture of your sketch and the AI builds the rooms, hallways, doors and windows.
- A home with **floors** and **rooms**: look at one room, all rooms **side by side**, or the **assembled home plan** (floors side by side; rooms you can drag, stretch by their walls and rotate, that snap wall to wall, with arrows showing the distance between them).
- **A plan that reads like an architect's**: each room gets the floor of its type (wood in bedrooms, porcelain tiles in the living room and hallways, ceramic in bathrooms, decking on porches), furniture casts a soft shadow and each room's name sits in the middle of its free floor, with its size and area, readable at any zoom. Tapping a piece of furniture, a door or a room shows an **action bar** right above it (rotate, duplicate, edit, flip the door, and More for the rest); while drawing it sits at the bottom, next to the tools, so it doesn't cover the walls.
- **Doors, windows, air conditioners and hookups** on every wall: switch, outlet, wall light, TV, network, water, drain and gas. A door can be hinged, double, sliding or just an opening (no door).
- **A door belongs to the wall**, not to a single room: you can tap it from either side, and the panel says which room it opens into, by name. With it selected, the action bar flips it: one button says which room it will open into, by name, and the other switches the hinge side (or, on a sliding door, the side it slides to). Automatic doors go near a corner, opening against the wall, the way builders do it.
- Place a room **to the right, left, above or below** another one, add **hallways** that connect two rooms with the length you choose, and **straight or spiral stairs**.
- **Furniture with real measurements**: bed (with a **storage chest** at the headboard, at the foot or both, wider than the bed, centered, left, right or offset), wardrobe, crib, dresser, nightstand, **table with chairs** (in front, on both sides or all around, including the space to pull them out), chair, sofa, armchair, TV stand, bookcase, fridge, stove, sink, washing machine, utility sink, cabinet, toilet, bathroom sink, shower, bathtub and more.
- **Free space in front of each piece** is calculated from its doors and drawers, and you can change it for custom-made furniture.
- **Warnings** when something doesn't fit: a door hitting furniture, a blocked window, a covered switch, outlet or hookup, chairs without room, overlapping rooms.
- **Scenarios** to compare layouts of one room or the whole home (update the one in use or save a new one), plus **3 suggestions** made by the built-in engine or by **AI**, which put the TV stand at the TV outlet, the sink and washer at the water and drain, and the stove at the gas.
- **Undo and redo** (↶ ↷ at the top, or Ctrl+Z and Ctrl+Shift+Z), a **history** of every change and **restore points** that keep the whole home in the browser (automatic and your own) to go back to later.
- **Hide the furniture** (or doors and windows, air conditioners, hookups, names, floors and the grid) to work on what is underneath, a **tape measure** for any distance, and the **area** of each room, floor and home, with the free floor area.
- **Duplicate a room** with everything inside, **copy and paste** furniture and wall items, see a **summary with the furniture list** to copy, and **save the plan as an image** (PNG, or share it on a phone).
- Everything is **saved in your browser**; you can **export and import** a file. Light, dark or automatic theme.
- Works on **phones** and **computers**, in **Simple** or **Advanced** mode (properties panel, exact positions, locked furniture), in **Portuguese** and **English**.

## Free AI

Cabeaí has three ways to suggest layouts, all free:

1. **Automatic suggestions**: a rules engine that runs in the browser. Always available.
2. **Online AI** (`/api/ia`): uses the **free models of the Vercel AI Gateway**. On Vercel, authentication is automatic (OIDC), no key needed. If you prefer Google's **Gemini**, create a free key at [Google AI Studio](https://aistudio.google.com/apikey) and set `GOOGLE_GENERATIVE_AI_API_KEY`.
3. **Browser AI**: in desktop Google Chrome (recent versions with built-in Gemini Nano), the AI runs on the device itself and nothing is sent anywhere.

**Building the plan from a sketch photo** (`/api/planta`) needs an AI that reads images: set a free Gemini key in `GOOGLE_GENERATIVE_AI_API_KEY` (or pick an AI Gateway model with vision in `CABEAI_MODELO_VISAO`). Without it, the button says the photo AI isn't turned on, and you can still draw the plan in the app.

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
| `CABEAI_MODELO_VISAO` | AI Gateway model that reads images, for the sketch photo (Gemini with the key above is used first) |

Diagnostics: `/api/ia` shows whether the online AI is configured (and which models read images); `/api/ia?teste=1` asks it a tiny question.

## How the code is organized

```
app/            pages (Next.js App Router), styles, fonts and the /api/ia and /api/planta routes
components/     React UI (SVG floor plan, action bar, dock, panels, dialogs, menus)
  desenho/      to-scale drawing of rooms, floors and furniture (1 unit = 1 cm)
lib/            logic without UI: geometry, warnings, home, suggestions, AI, data, i18n
tests/          tests (Vitest)
```

- `lib/geometria.ts`: measurements, clearances, chairs, chests and the rule behind each warning.
- `lib/casa.ts`: rooms on the home plan, snapping, distances and doors on shared walls (the same door measured from either room).
- `lib/edicao.ts`: rotating, stretching and splitting rooms, the automatic doors of hallways and porches (where they go, near a corner, and when they go away), placing a door or window where a wall was tapped and cutting the wall between two rooms (part of it or all of it).
- `lib/montar.ts`: the step-by-step builder (the house on the plot, room templates, doors and windows for the whole house, furniture kits per room); `lib/jardim.ts`: the street, the path to the door and the garden trees.
- `lib/consultas.ts`: read-only queries over the data (rooms in order, neighbors that share a wall, open spaces).
- `lib/historico.ts`: undo and redo, the name of each change and the restore points.
- `lib/resumo.ts`: areas (m²), free floor and the home summary; `lib/exportar.ts`: the plan as a PNG image.
- `lib/planta.ts`: the sketch photo request and how the AI answer becomes rooms with shared walls.
- `lib/motor.ts`: the automatic suggestions.
- `lib/ia.ts`: the AI request and the checking of its answers.
- `lib/i18n.ts`: Portuguese and English (`tx('português', 'English')`).
- `lib/store.ts`: app state (Zustand) and every action that changes the home; the rest of `lib/` only computes.

## Privacy

No account, sign-up or tracking. The floor plan stays in the user's browser. Only when someone taps "Ask the AI" is that room's data sent to the chosen AI, and nothing is stored on the server.

## Support the project

Cabeaí is free and ad-free. If it helped you, you can support it:

- [GitHub Sponsors](https://github.com/sponsors/HerbertJulio)
- PIX (Brazil, e-mail key): hvcotta@gmail.com

Ideas and bug reports are welcome in the [issues](https://github.com/HerbertJulio/cabeai/issues).

## License

[MIT](LICENSE). Barlow and Barlow Condensed fonts under the [SIL Open Font License](app/fontes/OFL-Barlow.txt).
