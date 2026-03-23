import type { Variants } from 'framer-motion';

const ease = [0.22, 1, 0.36, 1] as const;

export const setupStageTransition = {
  duration: 0.18,
  ease,
} as const;

export const setupStageContainerVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const setupStageItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: setupStageTransition,
  },
};

export const setupRailItemVariants: Variants = {
  inactive: {
    opacity: 0.78,
    y: 0,
  },
  active: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.14,
      ease,
    },
  },
};
