/** Category keys shared by the generator, the editor and Shutterstock-style CSV columns. */
export const CATEGORY_KEYS = [
  'backgrounds',
  'abstract',
  'business',
  'technology',
  'nature',
  'animals',
  'food',
  'people',
  'travel',
  'health',
  'education',
  'holidays',
  'beauty-fashion',
  'buildings',
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

/** Shutterstock's fixed category names, for its required Categories column. */
export const SHUTTERSTOCK_CATEGORIES = [
  'Abstract',
  'Animals/Wildlife',
  'Arts',
  'Backgrounds/Textures',
  'Beauty/Fashion',
  'Buildings/Landmarks',
  'Business/Finance',
  'Celebrities',
  'Education',
  'Food and Drink',
  'Healthcare/Medical',
  'Holidays',
  'Industrial',
  'Interiors',
  'Miscellaneous',
  'Nature',
  'Objects',
  'Parks/Outdoor',
  'People',
  'Religion',
  'Science',
  'Signs/Symbols',
  'Sports/Recreation',
  'Technology',
  'Transportation',
  'Vintage',
] as const;
