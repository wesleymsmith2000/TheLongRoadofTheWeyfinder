# Relay Navigation Runtime

Version `v1.0.9.4` adds an engine-owned, partially observed route graph. Creator tools may
author the data, but validation, visibility, branch selection, history, relational scoring,
music mix derivation, and persistence are runtime responsibilities.

## Level field

A level may include an optional `navigationGraph`:

```json
{
  "navigationGraph": {
    "schemaVersion": "0.1",
    "assetId": "navigation.void_jump",
    "initialNode": "relay-a",
    "visibleHorizon": 2,
    "nodes": [
      { "id": "relay-a", "kind": "relay", "title": "Relay A" },
      {
        "id": "storm-road",
        "kind": "level",
        "levelId": "level.storm_road",
        "signals": { "threat": 0.8, "roadCoherence": 0.7 }
      },
      { "id": "helios", "kind": "boss", "destination": true, "tags": ["destination"] }
    ],
    "edges": [
      {
        "id": "take-storm-road",
        "from": "relay-a",
        "to": "storm-road",
        "preview": { "stability": "low" },
        "signals": { "alignment": 0.6 }
      },
      { "id": "reach-helios", "from": "storm-road", "to": "helios" }
    ]
  }
}
```

Edges are directed. Authors create return paths and loops with explicit reverse edges.
`preview` and `publicTags` are safe to expose to players. Hidden `signals` are never returned
by the normal fogged view.

Supported node kinds are `level`, `encounter`, `relay`, `hazard`, `station`, `puzzle`,
`boss`, `repair`, and `unknown`.

Supported relational axes are:

```text
alignment          -1..1
threat              0..1
clarity             0..1
fatePressure        0..1
roadCoherence       0..1
destinationSignal   0..1
recentTrend        -1..1
ambushRisk          0..1
```

When alignment or destination signal is not authored, the runtime derives a soft bearing
from directed shortest-path distance to destination-tagged nodes.

## Browser API

```js
WeyfinderNavigation.validate(definition)
WeyfinderNavigation.start(definition, { seed: 1147 })
WeyfinderNavigation.view()
WeyfinderNavigation.view({ revealHidden: true, includeHiddenState: true })
WeyfinderNavigation.chooseEdge(edgeId, { listenedBeforeChoosing: true })
WeyfinderNavigation.chooseNode(nodeId)
WeyfinderNavigation.updateSignals({ clarity: 0.8 })
WeyfinderNavigation.recordOutcome({ restoredAnchor: true })
```

Normal views contain the current node, the visible forward horizon, and legal outgoing
choices. Debug views may explicitly request hidden graph and score state.

Encounter `selectRouteBranch` effects also attempt to select a matching outgoing navigation
edge. Existing road branch state remains populated for backward compatibility.

## Music and saves

Navigation produces smoothed `baseFog`, `roadBearing`, `fatePressure`, `destinationEcho`,
`dangerLayer`, and `ambushLayer` targets. They are merged with combat music layers rather
than replacing them. Missing audio stems are harmless until art/audio assigns assets.

Save payloads preserve the current node, branch history, hidden axes, mix state, revision,
and RNG state. Lookup maps are rebuilt during hydration and are never serialized.
