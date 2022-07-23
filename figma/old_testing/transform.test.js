const fs = require('fs');
const _ = require('lodash');
const StyleDictionary = require('style-dictionary');
const { Parser } = require('expr-eval');
const { parseToRgba } = require('color2k');
const path = require('path');

console.log('Build started...');
console.log('\n==============================================');

const fontWeightMap = {
  thin: 100,
  Thin: 100,
  extralight: 200,
  ExtraLight: 200,
  ultralight: 200,
  extraleicht: 200,
  light: 300,
  Light: 300,
  leicht: 300,
  normal: 400,
  Normal: 400,
  regular: 400,
  Regular: 400,
  buch: 400,
  medium: 500,
  Medium: 500,
  kraeftig: 500,
  kräftig: 500,
  semibold: 600,
  SemiBold: 600,
  demibold: 600,
  halbfett: 600,
  bold: 700,
  Bold: 700,
  dreiviertelfett: 700,
  extrabold: 800,
  ExtraBold: 800,
  ultabold: 800,
  UltaBold: 800,
  fett: 800,
  black: 900,
  Black: 900,
  heavy: 900,
  super: 900,
  extrafett: 900,
};

/**
 * Helper: Transforms math like Figma Tokens
 */

const parser = new Parser();

function checkAndEvaluateMath(expr) {
  try {
    parser.evaluate(expr);
    return +parser.evaluate(expr).toFixed(3);
  } catch (ex) {
    return expr;
  }
}

/**
 * Helper: Transforms dimensions to px
 */
function transformDimension(value) {
  if (value.endsWith('px')) {
    return value;
  }
  return value + 'px';
}

/**
 * Helper: Transforms letter spacing % to em
 */
function transformLetterSpacing(value) {
  if (value.endsWith('%')) {
    const percentValue = value.slice(0, -1);
    return `${percentValue / 100}em`;
  }
  return value;
}

/**
 * Helper: Transforms letter spacing % to em
 */
function transformFontWeights(value) {
  const mapped = fontWeightMap[value.toLowerCase()];
  // return `${mapped}`;
  return mapped ? `${mapped}` : value;
}

/**
 * Helper: Transforms hex rgba colors used in figma tokens: rgba(#ffffff, 0.5) =? rgba(255, 255, 255, 0.5). This is kind of like an alpha() function.
 */
function transformHEXRGBa(value) {
  if (value.startsWith('rgba(#')) {
    const [hex, alpha] = value.replace(')', '').split('rgba(').pop().split(', ');
    const [r, g, b] = parseToRgba(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } else {
    return value;
  }
}

/**
 * Helper: Transforms boxShadow object to shadow shorthand
 * This currently works fine if every value uses an alias, but if any one of these use a raw value, it will not be transformed.
 */
function transformShadow(shadow) {
  const { x, y, blur, spread, color } = shadow;
  return `${x} ${y} ${blur} ${spread} ${color}`;
}

/**
 * Transform typography shorthands for css variables
 */
StyleDictionary.registerTransform({
  name: 'typography/shorthand',
  type: 'value',
  transitive: true,
  matcher: token => token.type === 'typography',
  transformer: token => {
    const { fontWeight, fontSize, lineHeight, fontFamily } = token.original.value;
    return `${fontWeight} ${fontSize}/${lineHeight} ${fontFamily}`;
  },
});

/**
 * Transform shadow shorthands for css variables
 */
StyleDictionary.registerTransform({
  name: 'shadow/shorthand',
  type: 'value',
  transitive: true,
  matcher: token => ['boxShadow'].includes(token.type),
  transformer: token => {
    return Array.isArray(token.original.value) ? token.original.value.map(single => transformShadow(single)).join(', ') : transformShadow(token.original.value);
  },
});

/**
 * Transform fontSizes to px
 */
StyleDictionary.registerTransform({
  name: 'size/px',
  type: 'value',
  transitive: true,
  matcher: token => ['fontSizes', 'dimension', 'borderRadius', 'borderWidth', 'spacing', 'sizing'].includes(token.type),
  transformer: token => transformDimension(token.value),
});

/**
 * Transform letterSpacing to em
 */
StyleDictionary.registerTransform({
  name: 'size/letterspacing',
  type: 'value',
  transitive: true,
  matcher: token => token.type === 'letterSpacing',
  transformer: token => transformLetterSpacing(token.value),
});

/**
 * Transform fontWeights to numerical
 */
StyleDictionary.registerTransform({
  name: 'type/fontWeight',
  type: 'value',
  transitive: true,
  matcher: token => token.type === 'fontWeights',
  transformer: token => transformFontWeights(token.value),
});

/**
 * Transform rgba colors to usable rgba
 */
StyleDictionary.registerTransform({
  name: 'color/hexrgba',
  type: 'value',
  transitive: true,
  matcher: token => typeof token.value === 'string' && token.value.startsWith('rgba(#'),
  transformer: token => transformHEXRGBa(token.value),
});

/**
 * Transform to resolve math across all tokens
 */
StyleDictionary.registerTransform({
  name: 'resolveMath',
  type: 'value',
  transitive: true,
  matcher: token => token,
  // Putting this in strings seems to be required
  transformer: token => `${checkAndEvaluateMath(token.value)}`,
});

/**
 * Format for css variables
 */
StyleDictionary.registerFormat({
  name: 'css/variables',
  formatter: function (dictionary, config) {
    return `${this.selector} {
${dictionary.allProperties.map(prop => `  --${prop.name}: ${prop.value};`).join('\n')}
}`;
  },
});

function convertToVariableIfNeeded(value) {
  if (value.startsWith("{") && value.endsWith("}")) {
    return `var(--${value.slice(1, -1).replace(".", "-")})`;
  }
  return value;
}

/**
 * Format for css typography classes
 * This generates theme-independent css classes so we're fine with just using css variables here
 * We're using the css shorthand to define the font: property and define all other values according to the typography token
 */
StyleDictionary.registerFormat({
  name: 'css/typographyClasses',
  formatter: (dictionary, config) =>
    dictionary.allProperties
      .map(
        prop => `
        .${prop.name} {
          font: var(--${prop.name});
          letter-spacing: ${convertToVariableIfNeeded(prop.original.value.letterSpacing)};
          text-transform: ${convertToVariableIfNeeded(prop.original.value.textCase)};
          text-decoration: ${convertToVariableIfNeeded(prop.original.value.textDecoration)};
        }`,
      )
      .join('\n'),
});

function getStyleDictionaryConfig(themeName, themeTokenSets) {
  return {
    source: themeTokenSets,
    platforms: {
      css: {
        transforms: ['resolveMath', 'size/px', 'size/letterspacing', 'type/fontWeight', 'color/hexrgba', 'typography/shorthand', 'shadow/shorthand', 'name/cti/kebab'],
        buildPath: `dist/css/`,
        files: [
          {
            destination: `${convertToSafeThemeName(themeName)}.css`,
            format: 'css/variables',
            selector: `.${convertToSafeThemeName(themeName)}`,
          },
        ],
      },
    },
  };
}

function convertToSafeThemeName(themeName) {
  const safeName = themeName.replace(' ', '-').replace(/[^0-9a-zA-Z-]/g, "");
  return safeName;
}

const configBlob = fs.readFileSync('sd_config.json');
const config = JSON.parse(configBlob);
const dirPath = config.tokenSetsDirPath;
const themeMetaBlob = fs.readFileSync(config.tokenSetsThemeMetaPath);
const themeMeta = JSON.parse(themeMetaBlob);

const themeOutput = themeMeta.map(theme => {
  const { name: themeName, selectedTokenSets } = theme;
  const filteredTokenSets = selectedTokenSets ? _.filter(Object.keys(selectedTokenSets), key => selectedTokenSets[key] !== 'disabled') : [];
  const themeTokenSets = _.map(filteredTokenSets, set => dirPath + '/' + set + '.json');
  const themeConfig = getStyleDictionaryConfig(themeName, themeTokenSets);
  const SD = StyleDictionary.extend(themeConfig);
  SD.buildAllPlatforms();
  return {
    name: themeName,
    class: themeName,
    color: '#ff00ff',
    path: `${themeConfig.platforms.css.buildPath}${themeName}.css`,
  };
});

console.log('\n==============================================');
console.log('\nBuild completed!');