import { Type } from '@angular/core';
import { CircuitSunrisePostComponent } from './circuit-sunrise-post.component';
import { MidnightDeployPostComponent } from './midnight-deploy-post.component';
import { SideQuestRobotsPostComponent } from './side-quest-robots-post.component';

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  summary: string;
  component: Type<unknown>;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'midnight-deploy',
    title: 'Midnight Deploy and the 3:17 a.m. Cookie',
    date: 'January 8, 2026',
    summary: 'A random story about fixing a release bug with tea, logs, and one stubborn cookie header.',
    component: MidnightDeployPostComponent
  },
  {
    slug: 'circuit-sunrise',
    title: 'Circuit Sunrise at the Makerspace',
    date: 'January 19, 2026',
    summary: 'Notes from an early-morning build session where prototypes, solder smoke, and ideas all showed up.',
    component: CircuitSunrisePostComponent
  },
  {
    slug: 'side-quest-robots',
    title: 'Weekend Side Quest: Tiny Robot Cartographer',
    date: 'February 1, 2026',
    summary: 'A playful log of building a mini map-making robot and learning from every wrong turn.',
    component: SideQuestRobotsPostComponent
  }
];
