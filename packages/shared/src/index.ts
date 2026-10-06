import { z } from 'zod'

// Mensajes de validación por defecto en español para todo el monorepo.
z.config(z.locales.es())

export * from './money'
export * from './pricing'
export * from './permissions'
export * from './dates'
export * from './errors'
export * from './schemas/common'
export * from './schemas/auth'
export * from './schemas/users'
export * from './schemas/categories'
export * from './schemas/products'
export * from './schemas/stock'
export * from './schemas/sales'
export * from './schemas/pricing'
export * from './schemas/reports'
