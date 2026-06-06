import api from './api'
import type { Post, PostCreateInput, PostUpdateInput, PostStatus } from '@/types'

export const getPosts = async (status?: PostStatus): Promise<Post[]> => {
  const params = status ? { status } : {}
  const { data } = await api.get<Post[]>('/posts', { params })
  return data
}

export const getPost = async (id: string): Promise<Post> => {
  const { data } = await api.get<Post>(`/posts/${id}`)
  return data
}

export const createPost = async (input: PostCreateInput): Promise<Post> => {
  const { data } = await api.post<Post>('/posts', input)
  return data
}

export const updatePost = async (id: string, input: PostUpdateInput): Promise<Post> => {
  const { data } = await api.put<Post>(`/posts/${id}`, input)
  return data
}

export const deletePost = async (id: string): Promise<void> => {
  await api.delete(`/posts/${id}`)
}

export const schedulePost = async (
  id: string,
  scheduled_at: string
): Promise<Post> => {
  const { data } = await api.post<Post>(`/posts/${id}/schedule`, { scheduled_at })
  return data
}

export const publishPostNow = async (id: string): Promise<void> => {
  await api.post(`/posts/${id}/publish-now`)
}
