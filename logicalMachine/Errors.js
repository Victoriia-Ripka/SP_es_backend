const ERROR_FACT_NAME_ABSENT = 'Fact name cannot be absent';
const ERROR_FACT_NAME_EMPTY  = 'Fact name cannot be empty';
const ERROR_FACT_VALUE_ABSENT = 'Fact value cannot be absent';

const ERROR_RULE_CONDITION_EMPTY = 'Rule condition cannot be empty';
const ERROR_RULE_FACT_NAME_EMPTY = 'Fact name cannot be empty';
const ERROR_RULE_FACT_NAME_HAS_SPACES = 'Fact name cannot contain spaces';
const ERROR_RULE_FACT_VALUE_EMPTY = 'Fact value cannot be empty';
const ERROR_RULE_ELSE_FACT_NAME_HAS_SPACES = 'factValueElse cannot contain spaces';
const ERROR_RULE_ELSE_FACT_NAME_ABSENT = 'If you use factValueElse you have to fill factNameElse';
const ERROR_RULE_ELSE_FACT_VALUE_ABSENT = 'If you use factNameElse you have to fill factValueElse';
const ERROR_RULE_STRING_NO_QUOTE = "there is no ' to close string value";
const ERROR_RULE_PARENTHESES_1 = 'parentheses mismatched (1)';
const ERROR_RULE_PARENTHESES_2 = 'parentheses mismatched (2)';

const ERROR_STUGNA_SPACE_IN_FACT_NAME = 'Try to add fact with spaces in name: ';
const ERROR_STUGNA_PERIODIC_RULES = 'Periodic rules detected';

export {
  ERROR_FACT_NAME_ABSENT,
  ERROR_FACT_NAME_EMPTY,
  ERROR_FACT_VALUE_ABSENT,

  ERROR_RULE_CONDITION_EMPTY,
  ERROR_RULE_FACT_NAME_EMPTY,
  ERROR_RULE_FACT_NAME_HAS_SPACES,
  ERROR_RULE_FACT_VALUE_EMPTY,
  ERROR_RULE_ELSE_FACT_NAME_HAS_SPACES,
  ERROR_RULE_ELSE_FACT_NAME_ABSENT,
  ERROR_RULE_ELSE_FACT_VALUE_ABSENT,
  ERROR_RULE_STRING_NO_QUOTE,
  ERROR_RULE_PARENTHESES_1,
  ERROR_RULE_PARENTHESES_2,

  ERROR_STUGNA_SPACE_IN_FACT_NAME,
  ERROR_STUGNA_PERIODIC_RULES
}