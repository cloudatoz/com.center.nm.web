import age3Csv from '@/data/plan-templates/plan-age-3.csv?raw'
import age4Csv from '@/data/plan-templates/plan-age-4.csv?raw'
import age5Csv from '@/data/plan-templates/plan-age-5.csv?raw'
import age6Csv from '@/data/plan-templates/plan-age-6.csv?raw'

const parseCsvLine = (line: string) => {
  const values: string[] = []
  let value = ''
  let isQuoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (isQuoted && line[index + 1] === '"') {
        value += '"'
        index += 1
      } else isQuoted = !isQuoted
    } else if (character === ',' && !isQuoted) {
      values.push(value)
      value = ''
    } else value += character
  }
  values.push(value)
  return values
}

const parseTemplateCsv = (csv: string) => csv
  .replace(/^\uFEFF/, '')
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map(parseCsvLine)
  .map((columns) => ({ categoryKey: columns[2], content: columns[4] }))
  .filter((item) => item.categoryKey && item.content)

const TEMPLATE_CONTENTS = new Map([
  [3, parseTemplateCsv(age3Csv)],
  [4, parseTemplateCsv(age4Csv)],
  [5, parseTemplateCsv(age5Csv)],
  [6, parseTemplateCsv(age6Csv)],
])

export function randomPlanTemplate(age: number, categoryKey: string, currentContent = '') {
  const matching = (TEMPLATE_CONTENTS.get(age) || [])
    .filter((item) => item.categoryKey === categoryKey)
    .map((item) => item.content)
  if (!matching.length) return null
  const different = matching.filter((content) => content !== currentContent.trim())
  const choices = different.length ? different : matching
  return choices[Math.floor(Math.random() * choices.length)]
}
