import {
  StyledValueToCSSObject,
  themeStyledValueToCSSObject,
} from '../resolver/StyledValueToCSSObject';
import type { OrderedSXResolved } from '../types';
import { getCSSIdAndRuleset } from '../updateCSSStyleInOrderedResolved.web';
import {
  convertFromUnicodeString,
  deepMerge,
  resolveTokensFromConfig,
} from '../utils';
import { inject } from '../utils/css-injector';
export type DeclarationType = 'boot' | 'forwarded';

const cssVariableRegex = /var\(--([^)]+)\)/;
const negativeCSSVariableRegex = /^calc\(var\(.+\) \* -1\)$/;

function getTokenValueFromTokenPath(tokenPath: string, tokens: any) {
  const tokenPathArray = tokenPath.split('-');
  let tokenValue = tokens;
  tokenPathArray.forEach((tokenPathKey: string) => {
    tokenValue = tokenValue?.[tokenPathKey];
  });
  return tokenValue;
}

function extractVariable(input: string) {
  if (typeof input !== 'string') return null;
  const match = input.match(cssVariableRegex);
  return match ? match[1] : null;
}

function getNativeValuesFromCSSVariables(styleObject: any, CONFIG: any) {
  const resolvedNativeValues: any = {};

  Object.keys(styleObject).forEach((key) => {
    const hyphenatedTokenPath = convertFromUnicodeString(
      extractVariable(styleObject[key])
    );

    const isNegativeToken = negativeCSSVariableRegex.test(styleObject[key]);

    if (!hyphenatedTokenPath) {
      resolvedNativeValues[key] = styleObject[key];
    } else {
      let val = getTokenValueFromTokenPath(hyphenatedTokenPath, CONFIG);

      if (isNegativeToken) {
        if (typeof val === 'number') {
          val = -val;
        } else if (typeof val === 'string') {
          val = `-${val}`;
        }
      }
      resolvedNativeValues[key] = val;
    }
  });
  return resolvedNativeValues;
}

export class StyleInjector {
  #globalStyleMap: any;
  #toBeInjectedIdsArray: Array<string>;
  #idCounter: number;

  constructor() {
    this.#globalStyleMap = new Map();
    this.#toBeInjectedIdsArray = [];
    this.#idCounter = 0;
  }

  declare(
    orderedSXResolved: OrderedSXResolved,
    _wrapperElementId: string,
    _styleTagId: any = 'css-injected-boot-time',
    extendedConfig?: any
  ) {
    const styleIds: any = [];
    orderedSXResolved.forEach((styledResolved: any) => {
      if (styledResolved?.meta?.cssId) {
        this.#globalStyleMap.set(styledResolved.meta.cssId, {
          ...styledResolved,
          type: _wrapperElementId,
          componentHash: _styleTagId,
          id: this.#idCounter,
          extendedConfig,
        });
        this.#idCounter++;
        styleIds.push(styledResolved.meta.cssId);
      }
    });

    return styleIds;
  }

  resolve(
    cssIds: any = [],
    CONFIG: any,
    ExtendedConfig: any,
    resolve: any = true,
    declarationType: string = 'boot',
    ignoreKeys: Set<any> = new Set()
  ) {
    let componentExtendedConfig = CONFIG;

    if (ExtendedConfig) {
      componentExtendedConfig = deepMerge(CONFIG, ExtendedConfig);
    }

    const toBeInjected: any = {};

    cssIds?.forEach((cssId: string) => {
      if (this.#globalStyleMap.get(cssId)) {
        const styledResolved = this.#globalStyleMap.get(cssId);
        const theme = styledResolved?.original;

        if (resolve) {
          this.resolveComponentTheme(
            styledResolved,
            theme,
            componentExtendedConfig,
            styledResolved.componentHash,
            CONFIG,
            declarationType,
            ignoreKeys
          );
        }

        const type = styledResolved?.type;
        const styleTag = styledResolved?.componentHash;
        const cssRuleset = styledResolved?.meta?.cssRuleset;

        if (!toBeInjected[type]) {
          toBeInjected[type] = new Map();
        }

        const cummialtiveCssRuleset = toBeInjected[type].get(styleTag);

        if (!cummialtiveCssRuleset) {
          toBeInjected[type].set(styleTag, {
            id: styledResolved.id,
            cssRuleset: cssRuleset ?? '',
          });
        } else {
          toBeInjected[type].set(styleTag, {
            id: cummialtiveCssRuleset?.id,
            cssRuleset: cummialtiveCssRuleset?.cssRuleset + cssRuleset,
          });
        }

        const resolvedNativeValue = getNativeValuesFromCSSVariables(
          styledResolved?.resolved,
          CONFIG?.tokens
        );

        const resolvedThemeNativeValue: any = {};

        Object.keys(styledResolved?.themeResolved).forEach((key) => {
          const currentThemeStyleObj = styledResolved?.themeResolved[key];
          const resolvedCurrentThemeNativeValue =
            getNativeValuesFromCSSVariables(
              currentThemeStyleObj,
              CONFIG?.themes?.[key]
            );
          resolvedThemeNativeValue[key] = resolvedCurrentThemeNativeValue;
        });

        if (styledResolved) {
          this.#globalStyleMap.set(styledResolved.meta.cssId, {
            ...styledResolved,
            resolved: resolvedNativeValue,
            themeResolved: resolvedThemeNativeValue,
          });
        }
      }
    });

    return toBeInjected;
  }

  update(orderResolvedStyleMap: any) {
    const toBeInjected: any = {};

    orderResolvedStyleMap.forEach((styledResolved: any) => {
      this.#globalStyleMap.set(styledResolved.meta.cssId, styledResolved);

      this.#idCounter++;

      this.#toBeInjectedIdsArray.push(styledResolved.meta.cssId);

      const type = styledResolved?.type;
      const styleTag = styledResolved?.componentHash;
      const cssRuleset = styledResolved?.meta?.cssRuleset;

      if (!toBeInjected[type]) {
        toBeInjected[type] = new Map();
      }

      const cummialtiveCssRuleset = toBeInjected[type].get(styleTag);

      if (!cummialtiveCssRuleset) {
        toBeInjected[type].set(styleTag, {
          id: styledResolved.id,
          cssRuleset: cssRuleset ?? '',
        });
      } else {
        toBeInjected[type].set(styleTag, {
          id: cummialtiveCssRuleset?.id,
          cssRuleset: cummialtiveCssRuleset?.cssRuleset + cssRuleset,
        });
      }
    });

    return toBeInjected;
  }

  inject(toBeInjected: any = {}, inlineStyleMap: any) {
    Object.keys(toBeInjected).forEach((type) => {
      toBeInjected[type].forEach(({ id, cssRuleset }: any, styleTag: any) => {
        this.injectStyles(cssRuleset, type, styleTag, inlineStyleMap, id);
      });
    });
  }

  resolveComponentTheme(
    componentTheme: any,
    theme: any,
    componentExtendedConfig: any,
    componentHashKey: any,
    CONFIG: any,
    declarationType: string = 'boot',
    ignoreKeys: Set<any> = new Set()
  ) {
    const prefixClassName = declarationType === 'inline' ? 'gs' : '';
    componentTheme.resolved = StyledValueToCSSObject(
      theme,
      componentExtendedConfig,
      ignoreKeys
    );
    componentTheme.themeResolved = themeStyledValueToCSSObject(
      theme,
      componentExtendedConfig,
      ignoreKeys
    );

    // addThemeConditionInMeta(componentTheme, CONFIG);
    // delete componentTheme.meta.cssRuleset;

    if (componentTheme.meta && componentTheme.meta.queryCondition) {
      const queryCondition = resolveTokensFromConfig(
        CONFIG,
        {
          condition: componentTheme.meta.queryCondition,
        },
        true
      )?.condition;
      componentTheme.meta.queryCondition = queryCondition;
    }

    const cssData: any = getCSSIdAndRuleset(
      componentTheme,
      componentHashKey,
      prefixClassName
    );

    componentTheme.meta.cssRuleset = cssData.rules.style;
  }

  getStyleMap() {
    return this.#globalStyleMap;
  }

  injectStyles(
    cssRuleset: any,
    _wrapperType: any,
    _styleTagId: any,
    inlineStyleMap: any,
    id: any
  ) {
    if (cssRuleset) {
      inject(
        `@media screen {${cssRuleset}}`,
        _wrapperType as any,
        _styleTagId,
        inlineStyleMap,
        id
      );
    }
  }
}

const stylesheet = new StyleInjector();
export const GluestackStyleSheet = stylesheet;
