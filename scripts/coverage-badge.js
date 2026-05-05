const fs = require('fs')
const path = require('path')

const summaryPath = path.join(
  process.cwd(),
  'coverage',
  'coverage-summary.json'
)
const outputPath = path.join(process.cwd(), 'badges', 'coverage.svg')
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
const percentage = Number(summary.total.lines.pct)
const label = 'coverage'
const message = `${percentage}%`
const color =
  percentage >= 90 ? '#4c1' : percentage >= 80 ? '#dfb317' : '#e05d44'
const labelWidth = 63
const messageWidth = Math.max(42, message.length * 7 + 10)
const totalWidth = labelWidth + messageWidth

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${message}">
  <title>${label}: ${message}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${labelWidth * 5}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${
      (labelWidth - 10) * 10
    }">${label}</text>
    <text x="${labelWidth * 5}" y="140" transform="scale(.1)" textLength="${
      (labelWidth - 10) * 10
    }">${label}</text>
    <text aria-hidden="true" x="${
      labelWidth * 10 + (messageWidth * 10) / 2
    }" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${
      (messageWidth - 10) * 10
    }">${message}</text>
    <text x="${
      labelWidth * 10 + (messageWidth * 10) / 2
    }" y="140" transform="scale(.1)" textLength="${
      (messageWidth - 10) * 10
    }">${message}</text>
  </g>
</svg>
`

fs.mkdirSync(path.dirname(outputPath), {recursive: true})
fs.writeFileSync(outputPath, svg)
