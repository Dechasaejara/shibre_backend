import { providers } from '../../prisma/provider-seeds';
import { evaluateRule, type EvaluableRule } from './rule-evaluator';

function toRule(seed: (typeof providers)[number]['parserRules'][number]): EvaluableRule {
  return {
    pattern: seed.pattern,
    transactionType: seed.transactionType,
    fieldMappings: seed.fields.map((field) => ({
      captureGroup: field.captureGroup,
      targetField: field.targetField,
      valueType: field.valueType,
      transform: field.transform ?? null,
      isRequired: field.isRequired ?? false,
    })),
  };
}

const cases = providers.flatMap((provider) =>
  provider.parserRules.flatMap((rule, ruleIndex) =>
    rule.examples.map((example, exampleIndex) => ({
      label: `${provider.code} rule ${ruleIndex + 1} example ${exampleIndex + 1}`,
      provider,
      rule,
      example,
    })),
  ),
);

describe('seeded message templates parse their real-device examples', () => {
  it.each(cases)('$label', ({ provider, rule, example }) => {
    const evaluation = evaluateRule(toRule(rule), example.messageBody);
    expect(evaluation.failure).toBeNull();
    if (example.expectedAmount) expect(evaluation.amount).toBe(example.expectedAmount);
    if (example.expectedBalance) expect(evaluation.currentBalance).toBe(example.expectedBalance);
    if (example.expectedRef) expect(evaluation.reference).toBe(example.expectedRef);
    if (example.expectedCounterpartyName) expect(evaluation.counterpartyName).toBe(example.expectedCounterpartyName);
    if (example.expectedCounterpartyPhone) expect(evaluation.counterpartyPhone).toBe(example.expectedCounterpartyPhone);

    // Production picks the first matching rule by priority, so no earlier rule may claim this example.
    const winner = [...provider.parserRules]
      .sort((a, b) => a.priority - b.priority)
      .find((candidate) => !evaluateRule(toRule(candidate), example.messageBody).failure);
    expect(winner).toBe(rule);
  });

  it('reads provider times as East Africa Time', () => {
    const enatTransfer = cases.find((item) => item.example.expectedRef === '140ATAS262650010');
    expect(enatTransfer).toBeDefined();
    const evaluation = evaluateRule(toRule(enatTransfer!.rule), enatTransfer!.example.messageBody);
    expect(evaluation.transactionAt?.toISOString()).toBe('2026-09-22T14:00:59.000Z');
  });
});
