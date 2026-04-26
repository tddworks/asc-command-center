import { describe, it, expect, vi } from 'vitest';
import {
  type LocalizationAIService,
  setLocalizationAIService,
  getLocalizationAIService,
  resetLocalizationAIService,
} from '../../src/monetization/AILocalizationService.ts';

describe('LocalizationAIService registry', () => {

  it('returns null when no service has been registered', () => {
    resetLocalizationAIService();
    expect(getLocalizationAIService()).toBeNull();
  });

  it('returns the registered service after setLocalizationAIService', () => {
    const service: LocalizationAIService = {
      translate: vi.fn().mockResolvedValue('translated'),
    };
    setLocalizationAIService(service);
    expect(getLocalizationAIService()).toBe(service);
  });

  it('reset clears the registered service', () => {
    setLocalizationAIService({ translate: vi.fn().mockResolvedValue('x') });
    resetLocalizationAIService();
    expect(getLocalizationAIService()).toBeNull();
  });
});
