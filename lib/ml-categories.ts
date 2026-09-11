/**
 * Resuelve el nombre de la categoría RAÍZ de un producto ("Herramientas") a
 * partir del category_id que devuelve ML (la categoría hoja, ej. "Anilladoras").
 *
 * Sin esto, 5.378 productos quedan sin categoría: no aparecen en ninguna página
 * de categoría y no tienen bloque de "productos similares". O sea, siguen siendo
 * islas para Google.
 *
 * Cada categoría se resuelve una sola vez y queda cacheada en ml_categories.
 */
import { supabaseAdmin } from './supabase'
import { mlFetch } from './ml-service'

interface MlCategoryResponse {
  id: string
  name: string
  path_from_root?: Array<{ id: string; name: string }>
}

export interface ResolvedCategory {
  rootName: string
  rootId: string | null
  leafName: string | null
}

/** Caché en memoria por invocación, para no repetir la consulta dentro del mismo run. */
const memo = new Map<string, ResolvedCategory | null>()

export async function resolveRootCategory(
  categoryId: string | null | undefined
): Promise<ResolvedCategory | null> {
  if (!categoryId) return null
  if (memo.has(categoryId)) return memo.get(categoryId)!

  const { data: cached } = await supabaseAdmin
    .from('ml_categories')
    .select('root_name, root_id, leaf_name')
    .eq('ml_category_id', categoryId)
    .maybeSingle<{ root_name: string; root_id: string | null; leaf_name: string | null }>()

  if (cached) {
    const hit = { rootName: cached.root_name, rootId: cached.root_id, leafName: cached.leaf_name }
    memo.set(categoryId, hit)
    return hit
  }

  try {
    const res = await mlFetch(`/categories/${categoryId}`)
    if (!res.ok) {
      memo.set(categoryId, null)
      return null
    }
    const data = (await res.json()) as MlCategoryResponse
    const root = data.path_from_root?.[0]
    // Si no hay path_from_root, la propia categoría es la raíz.
    const rootName = root?.name ?? data.name
    if (!rootName) {
      memo.set(categoryId, null)
      return null
    }

    const resolved: ResolvedCategory = {
      rootName,
      rootId: root?.id ?? data.id ?? null,
      leafName: data.name ?? null
    }

    await supabaseAdmin.from('ml_categories').upsert(
      {
        ml_category_id: categoryId,
        root_name: resolved.rootName,
        root_id: resolved.rootId,
        leaf_name: resolved.leafName,
        site_id: categoryId.slice(0, 3).toUpperCase(),
        fetched_at: new Date().toISOString()
      },
      { onConflict: 'ml_category_id' }
    )

    memo.set(categoryId, resolved)
    return resolved
  } catch (err) {
    console.error('[Categories] No se pudo resolver', categoryId, err)
    memo.set(categoryId, null)
    return null
  }
}
