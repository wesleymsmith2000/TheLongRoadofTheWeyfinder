# Example Prototype 0 Module Set

This folder is an importable creator content pack derived from the current bundled Prototype 0 content. It is namespaced with `example.*` ids so it can be loaded beside canon content without replacing canon assets.

Import it from the Creator Suite with **Import Folder** and select this folder:

```text
content/examples/prototype0-module-set
```

The pack manifest is:

```text
packs/example.prototype0_module_set.json
```

The set includes example constructs, weapons, enemy firing patterns, one status effect, enemy archetypes, one level, image resource descriptors for projectile sprites, and one placeholder sound resource descriptor for the level voiceover trigger. The placeholder sound descriptor demonstrates resource references; it does not include an actual audio file yet.

The weapon examples include Tracking Flechette, STA Missile, and Orb Of Blades JSON using the current runtime fields for orthogonal delayed launch, live-reticle arc tracking, contrails, emitted blade sprites, and blade projectile absorption.
