import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aE164 } from '../lib/phone.ts'

test('Argentina: agrega el 9 y saca el 15 y el 0', () => {
  assert.equal(aE164('341 123 4567', 'MLA'), '+5493411234567')
  assert.equal(aE164('0341 15 123 4567', 'MLA'), '+5493411234567')
  assert.equal(aE164('+54 9 341 123 4567', 'MLA'), '+5493411234567')
})

test('México, Colombia, Chile, Perú, Uruguay y Brasil NO llevan el 9 argentino', () => {
  assert.equal(aE164('55 1234 5678', 'MLM'), '+525512345678')
  assert.equal(aE164('300 1234567', 'MCO'), '+573001234567')
  assert.equal(aE164('9 1234 5678', 'MLC'), '+56912345678')
  assert.equal(aE164('912 345 678', 'MPE'), '+51912345678')
  assert.equal(aE164('99 123 456', 'MLU'), '+59899123456')
  assert.equal(aE164('11 91234 5678', 'MLB'), '+5511912345678')
})

test('el + explícito gana sobre el sitio elegido', () => {
  // Vive en México y compra en el ML de Argentina.
  assert.equal(aE164('+52 55 1234 5678', 'MLA'), '+525512345678')
})

test('rechaza en vez de adivinar', () => {
  assert.equal(aE164('123', 'MLA'), null)
  assert.equal(aE164('', 'MLM'), null)
  assert.equal(aE164('no es un numero', 'MLC'), null)
  // 10 dígitos es válido en Argentina pero no en Chile, que usa 9.
  assert.equal(aE164('3411234567', 'MLC'), null)
})

test('un número mexicano no se convierte en argentino', () => {
  const mx = aE164('55 1234 5678', 'MLM')
  assert.ok(mx?.startsWith('+52'), `esperaba +52, salió ${mx}`)
  assert.ok(!mx?.startsWith('+549'))
})
