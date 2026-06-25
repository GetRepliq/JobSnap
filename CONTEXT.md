# JobSnap CONTEXT.md

## Overview
JobSnap is a B2B SaaS platform that transforms job site photos into context-aware social media posts. It is designed for field-based businesses, automating localized marketing content generation through a lightweight, mobile-responsive web app and an AI-powered backend.

## Tech Stack
- **Frontend:** Next.js
  - Captivating, high-ROI landing page
  - Mobile-first, user-friendly web app interface
  - Simple, descriptive logo (camera emoji or Instagram-camera style)
- **Backend:**
  - User system: Collects business info at signup for LLM context
  - User chat/history: Tracks user interactions and AI outputs
  - Supabase: Stores compressed job images, job descriptions, and AI-generated outputs
- **AI & Database:**
  - Vision-LLM backend for image-to-caption generation
  - Stores essential user/business info for context
  - Compressed job site images

## Marketing Strategy
- Target small and trades businesses with social media presence
- Offer: First 20 posts free
- Collect feedback and reviews for social proof
- Promote on X (Twitter) with a build-in-public approach

## Key Features
- Upload job site photos
- AI-generated, context-aware social media captions
- User/business info for personalized content
- Mobile-first, easy-to-use interface
- User chat and history tracking

## Database Schema

```sql
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  email text UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.businesses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  business_name text NOT NULL,
  trade text,
  location text,
  tone text,
  website text,
  instagram_handle text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT businesses_pkey PRIMARY KEY (id),
  CONSTRAINT businesses_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.job_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text,
  description text,
  job_location text,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'ready'::text, 'generated'::text, 'archived'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT job_posts_pkey PRIMARY KEY (id),
  CONSTRAINT job_posts_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT job_posts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.job_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_post_id uuid NOT NULL,
  storage_path_original text NOT NULL,
  storage_path_compressed text,
  mime_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT job_images_pkey PRIMARY KEY (id),
  CONSTRAINT job_images_job_post_id_fkey FOREIGN KEY (job_post_id) REFERENCES public.job_posts(id)
);
CREATE TABLE public.generated_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_post_id uuid NOT NULL,
  platform text NOT NULL DEFAULT 'instagram'::text,
  caption text NOT NULL,
  hashtags text,
  prompt_snapshot text,
  model_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT generated_posts_pkey PRIMARY KEY (id),
  CONSTRAINT generated_posts_job_post_id_fkey FOREIGN KEY (job_post_id) REFERENCES public.job_posts(id)
);
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])),
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id)
);
CREATE TABLE public.usage (
  business_id uuid NOT NULL,
  posts_used integer NOT NULL DEFAULT 0,
  free_posts_remaining integer NOT NULL DEFAULT 20,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT usage_pkey PRIMARY KEY (business_id),
  CONSTRAINT usage_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);
```
