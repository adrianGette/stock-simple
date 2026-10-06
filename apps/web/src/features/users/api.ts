import type { CreateUserInput, UpdateUserInput, UserDto } from '@stock/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api-client'

const usersKey = ['users'] as const

export function useUsers() {
  return useQuery({ queryKey: usersKey, queryFn: ({ signal }) => api<UserDto[]>('/users', { signal }) })
}

export function useSaveUser(id?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateUserInput | UpdateUserInput) =>
      id ? api<UserDto>(`/users/${id}`, { method: 'PATCH', body: input }) : api<UserDto>('/users', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  })
}
