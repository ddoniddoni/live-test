import type { LiveRepository } from './live-repository.js';

export type DemoAccessToken = {
  userId: string;
  role: 'VIEWER' | 'ADMIN';
};

export type LiveFlowConfiguration = {
  aiMode: string;
  allowedOrigins: string[];
  demoAdminPassword?: string;
  demoMode: boolean;
  jwtSecret: string;
  liveRepository: LiveRepository;
};

export const LIVEFLOW_CONFIGURATION = Symbol('LIVEFLOW_CONFIGURATION');
export const LIVE_REPOSITORY = Symbol('LIVE_REPOSITORY');
