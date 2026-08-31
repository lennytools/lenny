export const RISK_TRIGGER_PATTERNS = [
  ['authentication or authorization', /(?:password|jwt|api[-_ ]?key|access[-_ ]?control)|(^|[\/_.-])(auth|oauth|login|session|permission|rbac|acl)([\/_.-]|$)/],
  ['secrets or credentials', /(secret|credential|private[-_ ]?key|token[-_ ]?store|vault)/],
  ['money, orders or custody', /(payment|billing|wallet|custody|broker|trading|trade|order|position|withdraw|deposit)/],
  ['data migration or destructive persistence', /(migration|schema|database|delete|truncate|drop[-_ ]table|backfill)/],
  ['production infrastructure or deployment', /(deploy|production|terraform|kubernetes|k8s|helm|cloudformation|infra)/],
  ['installer or package supply chain', /(^|[\/_.-])(install|installer|uninstall|update|upgrade|release|publish|package)([\/_.-]|$)/],
  ['security-sensitive behavior', /(security|crypto|encrypt|decrypt|signature|sandbox|injection)/],
];

export function evaluateRisk({ files = [], description = '', forceHigh = false }) {
  const haystack = [...files, description].join('\n').toLowerCase();
  const triggers = RISK_TRIGGER_PATTERNS
    .filter(([, pattern]) => pattern.test(haystack))
    .map(([label]) => label);
  if (forceHigh) triggers.unshift('explicit high-stakes override');
  return { riskClass: triggers.length ? 'high-stakes' : 'standard', triggers };
}

export function requiredCouncilsForRisk() {
  return ['software-implementation'];
}
