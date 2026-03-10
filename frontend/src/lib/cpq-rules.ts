import type { CPQRule, ExcludeRule, MarketModel, RuleSelection } from './cpq-data';

export interface RuleConflict {
  ruleId: string;
  ruleName: string;
  type: 'exclude';
  items: RuleSelection[];
}

export interface RuleRepairSuggestion {
  category_code: string;
  from_option_code: string;
  to_option_code?: string;
  reason: string;
}

export interface ConstraintAnalysis {
  availableOptions: Record<string, string[]>;
  disabledReasons: Record<string, Record<string, string[]>>;
  activeEnableRuleIds: string[];
  conflicts: RuleConflict[];
  invalidSelectedCategories: string[];
  repairSuggestions: RuleRepairSuggestion[];
}

function toCategoryOptionIndex(model: MarketModel): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const group of model.configuration_groups) {
    if (group.hide) continue;
    for (const category of group.categories) {
      if (category.hide) continue;
      result[category.category_code] = category.options
        .filter(option => !option.hide)
        .map(option => option.option_code);
    }
  }
  return result;
}

function addDisabledReason(
  disabledReasons: ConstraintAnalysis['disabledReasons'],
  categoryCode: string,
  optionCode: string,
  reason: string
): void {
  if (!disabledReasons[categoryCode]) {
    disabledReasons[categoryCode] = {};
  }
  if (!disabledReasons[categoryCode][optionCode]) {
    disabledReasons[categoryCode][optionCode] = [];
  }
  if (!disabledReasons[categoryCode][optionCode].includes(reason)) {
    disabledReasons[categoryCode][optionCode].push(reason);
  }
}

function isEnableRuleActive(rule: CPQRule, selections: Record<string, string>): boolean {
  if (rule.type !== 'enable') return false;
  return rule.when.every(cond => selections[cond.category_code] === cond.option_code);
}

function isExcludeRuleConflict(rule: ExcludeRule, selections: Record<string, string>): boolean {
  return rule.items.every(item => selections[item.category_code] === item.option_code);
}

function getRulePriority(rule: CPQRule): number {
  return rule.priority ?? 100;
}

export function analyzeConstraints(
  model: MarketModel,
  selections: Record<string, string>,
  customCategoryCodes: Set<string>
): ConstraintAnalysis {
  const availableIndex = toCategoryOptionIndex(model);
  const working: Record<string, Set<string>> = {};
  const disabledReasons: ConstraintAnalysis['disabledReasons'] = {};

  Object.entries(availableIndex).forEach(([categoryCode, options]) => {
    working[categoryCode] = new Set(options);
  });

  const activeEnableRuleIds: string[] = [];
  const conflicts: RuleConflict[] = [];

  const rules = [...model.rules]
    .filter(rule => rule.enabled !== false)
    .sort((a, b) => getRulePriority(a) - getRulePriority(b));

  for (const rule of rules) {
    if (rule.type === 'enable') {
      if (!isEnableRuleActive(rule, selections)) continue;
      activeEnableRuleIds.push(rule.id);

      for (const effect of rule.then) {
        const allowedSet = new Set(effect.allowed_option_codes);
        const categorySet = working[effect.category_code];
        if (!categorySet) continue;

        for (const option of [...categorySet]) {
          if (!allowedSet.has(option)) {
            categorySet.delete(option);
            addDisabledReason(disabledReasons, effect.category_code, option, `受启用规则[${rule.name}]限制`);
          }
        }
      }
      continue;
    }

    if (isExcludeRuleConflict(rule, selections)) {
      conflicts.push({
        ruleId: rule.id,
        ruleName: rule.name,
        type: 'exclude',
        items: rule.items,
      });
    }
  }

  const invalidSelectedCategories: string[] = [];

  Object.entries(selections).forEach(([categoryCode, optionCode]) => {
    if (customCategoryCodes.has(categoryCode)) return;
    const categorySet = working[categoryCode];
    if (!categorySet) return;
    if (!categorySet.has(optionCode)) {
      invalidSelectedCategories.push(categoryCode);
      addDisabledReason(disabledReasons, categoryCode, optionCode, '当前选中值不满足已触发规则');
    }
  });

  const repairSuggestions: RuleRepairSuggestion[] = [];

  for (const conflict of conflicts) {
    for (const item of conflict.items) {
      const categoryOptions = availableIndex[item.category_code] || [];
      const candidate = categoryOptions.find(option => option !== item.option_code);
      repairSuggestions.push({
        category_code: item.category_code,
        from_option_code: item.option_code,
        to_option_code: candidate,
        reason: `排除规则[${conflict.ruleName}]不允许该组合`,
      });
    }
  }

  for (const categoryCode of invalidSelectedCategories) {
    const available = [...(working[categoryCode] || [])];
    if (available.length > 0) {
      repairSuggestions.push({
        category_code: categoryCode,
        from_option_code: selections[categoryCode],
        to_option_code: available[0],
        reason: '推荐切换到规则允许的选项',
      });
    }
  }

  return {
    availableOptions: Object.fromEntries(
      Object.entries(working).map(([categoryCode, set]) => [categoryCode, [...set]])
    ),
    disabledReasons,
    activeEnableRuleIds,
    conflicts,
    invalidSelectedCategories,
    repairSuggestions,
  };
}

export function repairSelectionsByRules(
  model: MarketModel,
  originalSelections: Record<string, string>,
  customCategoryCodes: Set<string>,
  preferredCategoryCode?: string
): { selections: Record<string, string>; analysis: ConstraintAnalysis } {
  const selections = { ...originalSelections };

  for (let i = 0; i < 6; i++) {
    const analysis = analyzeConstraints(model, selections, customCategoryCodes);
    if (analysis.invalidSelectedCategories.length === 0 && analysis.conflicts.length === 0) {
      return { selections, analysis };
    }

    let changed = false;

    for (const categoryCode of analysis.invalidSelectedCategories) {
      const available = analysis.availableOptions[categoryCode] || [];
      if (available.length > 0) {
        selections[categoryCode] = available[0];
      } else {
        delete selections[categoryCode];
      }
      changed = true;
    }

    for (const conflict of analysis.conflicts) {
      const orderedItems = [...conflict.items].sort((a, b) => {
        if (a.category_code === preferredCategoryCode) return 1;
        if (b.category_code === preferredCategoryCode) return -1;
        return 0;
      });

      const target = orderedItems[0];
      const available = (analysis.availableOptions[target.category_code] || []).filter(
        option => option !== target.option_code
      );

      if (available.length > 0) {
        selections[target.category_code] = available[0];
      } else {
        delete selections[target.category_code];
      }
      changed = true;
    }

    if (!changed) {
      return { selections, analysis };
    }
  }

  return {
    selections,
    analysis: analyzeConstraints(model, selections, customCategoryCodes),
  };
}
