export interface CheckResult {
  label: string;
  passed: boolean;
  detail?: string;
}

// colectează toate assertiile unui scenariu, fără să se oprească la primul fail —
// raportul final trebuie să arate TOT ce s-a stricat, nu doar primul lucru găsit
export class Checklist {
  readonly results: CheckResult[] = [];

  check(label: string, passed: boolean, detail?: string): void {
    this.results.push({ label, passed, detail });
  }

  get allPassed(): boolean {
    return this.results.length > 0 && this.results.every((r) => r.passed);
  }
}
