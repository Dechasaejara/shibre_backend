import { ConfigValueType, TransactionType } from '@prisma/client';

// Provider SMS rules and fixtures shared by seed.ts and the parser fixture tests.
export interface ParserFieldSeed {
  captureGroup: string;
  targetField: string;
  valueType: ConfigValueType;
  isRequired?: boolean;
  transform?: string;
}

export interface ParserExampleSeed {
  messageBody: string;
  expectedType?: TransactionType;
  expectedAmount?: string;
  expectedBalance?: string;
  expectedRef?: string;
  expectedCounterpartyName?: string;
  expectedCounterpartyPhone?: string;
}

export interface ParserRuleSeed {
  transactionType: TransactionType;
  pattern: string;
  priority: number;
  fields: ParserFieldSeed[];
  examples: ParserExampleSeed[];
}

export interface PaymentFieldSeed {
  key: string;
  label: string;
  valueType: ConfigValueType;
  sortOrder: number;
  isRequired?: boolean;
  validationPattern?: string;
}

export interface PaymentTemplateSeed {
  paymentType: string;
  template: string;
  instructions?: string;
  version: number;
  fields: PaymentFieldSeed[];
}

export interface ProviderSeed {
  code: string;
  displayName: string;
  aliases: string[];
  /** USSD code that opens the provider's balance inquiry; editable later in admin. */
  balanceUssd: string;
  parserRules: ParserRuleSeed[];
  paymentTemplates: PaymentTemplateSeed[];
}

export const BALANCE_CHECK = 'BALANCE_CHECK';

export function balanceTemplate(template: string): PaymentTemplateSeed {
  return {
    paymentType: BALANCE_CHECK,
    template,
    instructions: 'In the menu, choose the balance / My Account option. Enter your PIN only in the provider menu.',
    version: 1,
    fields: [],
  };
}

const stringValue = ConfigValueType.STRING;
const numberValue = ConfigValueType.NUMBER;
const dateTimeValue = ConfigValueType.DATETIME;

function field(
  captureGroup: string,
  targetField: string,
  valueType: ConfigValueType,
  options: { isRequired?: boolean; transform?: string } = {},
): ParserFieldSeed {
  return { captureGroup, targetField, valueType, ...options };
}

const amountField = (): ParserFieldSeed =>
  field('amount', 'amount', numberValue, {
    isRequired: true,
    transform: 'stripThousandsSeparators',
  });

const balanceField = (): ParserFieldSeed =>
  field('balance', 'currentBalance', numberValue, {
    transform: 'stripThousandsSeparators',
  });

const referenceField = (): ParserFieldSeed =>
  field('ref', 'reference', stringValue, { isRequired: true });

const transactionAtField = (): ParserFieldSeed =>
  field('transactionAt', 'transactionAt', dateTimeValue, {
    transform: 'parseProviderDateTime',
  });

export const providers: ProviderSeed[] = [
  {
    aliases: ['127'],
    balanceUssd: '*127#',
    code: 'telebirr',
    displayName: 'Telebirr',
    parserRules: [
      {
        transactionType: TransactionType.P2P_IN,
        priority: 10,
        pattern: String.raw`You have received ETB\s+(?<amount>[\d,.]+)\s+from\s+(?<counterpartyName>.+?)\s*\((?<counterpartyPhone>[^)]+)\)\s+on\s+(?<transactionAt>\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})\.\s+Your transaction number is\s+(?<ref>[A-Z0-9]+)\.\s+Your current E-Money Account\s+balance is ETB\s+(?<balance>[\d,.]+)`,
        fields: [
          amountField(),
          field('counterpartyName', 'counterpartyName', stringValue, {
            isRequired: true,
          }),
          field('counterpartyPhone', 'counterpartyPhone', stringValue),
          transactionAtField(),
          referenceField(),
          balanceField(),
        ],
        examples: [
          {
            expectedAmount: '1200.00',
            expectedBalance: '3515.55',
            expectedCounterpartyName: 'Negaye Fikadu',
            expectedCounterpartyPhone: '2519****8679',
            expectedRef: 'DIO33I3ZNV',
            expectedType: TransactionType.P2P_IN,
            messageBody:
              'Dear Dechasa You have received ETB 1,200.00 from Negaye Fikadu(2519****8679) on 24/09/2026 12:35:41. Your transaction number is DIO33I3ZNV. Your current E-Money Account balance is ETB 3,515.55. Thank you for using telebirr Ethio telecom',
          },
        ],
      },
      {
        transactionType: TransactionType.P2P_OUT,
        priority: 20,
        pattern: String.raw`You have transferred ETB\s+(?<amount>[\d,.]+)\s+to\s+(?<counterpartyName>.+?)\s+\((?<counterpartyPhone>[^)]+)\)\s+on\s+(?<transactionAt>\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})\.\s+Your transaction number is\s+(?<ref>[A-Z0-9]+)\..*?current E-Money Account\s+balance is ETB\s+(?<balance>[\d,.]+)`,
        fields: [
          amountField(),
          field('counterpartyName', 'counterpartyName', stringValue, {
            isRequired: true,
          }),
          field('counterpartyPhone', 'counterpartyPhone', stringValue),
          transactionAtField(),
          referenceField(),
          balanceField(),
        ],
        examples: [
          {
            expectedAmount: '1000.00',
            expectedBalance: '1063.55',
            expectedCounterpartyName: 'SAREM TEDELE',
            expectedCounterpartyPhone: '2519****5946',
            expectedRef: 'DIP64S9C94',
            expectedType: TransactionType.P2P_OUT,
            messageBody:
              'Dear Dechasa You have transferred ETB 1,000.00 to SAREM TEDELE (2519****5946) on 25/09/2026 15:13:41. Your transaction number is DIP64S9C94. The service fee is ETB 3.48 and 15% VAT on the service fee is ETB 0.52. Your current E-Money Account balance is ETB 1,063.55. Thank you for using telebirr Ethio telecom',
          },
        ],
      },
      {
        transactionType: TransactionType.AIRTIME,
        priority: 30,
        pattern: String.raw`You have paid ETB\s+(?<amount>[\d,.]+)\s+for package\s+(?<packageName>.+?)\s+purchase made for\s+(?<counterpartyPhone>\d+)\s+on\s+(?<transactionAt>\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})\.\s+Your transaction number is\s+(?<ref>[A-Z0-9]+)\.\s+Your current balance is ETB\s+(?<balance>[\d,.]+)`,
        fields: [
          amountField(),
          field('packageName', 'packageName', stringValue),
          field('counterpartyPhone', 'counterpartyPhone', stringValue),
          transactionAtField(),
          referenceField(),
          balanceField(),
        ],
        examples: [
          {
            expectedAmount: '50.00',
            expectedBalance: '2315.55',
            expectedCounterpartyPhone: '933913041',
            expectedRef: 'DIN12XPGW3',
            expectedType: TransactionType.AIRTIME,
            messageBody:
              'Dear Dechasa You have paid ETB 50.00 for package Voice Monthly for 150 Min +76 Min night package bonus purchase made for 933913041 on 23/09/2026 20:17:20. Your transaction number is DIN12XPGW3. Your current balance is ETB 2,315.55. Thank you for using telebirr Ethio telecom',
          },
        ],
      },
    ],
    paymentTemplates: [
      {
        paymentType: 'MERCHANT_PAY',
        // Provider no longer accepts one-shot codes; open the menu and guide the user.
        template: '*127#',
        instructions: 'Choose Pay Merchant, enter the merchant ID and amount, then confirm with your PIN in the menu.',
        version: 1,
        fields: [],
      },
    ],
  },
  {
    aliases: ['CBE_Birr', 'CBE'],
    balanceUssd: '*847#',
    code: 'cbe_birr',
    displayName: 'CBE Birr',
    parserRules: [
      {
        transactionType: TransactionType.P2P_OUT,
        priority: 10,
        pattern: String.raw`successfully transferred ETB\s?(?<amount>[\d,.]+)\s+from account\s+(?<fromAccount>\S+)\s+to account\s+(?<toAccount>\S+)\s+\((?<counterpartyName>[^)]+)\).*?current balance is ETB\s?(?<balance>[\d,.]+)`,
        fields: [
          amountField(),
          field('fromAccount', 'fromAccountMasked', stringValue),
          field('toAccount', 'toAccountMasked', stringValue),
          field('counterpartyName', 'counterpartyName', stringValue),
          balanceField(),
        ],
        examples: [
          {
            expectedAmount: '3200.00',
            expectedBalance: '13705.28',
            expectedCounterpartyName: 'Selam Nekir Moshe',
            expectedType: TransactionType.P2P_OUT,
            messageBody:
              'Dear Dechasa Ejara Gemeda You have successfully transferred ETB3200.00 from account 1********2026 to account 1********9597 (Selam Nekir Moshe). Service charge of ETB 1.00 and VAT(15%) of ETB0.15 and Disaster Recovery(5%) of 0.05 with total of ETB3201.20. Your current balance is ETB13,705.28. Thanks for Banking with CBE.',
          },
        ],
      },
      {
        transactionType: TransactionType.P2P_IN,
        priority: 20,
        pattern: String.raw`You have received ETB\s+(?<amount>[\d,.]+)\s+from account\s+(?<fromAccount>\S+)\s+\((?<counterpartyName>[^)]+)\)\s+to\s+your account\s+(?<toAccount>\S+)\.\s+Your current balance is ETB\s?(?<balance>[\d,.]+)`,
        fields: [
          amountField(),
          field('fromAccount', 'fromAccountMasked', stringValue),
          field('counterpartyName', 'counterpartyName', stringValue),
          field('toAccount', 'toAccountMasked', stringValue),
          balanceField(),
        ],
        examples: [
          {
            expectedAmount: '565.00',
            expectedBalance: '17907.09',
            expectedCounterpartyName: 'Hezkias Mesfin Semie',
            expectedType: TransactionType.P2P_IN,
            messageBody:
              'Dear Dechasa Ejara Gemeda You have received ETB 565.00 from account 1********1592 (Hezkias Mesfin Semie) to your account 1********2026. Your current balance is ETB17,907.09. Thanks for Banking with CBE.',
          },
        ],
      },
    ],
    paymentTemplates: [],
  },
  {
    // "ENAT BANK" is the sender observed on real devices.
    aliases: ['ENAT BANK', 'ENAT', 'EnatBank'],
    balanceUssd: '*845#',
    code: 'enat_bank',
    displayName: 'Enat Bank',
    parserRules: [
      {
        transactionType: TransactionType.P2P_OUT,
        priority: 10,
        pattern: String.raw`you have transferred\s+(?<amount>[\d,]+(?:\.\d+)?)\s*ETB\s+from your account\s+(?<fromAccount>\S+)\s+to\s+(?<counterpartyName>Telebirr)\s+No\.?\s*(?<counterpartyPhone>\d+)\.*\s*Ref\.?\s*No\.?\s*(?:is)?\s*:\s*(?<ref>[A-Z0-9]+)\.*\s*Date\s*:\s*(?<transactionAt>\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})(?:\s+through\s+(?<channel>[^.]+))?`,
        fields: [
          amountField(),
          field('fromAccount', 'fromAccountMasked', stringValue),
          field('counterpartyName', 'counterpartyName', stringValue),
          field('counterpartyPhone', 'counterpartyPhone', stringValue),
          referenceField(),
          transactionAtField(),
          field('channel', 'channel', stringValue),
        ],
        examples: [
          {
            expectedAmount: '5000.00',
            expectedCounterpartyName: 'Telebirr',
            expectedCounterpartyPhone: '933913041',
            expectedRef: '140TBTT262650001',
            expectedType: TransactionType.P2P_OUT,
            // Exact device text: note the double period after the reference.
            messageBody:
              'Dear DECHASA EJARA GEMED, you have transferred 5000.00 ETB from your account 14012XXX78413001 to Telebirr No 933913041. Ref. No: 140TBTT262650001.. Date: 22/09/2026 13:57:46 through MB. The Service Fee of ETB 5.00, VAT of ETB 0.75, and Disaster Fund of ETB 0.25 have been applied. Thank you for banking with ENAT.',
          },
          {
            expectedAmount: '5000.00',
            expectedCounterpartyName: 'Telebirr',
            expectedCounterpartyPhone: '933913041',
            expectedRef: '140TBTT262650001',
            expectedType: TransactionType.P2P_OUT,
            messageBody:
              'Dear DECHASA EJARA GEMED, you have transferred 5000.00 ETB from your account 14012XXX78413001 to Telebirr No 933913041. Ref. No: 140TBTT262650001. Date: 22/09/2026 13:57:46 through MB. The Service Fee of ETB 5.00, VAT of ETB 0.75, and Disaster Fund of ETB 0.25 have been applied. Thank you for banking with ENAT.',
          },
        ],
      },
      {
        transactionType: TransactionType.P2P_OUT,
        priority: 20,
        pattern: String.raw`you have transferred\s+(?<amount>[\d,]+(?:\.\d+)?)\s*ETB\s+from your account\s+(?<fromAccount>\S+)\s+to account\s+(?<toAccount>[^\s.]+)\.*\s*Ref\.?\s*No\.?\s*(?:is)?\s*:\s*(?<ref>[A-Z0-9]+)\.*\s*Date\s*:\s*(?<transactionAt>\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})(?:\s+through\s+(?<channel>[^.]+))?\.?(?:\s*Current Balance\s*:?\s*(?:ETB\s*)?(?<balance>[\d,]+(?:\.\d+)?))?`,
        fields: [
          amountField(),
          field('fromAccount', 'fromAccountMasked', stringValue),
          field('toAccount', 'toAccountMasked', stringValue),
          referenceField(),
          transactionAtField(),
          field('channel', 'channel', stringValue),
          balanceField(),
        ],
        examples: [
          {
            expectedAmount: '810.00',
            expectedBalance: '7523.39',
            expectedRef: '140ATAS262650010',
            expectedType: TransactionType.P2P_OUT,
            messageBody:
              'Dear DECHASA EJARA GEMED, you have transferred 810 ETB from your account 14012XXX78413001 to account 013XXXXXXXXXX00. Ref. No is: 140ATAS262650010 Date: 22/09/2026 17:00:59 through ENAT USSD. Current Balance 7523.39. Thank you for banking with ENAT.',
          },
        ],
      },
      {
        transactionType: TransactionType.AIRTIME,
        priority: 30,
        pattern: String.raw`Mobile recharge of amount\s+(?<amount>[\d,]+(?:\.\d+)?)\s*ETB\s+is done to (?:a )?number\s+(?<counterpartyPhone>\d+),?\s*Recharge Ref\s*:\s*(?<ref>[A-Z0-9]+)\s*Date\s*:\s*(?<transactionAt>\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})`,
        fields: [
          amountField(),
          field('counterpartyPhone', 'counterpartyPhone', stringValue),
          referenceField(),
          transactionAtField(),
        ],
        examples: [
          {
            expectedAmount: '50.00',
            expectedCounterpartyPhone: '777404324',
            expectedRef: '7104166',
            expectedType: TransactionType.AIRTIME,
            messageBody:
              'Dear customer, Mobile recharge of amount 50.00 ETB is done to a number 777404324, Recharge Ref : 7104166 Date : 22/09/2026 19:37:19',
          },
        ],
      },
      {
        transactionType: TransactionType.P2P_IN,
        priority: 40,
        pattern: String.raw`Your account\s+(?<toAccount>\S+)\s+has been credited with\s+(?<amount>[\d,]+(?:\.\d+)?)\s*ETB\.?\s+Your current balance is\s+(?<balance>[\d,]+(?:\.\d+)?)\s*ETB\.?(?:\s*(?<transactionAt>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}))?`,
        fields: [
          field('toAccount', 'toAccountMasked', stringValue),
          amountField(),
          balanceField(),
          transactionAtField(),
        ],
        examples: [
          {
            expectedAmount: '47000.00',
            expectedBalance: '47384.48',
            expectedType: TransactionType.P2P_IN,
            messageBody:
              'Dear Customer, Your account 1401******78413001 has been credited with 47,000.00 ETB. Your current balance is 47,384.48 ETB. 2026-09-09  16:30:32 Man Ende Enat!',
          },
        ],
      },
    ],
    paymentTemplates: [],
  },
  {
    aliases: ['AwashBank'],
    balanceUssd: '*901#',
    code: 'awash_bank',
    displayName: 'Awash Bank',
    parserRules: [],
    paymentTemplates: [],
  },
  {
    aliases: ['Dashen_Bank'],
    balanceUssd: '*721#',
    code: 'dashen_bank',
    displayName: 'Dashen Bank',
    parserRules: [],
    paymentTemplates: [],
  },
  {
    aliases: ['Abyssinia'],
    balanceUssd: '*815#',
    code: 'bank_of_abyssinia',
    displayName: 'Bank of Abyssinia',
    parserRules: [],
    paymentTemplates: [],
  },
];
