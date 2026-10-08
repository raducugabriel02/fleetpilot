import { prisma } from '../../lib/prisma';
import { evalScenarios } from './scenarios';

/*
 * Eval set automat pentru dispecerul AI — rulează scenariile din
 * .claude/skills/test-dispecer/scenarios.md cu assertii programatice (tool-uri chemate,
 * câmpuri din draft, izolare multi-tenant, invariantul "nicio scriere fără aprobare umană"),
 * nu text judecat cu ochiul. Fiecare scenariu își creează și șterge propria firmă izolată.
 *
 * Cost real: fiecare rulare face ~11 apeluri reale la Anthropic API — rulează la cerere,
 * nu la fiecare commit. Comandă: npm run eval:agent (din server/).
 */

async function main(): Promise<void> {
  console.log(`Eval agent — ${evalScenarios.length} scenarii (cost real API Anthropic)\n`);

  let checksPassed = 0;
  let checksFailed = 0;
  const failedScenarioIds: string[] = [];

  for (const scenario of evalScenarios) {
    const checklist = await scenario.run();
    const ok = checklist.allPassed;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${scenario.id} — ${scenario.title}`);
    if (!ok) failedScenarioIds.push(scenario.id);
    for (const result of checklist.results) {
      const mark = result.passed ? 'ok' : 'FAIL';
      console.log(`    [${mark}] ${result.label}${result.detail ? ` — ${result.detail}` : ''}`);
      if (result.passed) checksPassed++;
      else checksFailed++;
    }
  }

  console.log(`\n${checksPassed} verificări trecute, ${checksFailed} picate.`);
  if (failedScenarioIds.length > 0) {
    console.log(`Scenarii picate: ${failedScenarioIds.join(', ')}`);
  }
  process.exitCode = checksFailed === 0 ? 0 : 1;
}

main()
  .catch((err: unknown) => {
    console.error('Eval-ul a crăpat:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
