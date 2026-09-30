import { ConfigValueType, TransactionDirection, TransactionType } from '@prisma/client';

export interface EvaluableFieldMapping {
  captureGroup: string;
  targetField: string;
  valueType: ConfigValueType;
  transform: string | null;
  isRequired: boolean;
}

export interface EvaluableRule {
  pattern: string;
  transactionType: TransactionType;
  fieldMappings: EvaluableFieldMapping[];
}

export interface RuleEvaluation {
  matched: boolean;
  /** Why the rule did not produce a transaction; null when it did. */
  failure: string | null;
  groups: Record<string, string>;
  transactionType: TransactionType;
  direction: TransactionDirection;
  amount?: string;
  counterpartyName?: string;
  counterpartyPhone?: string;
  currentBalance?: string;
  reference?: string;
  transactionAt?: Date;
  additionalFields: Record<string, string>;
}

export function directionFor(type: TransactionType): TransactionDirection {
  return type === TransactionType.P2P_IN ? TransactionDirection.INFLOW : TransactionDirection.OUTFLOW;
}

/** Comparable sender key: "ENAT BANK", "Enat_Bank" and "EnatBank" all become "enatbank". */
export function senderKey(senderId: string): string {
  return senderId.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normalizeDecimal(value: string): string {
  const match = /^\d+(?:\.\d+)?/.exec(value.replaceAll(',', '').trim());
  return match ? Number(match[0]).toFixed(2) : '0.00';
}

/** Provider times are East Africa Time (UTC+3) wall-clock values. */
export function parseProviderDateTime(value: string): Date {
  const normalized = value.trim();
  const dayFirst = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})$/.exec(normalized);
  if (dayFirst) {
    const [, day, month, year, time] = dayFirst;
    return new Date(`${year}-${month}-${day}T${time}.000+03:00`);
  }
  const isoLike = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2}:\d{2})$/.exec(normalized);
  if (isoLike) {
    const [, year, month, day, time] = isoLike;
    return new Date(`${year}-${month}-${day}T${time}.000+03:00`);
  }
  return new Date(normalized);
}

function transformValue(value: string, valueType: ConfigValueType, transform: string | null): string {
  if (transform === 'stripThousandsSeparators' || valueType === ConfigValueType.NUMBER) return normalizeDecimal(value);
  if (transform === 'parseProviderDateTime' || valueType === ConfigValueType.DATETIME) {
    const date = parseProviderDateTime(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  return value;
}

export function compileRulePattern(pattern: string): RegExp {
  return new RegExp(pattern, 'is');
}

/** Runs one parser rule against a message exactly as production parsing does. */
export function evaluateRule(rule: EvaluableRule, messageBody: string): RuleEvaluation {
  const base: RuleEvaluation = {
    matched: false,
    failure: null,
    groups: {},
    transactionType: rule.transactionType,
    direction: directionFor(rule.transactionType),
    additionalFields: {},
  };

  let regex: RegExp;
  try {
    regex = compileRulePattern(rule.pattern);
  } catch {
    return { ...base, failure: 'Pattern is not a valid regular expression' };
  }

  const match = regex.exec(messageBody);
  if (!match) return { ...base, failure: 'Pattern did not match the message' };

  const groups = Object.fromEntries(
    Object.entries(match.groups ?? {}).flatMap(([key, value]) => (value === undefined ? [] : [[key, value.trim()]])),
  );
  const result: RuleEvaluation = { ...base, matched: true, groups };

  for (const mapping of rule.fieldMappings) {
    const raw = groups[mapping.captureGroup];
    if (!raw) {
      if (mapping.isRequired) return { ...result, failure: `Required group "${mapping.captureGroup}" is empty` };
      continue;
    }
    const value = transformValue(raw, mapping.valueType, mapping.transform);
    switch (mapping.targetField) {
      case 'amount':
        result.amount = value;
        break;
      case 'counterpartyName':
        result.counterpartyName = value;
        break;
      case 'counterpartyPhone':
        result.counterpartyPhone = value;
        break;
      case 'currentBalance':
        result.currentBalance = value;
        break;
      case 'reference':
        result.reference = value;
        break;
      case 'transactionAt': {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) result.transactionAt = date;
        break;
      }
      default:
        result.additionalFields[mapping.targetField] = value;
    }
  }

  if (!result.amount || Number(result.amount) <= 0) {
    return { ...result, failure: 'No amount was mapped (map a capture group to "amount")' };
  }
  return result;
}
