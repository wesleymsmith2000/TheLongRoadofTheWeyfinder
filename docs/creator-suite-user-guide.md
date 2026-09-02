# Creator Suite User Guide

Date: 2026-09-02

The Creator Suite is available from:

```text
tools/creator-suite.html
```

The user-facing tutorial page is:

```text
tools/creator-guide.html
```

## Basic Workflow

1. Open the Creator Suite.
2. Click `Install Example` and `Install Zone Enemies` to load sample packs into browser-local storage.
3. Use `Mob / Construct` to load and edit construct bodies.
4. Use `Enemies` to assign constructs, firing patterns, movement profiles, aggregate behavior, and cell animations.
5. Use `Projectile / Weapon / Pattern` to tune weapon and projectile JSON.
6. Use `Levels` to assemble route, background, wave, obstacle, and trigger descriptors.
7. Download JSON assets or import/export module folders through the suite.

## Construct Loading

The Construct Workshop now has a `Load Construct` dropdown.

It lists:

- bundled runtime constructs
- sculpted zone enemy example constructs
- constructs installed into the browser-local module library

Use `Refresh Local` after importing a new pack if the Construct Workshop is already open. Loading a construct copies it into the editor, so changing the asset id before downloading is the safest way to make a variant.

## Current Limits

Editor-authored constructs, enemy archetypes, patterns, weapons, levels, and resources can be validated and packaged now. The gameplay runner still needs small runtime adapters before every advanced descriptor field becomes active behavior.

