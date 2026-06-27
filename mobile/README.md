# DMRC Assistant — Mobile (Expo)

A fully self-contained chat app — no backend required to run it. See the
top-level `../README.md` for the full picture of what's real vs. stubbed.

## Run it

```bash
npm install
npx expo start
```

Then either:
- Scan the QR code with the **Expo Go** app on your phone, or
- Press `w` in the terminal for a web preview, or
- Open this folder in [Snack](https://snack.expo.dev) (Snack supports
  multi-file projects — paste in `App.tsx` and the `src/` folder).

## Try it

- "Rajiv Chowk to Kashmere Gate"
- "Dwarka Sector 21 se Noida Electronic City jana hai"
- "Last metro from Huda City Centre"
- "Gates at Hauz Khas"
- "Is Rajiv Chowk an interchange?"

## Run the regression test

```bash
npm install --no-save typescript ts-node @types/node
npx ts-node --project tests/tsconfig.json tests/engine.test.ts
```

## Connecting to the backend (optional)

Right now the app answers entirely from bundled data — fast and works
offline. If you deploy `../backend` and want persisted chat history,
wire `src/lib/chatEngine.ts`'s `getChatReply` calls up to a `fetch()`
against your deployed `/api/chat` endpoint instead (or alongside it as a
fallback when offline).
