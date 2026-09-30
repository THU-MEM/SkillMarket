# Optional people module

Reserved location for separately authored expressions and poses. The core kit does not require or import this directory, and currently supports `neutral`, `talk`, `think`, `celebrate` through `asset('person', {pose})`.

Keep incoming modules self-contained, with their own provenance/license notices and tests. Do not silently overwrite `src/assets.mjs` or claim new poses are core API values without updating validation and browser tests. Static SVG assets placed here can already be used as `type: "image"`, with `src: "assets/people/<name>.svg"` and explicit width/height.
