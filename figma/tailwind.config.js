/** @type {import('tailwindcss').Config} */

const { filterTokensByType } = require("./fns");
const tokens = require("./output/light.json")

const colors = filterTokensByType('color', tokens)

module.exports = {
  content: [],
  theme: {
    extend: {},
  },
  plugins: [],
}
