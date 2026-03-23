import type { TFunction } from 'i18next';
import type { Skill, SkillCatalogItem } from '@/types/skill';

type SkillCopyLike = Pick<Skill, 'id' | 'slug' | 'description'> | Pick<SkillCatalogItem, 'id' | 'slug' | 'description'>;

const sanitizeSkillDescriptionKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

export const getSkillDescriptionTranslationKey = (skill: SkillCopyLike) => {
  const candidate = skill.slug || skill.id;
  return candidate ? `catalog.descriptions.${sanitizeSkillDescriptionKey(candidate)}` : null;
};

export const resolveLocalizedSkillDescription = (
  skill: SkillCopyLike,
  t: TFunction<'skills'>,
  exists?: (key: string) => boolean,
) => {
  const translationKey = getSkillDescriptionTranslationKey(skill);
  if (!translationKey) {
    return skill.description || '';
  }
  if (exists?.(translationKey)) {
    return t(translationKey);
  }
  const translated = t(translationKey);
  return translated !== translationKey ? translated : skill.description || '';
};
