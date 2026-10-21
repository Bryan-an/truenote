# truenote

A guitar tuner for the phone, built as an installable web app (PWA) that works offline.

Play a string and truenote detects which one it is, lights it up on a guitar headstock, and shows on an arc needle how far it is from the right pitch. When the string is in tune, it plays a short ding. Version 1 supports a six-string guitar in standard tuning (E A D G B E).

## Documents

- [Design spec](docs/superpowers/specs/2026-10-21-truenote-tuner-design.md): what v1 does and why.
- [Implementation plan](docs/superpowers/plans/2026-10-21-truenote-v1.md): the steps that build it.

## Running it locally

You need [nvm](https://github.com/nvm-sh/nvm) and Node's Corepack, which provides the pinned pnpm version.

```sh
nvm use        # Node 24.18.0, from .nvmrc
pnpm install
pnpm dev       # http://localhost:5173
```

The first `pnpm` command asks Corepack to download pnpm 11.28.6; answer yes.

The other scripts (build, type check and the rest) are listed in `package.json`.
