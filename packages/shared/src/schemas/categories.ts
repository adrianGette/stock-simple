import { z } from 'zod'

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(40, 'Máximo 40 caracteres'),
})
export type CategoryInput = z.infer<typeof categoryInputSchema>

export interface CategoryDto {
  id: string
  name: string
  productCount: number
}
