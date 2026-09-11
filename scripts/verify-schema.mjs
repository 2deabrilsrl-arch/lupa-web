/**
 * ¿Qué acepta realmente output_config.format.schema?
 *
 * Ya sabemos que maxItems lo rechaza. Antes de tocar producción conviene saber
 * si minimum/maximum y el tipo unión ['string','null'] corren la misma suerte,
 * en vez de descubrirlo con otro 400 en vivo.
 *
 *   node scripts/verify-schema.mjs
 */
import { loadEnv, pedir } from './lib-env.mjs'

const env = loadEnv(['ANTHROPIC_API_KEY'])

async function probar(nombre, schema) {
  const r = await pedir('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 600,
      thinking: { type: 'adaptive' },
      messages: [
        {
          role: 'user',
          content:
            'Reseñas de una campera: "Muy buena, abriga un montón" (5/5), ' +
            '"Vino con un hilo suelto pero cumple" (4/5), "Talle chico, pedí uno más" (3/5). ' +
            'Analizalas y devolvé el JSON.'
        }
      ],
      output_config: { format: { type: 'json_schema', schema } }
    })
  })

  if (r.ok) {
    const txt = r.body?.content?.find(b => b.type === 'text')?.text ?? ''
    let parsed = null
    try { parsed = JSON.parse(txt) } catch { /* */ }
    console.log(`  ✓ ${nombre}`)
    if (parsed) {
      console.log(`      pros: ${parsed.pros?.length ?? 0} · cons: ${parsed.cons?.length ?? 0} · sentiment: ${parsed.sentiment_score} · sizing: ${JSON.stringify(parsed.sizing_notes)}`)
    }
    return true
  }
  console.log(`  ✗ ${nombre}`)
  console.log(`      ${(r.body?.error?.message ?? r.raw).toString().slice(0, 200)}`)
  return false
}

const base = {
  ai_summary: { type: 'string', description: 'Resumen de 2-3 oraciones' },
  pros: { type: 'array', items: { type: 'string' }, description: 'Hasta 5 puntos positivos' },
  cons: { type: 'array', items: { type: 'string' }, description: 'Hasta 5 puntos negativos' }
}
const req = ['ai_summary', 'pros', 'cons', 'sentiment_score']

console.log('\nProbando variantes del schema:\n')

// 1. El schema que pienso dejar: sin maxItems, sin minimum/maximum, con unión.
await probar('sin maxItems · sentiment sin min/max · sizing_notes tipo unión', {
  type: 'object',
  properties: {
    ...base,
    sizing_notes: { type: ['string', 'null'], description: 'Notas de talle, o null' },
    sentiment_score: { type: 'number', description: '0 = terribles, 0.5 = mezclado, 1 = excelentes' }
  },
  required: req,
  additionalProperties: false
})

// 2. ¿minimum/maximum se aceptan?
await probar('…pero con minimum/maximum en sentiment_score', {
  type: 'object',
  properties: {
    ...base,
    sizing_notes: { type: ['string', 'null'] },
    sentiment_score: { type: 'number', minimum: 0, maximum: 1 }
  },
  required: req,
  additionalProperties: false
})

// 3. ¿El tipo unión se acepta? Alternativa: anyOf.
await probar('…con sizing_notes como anyOf en vez de unión', {
  type: 'object',
  properties: {
    ...base,
    sizing_notes: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    sentiment_score: { type: 'number' }
  },
  required: req,
  additionalProperties: false
})

// 4. Lo más conservador posible, por si todo lo demás falla.
await probar('mínimo indispensable (todo string/number/array simple)', {
  type: 'object',
  properties: {
    ai_summary: { type: 'string' },
    pros: { type: 'array', items: { type: 'string' } },
    cons: { type: 'array', items: { type: 'string' } },
    sizing_notes: { type: 'string', description: 'Notas de talle. Cadena vacía si no aplica.' },
    sentiment_score: { type: 'number' }
  },
  required: ['ai_summary', 'pros', 'cons', 'sizing_notes', 'sentiment_score'],
  additionalProperties: false
})

console.log('')
