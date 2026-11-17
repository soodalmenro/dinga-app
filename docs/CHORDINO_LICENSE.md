# Chordino integration and source distribution

This hotfix distributes the combined Dinga application **code** under GPL-3.0-or-later. chordino.js 0.6.0 itself remains GPL-2.0-or-later; choosing GPLv3 for the combined work does not replace its upstream notices. Existing artwork, icons, fonts, models and other third-party components retain their own copyright and license terms. This document makes no blanket claim that those assets have been relicensed.

## Exact upstream version

- npm package: `chordino.js@0.6.0`.
- npm `gitHead`: `ea8e2110fa2197a662588ef1f2db2550d93cc90d`, verified with `npm view chordino.js@0.6.0 version gitHead repository dist --json`.
- Official source: https://codeload.github.com/recifra/chordino.js/zip/ea8e2110fa2197a662588ef1f2db2550d93cc90d
- Vendored copy: `public/licenses/chordino-0.6.0-source.zip`.
- ZIP SHA-256: `e9139f5ac4d2a6c74abbfea5d3de203fb32393f429a4ec4b62d46e90f64429ff`.
- Published npm integrity: `sha512-TYzoQoONeIsdKuv550V/MisRm4/5Od1qS5pGDRFd4eOmtiZDH2iJyRpN9cP05tJYf/g9Nu1bFr9smE2NKtnapA==`.

The npm package alone contains generated JavaScript/WASM and notices; it does not contain the preferred C/TypeScript source. The pinned upstream ZIP contains the C implementation, TypeScript workers and AudioWorklet, `src/build.sh`, `BUILD.md`, package lock, and the KISS FFT, NNLS Chroma and Vamp SDK notices. Its CI pins Emscripten 6.0.3. No upstream algorithm changes are asserted by this hotfix; Dinga integration changes are in the accompanying application source.

## Recipient-facing downloads

Serve `/licenses/` beside the app, without a GitHub login or extra charge:

- `/licenses/dinga-corresponding-source.zip`: current Dinga source, build configuration, lockfile, publicly shipped asset inputs, this packaging script, notices, and the exact upstream source ZIP.
- `/licenses/source-manifest.json`: SHA-256 inventory of the source inputs and compiled app files for this deployment, plus archive checksum.
- `/licenses/chordino-0.6.0-source.zip`: independently downloadable unmodified upstream source.
- `/licenses/GPL-3.0.txt`: combined application code license.
- `/licenses/GPL-2.0.txt`: original Chordino license text.
- `/licenses/THIRD_PARTY_NOTICES.txt`: component attribution and original BSD-style notices.

The application should expose an accessible link to this page. Keeping the development GitHub repository private does not prevent supplying recipients with this separate source download. The download provides source to the browser app's recipients; it does not change GitHub repository visibility.

## Build and package the matching release

Run after the final source changes and before deployment:

```sh
npm ci
npm run build
node scripts/prepare-source.mjs
node scripts/prepare-source.mjs --verify
```

Deploy the resulting `dist` directory. The script copies all license/source artifacts into `dist/licenses` after packaging. Run the same sequence again after any source or build changes. Do not rebuild between packaging and deployment without regenerating and verifying the source package. A single-file build is not a substitute for serving the complete `/licenses/` directory.

ZIP reading/writing uses pinned build-only fflate0.8.3 (MIT) in Node. No Windows bsdtar/Linux GNU tar/zip program is required. `node qa/source-package-portable.cjs` verifies packaging with native process-based archivers unavailable. This avoids the first Vercel failure where GNU tar could not read the upstream ZIP; the browser bundle is unchanged.

The script only reads this hotfix checkout. It allowlists root build files, `src`, public deployment inputs and `scripts`; includes only this document from `docs`; and excludes Git metadata, environment files, QA/evaluation material, dependency installations, credential names, private-key files and generated archive recursion. It rejects symlinks. It does not read the original working repository or publish remotely. Do not place secrets in public application code: all `src` and `public` files are distribution inputs.

Rebuilding Dinga uses Node 20.19+ or 22.12+, `npm ci`, then `npm run build`. To rebuild upstream Chordino independently, extract its ZIP and follow its included `BUILD.md`: use Emscripten 6.0.3, install the locked npm dependencies and run `npm run build`. Generated upstream binaries are installed at the exact published npm version for this app build.

## Basis and limits

The GNU GPL v3 sections 4–6 address preserving notices, licensing modified covered works and providing Corresponding Source when conveying object code. Section 6(d) describes network downloads with equivalent source access. The GPL v2 section 3 has its own equivalent-access provision; GPL v2 section 9 permits choosing a later version when upstream grants “or later.” Browser JavaScript/WASM is downloaded to recipients, so this release supplies source alongside it rather than relying on a private repository or merely naming npm.

Primary references:

- GNU GPL v3: https://www.gnu.org/licenses/gpl-3.0.html
- GNU GPL v2: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
- FSF FAQ, equivalent download access: https://www.gnu.org/licenses/gpl-faq.html#DoesTheGPLAllowDownloadFee
- FSF FAQ, GPL-covered JavaScript: https://www.gnu.org/licenses/gpl-faq.html#Javascript
- Upstream license and credits: https://github.com/recifra/chordino.js/tree/ea8e2110fa2197a662588ef1f2db2550d93cc90d

This mechanism records concrete source and license artifacts. It is not a legal opinion or a claim that every pre-existing third-party asset's provenance has been audited. Keep component notices and independently check redistribution rights for assets. The software is supplied without warranty under its applicable licenses; source availability does not establish recognition accuracy.
