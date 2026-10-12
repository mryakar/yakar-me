export const topics = ['Java', 'Databases'] as const;
export type Topic = (typeof topics)[number];
