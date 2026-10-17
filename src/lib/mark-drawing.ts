import type { Drawing } from './mark.ts';

export const MARK: Drawing = {
  arm: { d: 'M8.5 10.8 C11.8 9.6 13.8 12.4 16 19.6', width: 1.3 },
  stem: { d: 'M23.6 9.6 C19.8 13.8 17.3 18.4 16 22 C15 25 15.3 27 16.4 27 C17.5 27 17.5 24.6 16 22', width: 3 },
};

export const MARK_SMALL: Drawing = {
  arm: { d: 'M8.3 10.6 C11.8 9.4 13.8 12.4 16 19.6', width: 2.2 },
  stem: {
    d: 'M23.8 9.4 C19.8 13.8 17.3 18.4 16 21.8 C14.7 25.2 15 27.8 16.5 27.8 C18 27.8 18 24.8 16 21.8',
    width: 2.9,
  },
};

export const FINE_ARM = 1.6;

export const MARK_VIEWBOX = '7 8.4 19.5 20.8';
export const MARK_RATIO = 20.8 / 19.5;
