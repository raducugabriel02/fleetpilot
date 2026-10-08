---
name: test-dispecer
description: Scenarii de test pentru agentul AI de dispecerat
---

Scenariile canonice sunt în scenarios.md din acest folder (prose, referință umană). Aceleași
scenarii sunt codificate cu assertii programatice în server/src/agent/eval/scenarios.ts — rulează
cu `npm run eval:agent` (din server/, cost real API Anthropic). La orice modificare a agentului,
rulează eval-ul automat; toate scenariile trebuie să treacă. Adaugă scenarii noi în AMBELE
fișiere (scenarios.md pentru lizibilitate, scenarios.ts pentru regresie automată), nu șterge din
cele vechi.
