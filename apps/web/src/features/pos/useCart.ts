import { useEffect, useReducer } from 'react'
import { type CartState, cartReducer, emptyCart } from './cart'

const STORAGE_KEY = 'stock-simple:cart'

function restore(): CartState {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved) as CartState
  } catch {
    // sin storage disponible: carrito vacío
  }
  return emptyCart()
}

/** El carrito sobrevive a una recarga accidental de la pestaña (sessionStorage). */
export function useCart() {
  const [cart, dispatch] = useReducer(cartReducer, undefined, restore)
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
    } catch {
      // ignorar: es solo una comodidad
    }
  }, [cart])
  return [cart, dispatch] as const
}
