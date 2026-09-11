/** Escupe el HTML del mail para abrirlo en el navegador y verlo como llega. */
import { SUBJECT, html, text } from './review-email-template.mjs'

if (process.argv.includes('--text')) {
  console.log(`ASUNTO: ${SUBJECT}\n`)
  console.log(text())
} else {
  console.log(html())
}
