---
name: agent-tool
description: Procedura pentru adăugarea unui tool nou dispecerului AI
---
Pentru orice tool nou al agentului:
1. Definiția tool-ului (name, description în engleză clară, input_schema JSON Schema) în server/src/agent/tools/
2. Handler-ul: primește input validat + companyId, returnează JSON compact (nu obiecte Prisma întregi — doar câmpurile necesare deciziei)
3. Înregistrare în registry-ul de tool-uri (fără modificarea loop-ului)
4. Adaugă 2 scenarii noi în .claude/skills/test-dispecer/scenarios.md
5. Rulează subagentul agent-tester
