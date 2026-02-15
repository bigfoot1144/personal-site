export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  summary: string;
  markdownPath: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'hello-world',
    title: 'hello world!',
    date: 'February 14, 2026',
    summary: 'First blog on website',
    markdownPath: '/assets/blog/posts/hello-world.md'
  }
];
