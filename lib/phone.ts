/**
 * Normalización de teléfonos a E.164, por país de MercadoLibre.
 *
 * Importante: Lupa NO es una app argentina. De los 14.858 items con site_id,
 * sólo el 52% son MLA; México es 14%, Colombia 13%, Chile 10%, Perú 5%,
 * Uruguay 4% y Brasil 2%. Asumir Argentina ante cualquier número sin "+"
 * convertiría casi la mitad de los teléfonos en un +549 inventado — y un
 * número mal normalizado no es un error visible: es un mensaje que se manda a
 * otra persona.
 *
 * Por eso el país sale del sitio que el usuario ya eligió en el panel, y ante
 * la duda preferimos rechazar el número antes que adivinarlo.
 */

export interface ReglaPais {
  /** Prefijo internacional, sin el +. */
  codigo: string
  /** Largo del número nacional, sin el 0 inicial ni el prefijo. */
  largos: number[]
  /**
   * Prefijo que va entre el código de país y el número para celulares.
   * Argentina usa el 9; el resto no usa ninguno.
   */
  movil?: string
  ejemplo: string
}

export const REGLAS: Record<string, ReglaPais> = {
  MLA: { codigo: '54', largos: [10], movil: '9', ejemplo: '341 123 4567' },
  MLM: { codigo: '52', largos: [10], ejemplo: '55 1234 5678' },
  MLB: { codigo: '55', largos: [10, 11], ejemplo: '11 91234 5678' },
  MLC: { codigo: '56', largos: [9], ejemplo: '9 1234 5678' },
  MCO: { codigo: '57', largos: [10], ejemplo: '300 1234567' },
  MPE: { codigo: '51', largos: [9], ejemplo: '912 345 678' },
  MLU: { codigo: '598', largos: [8, 9], ejemplo: '99 123 456' }
}

export const SITIO_POR_DEFECTO = 'MLA'

export function reglaDe(siteId: string | null | undefined): ReglaPais {
  return REGLAS[(siteId ?? '').toUpperCase()] ?? REGLAS[SITIO_POR_DEFECTO]
}

/**
 * Devuelve el número en E.164 o null si no se puede normalizar con confianza.
 *
 * Un "+" explícito gana siempre: si el usuario sabe su código de país, le
 * creemos, sin importar qué sitio tenga elegido. Es el caso del que vive en un
 * país y compra en el ML de otro.
 */
export function aE164(raw: string, siteId: string | null | undefined): string | null {
  const limpio = raw.replace(/[^\d+]/g, '')

  if (limpio.startsWith('+')) {
    const d = limpio.slice(1)
    return /^[1-9]\d{7,14}$/.test(d) ? `+${d}` : null
  }

  const regla = reglaDe(siteId)
  let n = limpio.replace(/^0+/, '')

  // Si ya viene con el código de país adelante, se lo sacamos para validar el
  // largo nacional y volvérselo a poner de forma canónica.
  if (n.startsWith(regla.codigo)) {
    const resto = n.slice(regla.codigo.length)
    const sinMovil = regla.movil && resto.startsWith(regla.movil)
      ? resto.slice(regla.movil.length)
      : resto
    if (regla.largos.includes(sinMovil.length)) n = sinMovil
  }

  // Argentina: el 15 va después del código de área y sobra en formato
  // internacional. Es el error más común al escribir un celular argentino.
  if (regla.codigo === '54') {
    n = n.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2')
  }

  if (!regla.largos.includes(n.length)) return null

  return `+${regla.codigo}${regla.movil ?? ''}${n}`
}
