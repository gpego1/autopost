import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPost,
  deletePost,
  getPost,
  getPosts,
  publishPostNow,
  schedulePost,
  updatePost,
} from '@/services/postsApi'
import type { Post, PostCreateInput, PostStatus, PostUpdateInput } from '@/types'

export const POSTS_KEY = 'posts'

export function usePostsQuery(status?: PostStatus) {
  return useQuery<Post[]>({
    queryKey: [POSTS_KEY, { status }],
    queryFn: () => getPosts(status),
  })
}

export function usePostQuery(id: string | undefined) {
  return useQuery<Post>({
    queryKey: [POSTS_KEY, id],
    queryFn: () => getPost(id!),
    enabled: !!id,
  })
}

export function useCreatePost() {
  const qc = useQueryClient()
  return useMutation<Post, Error, PostCreateInput>({
    mutationFn: createPost,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [POSTS_KEY] })
    },
  })
}

export function useUpdatePost() {
  const qc = useQueryClient()
  return useMutation<Post, Error, { id: string; input: PostUpdateInput }>({
    mutationFn: ({ id, input }) => updatePost(id, input),
    onSuccess: (updated) => {
      qc.setQueryData([POSTS_KEY, updated.id], updated)
      qc.invalidateQueries({ queryKey: [POSTS_KEY] })
    },
  })
}

export function useDeletePost() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: deletePost,
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: [POSTS_KEY, id] })
      qc.invalidateQueries({ queryKey: [POSTS_KEY] })
    },
  })
}

export function useSchedulePost() {
  const qc = useQueryClient()
  return useMutation<Post, Error, { id: string; scheduled_at: string }>({
    mutationFn: ({ id, scheduled_at }) => schedulePost(id, scheduled_at),
    onSuccess: (updated) => {
      qc.setQueryData([POSTS_KEY, updated.id], updated)
      qc.invalidateQueries({ queryKey: [POSTS_KEY] })
    },
  })
}

export function usePublishNow() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: publishPostNow,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [POSTS_KEY] })
    },
  })
}
