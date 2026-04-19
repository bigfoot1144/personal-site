export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  summary: string;
  markdownPath: string;
  tags?: string[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'hello-world',
    title: 'hello world!',
    date: 'February 14, 2026',
    summary: 'First blog on website',
    markdownPath: '/assets/blog/posts/hello-world.md',
    tags: ['Devlog', 'Personal Site', 'Launch']
  },
  {
    slug: 'modern-model-compression',
    title: 'modern model compression',
    date: 'April 19, 2026',
    summary: 'gguf and nvfp4 format comparison with gemma4',
    markdownPath: '/assets/blog/posts/modern-model-compression.md'
  }
];
