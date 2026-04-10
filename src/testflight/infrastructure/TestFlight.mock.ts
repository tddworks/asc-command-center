import { BetaGroup } from '../BetaGroup.ts';

export function mockBetaGroups(appId: string): BetaGroup[] {
  return [
    new BetaGroup('g-1', appId, 'App Store Connect Users', true, false, undefined, {
      listTesters: `asc testflight testers list --group-id g-1`,
    }),
    new BetaGroup('g-2', appId, 'External Beta Testers', false, true, 'https://testflight.apple.com/join/abc123', {
      addTester: `asc testflight testers add --group-id g-2 --email test@example.com`,
      listTesters: `asc testflight testers list --group-id g-2`,
    }),
    new BetaGroup('g-3', appId, 'QA Team', false, false, undefined, {
      addTester: `asc testflight testers add --group-id g-3 --email test@example.com`,
      listTesters: `asc testflight testers list --group-id g-3`,
    }),
  ];
}
