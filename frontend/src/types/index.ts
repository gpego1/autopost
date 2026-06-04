export type Platform = 'instagram' | 'facebook' | 'linkedin'

export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'done' | 'failed'

export type JobStatus = 'pending' | 'running' | 'done' | 'failed' | 'retrying'

export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  plan: 'free' | 'pro' | 'enterprise'
}

export interface SocialAccount {
  id: string
  user_id: string
  platform: Platform
  account_name: string
  platform_user_id: string
  token_expires_at: string | null
  is_active: boolean
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  title: string | null
  content: string
  media_urls: string[]
  platforms: Platform[]
  status: PostStatus
  scheduled_at: string | null
  published_at: string | null
  error_log: string | null
  created_at: string
}

export interface PublishJob {
  id: string
  post_id: string
  platform: Platform
  method: string
  status: JobStatus
  attempts: number
  last_error: string | null
  executed_at: string | null
}

export interface PostCreateInput {
  title?: string
  content: string
  media_urls?: string[]
  platforms: Platform[]
  scheduled_at?: string
}

export interface PostUpdateInput {
  title?: string
  content?: string
  media_urls?: string[]
  platforms?: Platform[]
  status?: PostStatus
  scheduled_at?: string
}

export interface SchedulePostInput {
  scheduled_at: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface OAuthUrlResponse {
  authorization_url: string
}

export interface ApiError {
  detail: string | { msg: string; type: string }[]
}
