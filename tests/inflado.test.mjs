import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectarInflado, percentil } from '../lib/inflado.ts'

const AHORA = new Date('2026-11-18T12:00:00Z').getTime()
const hace = d => new Date(AHORA - d * 24 * 3600 * 1000).toISOString()

test('percentil interpola y aguanta casos borde', () => {
  assert.equal(percentil([100], 0.75), 100)
  // Con dos valores, idx = 1*0,75: tres cuartos del camino de 100 a 200.
  assert.equal(percentil([100, 200], 0.75), 175)
  // [100,100,100,400] con p=0,75: idx = 3*0,75 = 2,25, o sea entre el tercer
  // valor (100) y el cuarto (400), un cuarto del camino -> 175.
  assert.equal(percentil([100, 100, 100, 400], 0.75), 175)
})

test('marca el "antes" que no describe lo que se pagaba', () => {
  const h = [10, 20, 30, 40].map(d => ({ price: 100000, captured_at: hace(d) }))
  const v = detectarInflado(150000, 120000, h, AHORA)
  assert.equal(v.detected, true)
  assert.match(v.detail, /50% por encima/)
})

test('no marca un descuento legítimo', () => {
  // Venía a 150.000 y lo bajaron a 120.000: el "antes" es real.
  const h = [10, 20, 30, 40].map(d => ({ price: 150000, captured_at: hace(d) }))
  assert.equal(detectarInflado(150000, 120000, h, AHORA).detected, false)
})

test('una caída puntual no condena los 90 días siguientes', () => {
  // Esto es lo que rompía la regla del mínimo: un día de liquidación a 60.000
  // hacía que todo "antes" posterior pareciera inflado.
  const h = [
    { price: 60000, captured_at: hace(80) },
    ...[5, 10, 20, 30, 40, 50].map(d => ({ price: 100000, captured_at: hace(d) }))
  ]
  assert.equal(detectarInflado(105000, 95000, h, AHORA).detected, false)
})

test('se calla cuando no tiene con qué comparar', () => {
  assert.equal(detectarInflado(150000, 120000, [], AHORA).detected, false)
  // Hasta 3 observaciones no opinamos: el percentil 75 de dos valores es
  // apenas el más alto de los dos, y la frase "3 de cada 4 veces" sería falsa.
  for (const n of [1, 2, 3]) {
    const pocos = Array.from({ length: n }, (_, k) => ({
      price: 100000, captured_at: hace(k + 2)
    }))
    assert.equal(
      detectarInflado(150000, 120000, pocos, AHORA).detected,
      false,
      `con ${n} registro(s) no debería opinar`
    )
  }
})

test('el mensaje dice cuántos precios respaldan el veredicto', () => {
  const h = [5, 10, 20, 30, 40].map(d => ({ price: 100000, captured_at: hace(d) }))
  const v = detectarInflado(150000, 120000, h, AHORA)
  assert.equal(v.detected, true)
  assert.match(v.detail, /Registramos 5 precios/)
})

test('ignora el historial viejo fuera de la ventana', () => {
  const h = [100, 120, 200].map(d => ({ price: 50000, captured_at: hace(d) }))
  assert.equal(detectarInflado(150000, 120000, h, AHORA).detected, false)
})

test('sin precio anterior no hay nada que auditar', () => {
  const h = [10, 20].map(d => ({ price: 100000, captured_at: hace(d) }))
  assert.equal(detectarInflado(null, 120000, h, AHORA).detected, false)
  assert.equal(detectarInflado(100000, 120000, h, AHORA).detected, false)
})
