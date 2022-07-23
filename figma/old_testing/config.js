// config.js
module.exports = {
    source: [`src/**/*.json`],
    // If you don't want to call the registerTransform method a bunch of times
    // you can override the whole transform object directly. This works because
    // the .extend method copies everything in the config
    // to itself, allowing you to override things. It's also doing a deep merge
    // to protect from accidentally overriding nested attributes.
    transform: {
      // Now we can use the transform 'myTransform' below
      myTransform: {
        type: 'alphahex',
        transformer: (token) => token.path.join('_').toUpperCase()
      }
    },
    // Same with formats, you can now write them directly to this config
    // object. The name of the format is the key.
    format: {
      myFormat: ({dictionary, platform}) => {
        return dictionary.allTokens.map(token => `${token.name}: ${token.value}`).join('\n');
      }
    },
    platforms: {
      // ...
    }
  }



  const StyleDictionary = require('style-dictionary');

StyleDictionary.registerParser({
  pattern: /\.json$/,
  parse: ({ filePath, contents }) => {
    return JSON.parse(contents);
  }
});




const StyleDictionaryPackage = require('style-dictionary');
const getStyleDictionaryConfig = require('./style-dictionary.config');

console.log('Build started...');
console.log('\n======================================');
const brands = ['globals', 'atc', 'csf'];
brands.forEach(brand => {
    StyleDictionaryPackage
        .extend(getStyleDictionaryConfig(brand))
        .buildAllPlatforms();
});

console.log('\n======================================');
console.log('\nBuild completed!');