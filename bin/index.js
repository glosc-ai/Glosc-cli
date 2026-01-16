#!/usr/bin/env node

"use strict";

try {
    require("../dist/index");
} catch (err) {
    console.error(
        "Failed to load compiled CLI from dist/. Run `npm run build` first."
    );
    throw err;
}
